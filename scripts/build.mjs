#!/usr/bin/env node
// Builds index.html from src/planner.template.html + data/*.json.
// Usage: node scripts/build.mjs            (inject data only)
//        node scripts/build.mjs --prerender (also pre-render the zero-state page so it reads without JavaScript; needs Playwright)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkFloors } from "../src/floors.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

const template = read("src/planner.template.html");
const config = JSON.parse(read("data/planner-config.json"));
const scorecard = JSON.parse(read("data/civic-action-scorecard-2026-2027.json"));

// Firebase web config (public by design). Missing/empty file => guest-only build:
// no SDK is loaded and the account control is not rendered.
// FIREBASE_CONFIG and OUT env vars let the tests build variants without touching index.html.
const firebasePath = process.env.FIREBASE_CONFIG || "data/firebase-config.json";
let firebaseCfg = null;
try {
  const parsed = JSON.parse(fs.readFileSync(path.join(root, firebasePath), "utf8") || "{}");
  if (parsed && parsed.apiKey) firebaseCfg = parsed;
} catch {}

const merged = {
  title: config.title,
  edition: config.edition || scorecard.edition,
  displayYear: config.displayYear,
  hubName: config.hubName,
  hubUrl: config.hubUrl,
  credit: config.credit,
  license: config.license,
  disclaimer: config.disclaimer,
  tiers: config.tiers || scorecard.tiers,
  homeIntro: config.homeIntro,
  phaseFloors: config.phaseFloors,
  floorExceptions: config.floorExceptions,
  floorNote: config.floorNote,
  suggestPriority: config.suggestPriority,
  privacy: config.privacy,
  firebase: !!firebaseCfg,
  phases: config.phases,
  cats: scorecard.categories,
  actions: scorecard.actions,
};

// Sanity checks so a bad edit fails loudly instead of shipping a broken page.
const codes = new Set();
for (const a of merged.actions) {
  if (!a.code || codes.has(a.code)) throw new Error(`Duplicate or missing action code: ${a.code}`);
  codes.add(a.code);
  if (!merged.cats.some((c) => c.id === a.cat)) throw new Error(`${a.code}: unknown category ${a.cat}`);
  if (!(Number.isInteger(a.pts) && a.pts > 0)) throw new Error(`${a.code}: points must be a positive integer`);
  if (!(Number.isInteger(a.max) && a.max >= 1)) throw new Error(`${a.code}: max must be an integer >= 1`);
}
// Theme guard: every custom property set in a dark-theme block must first exist on
// bare :root, so no color lives only inside a media query or [data-theme] block.
{
  const css = /<style>([\s\S]*?)<\/style>/.exec(template)[1];
  const rootBlock = /:root\{([\s\S]*?)\}/.exec(css);
  const rootProps = new Set([...rootBlock[1].matchAll(/--([\w-]+)\s*:/g)].map((m) => m[1]));
  const darkRe = /:root(?::not\(\[data-theme="light"\]\)|\[data-theme="dark"\])\{([\s\S]*?)\}/g;
  const missing = new Set();
  let dm;
  while ((dm = darkRe.exec(css))) {
    for (const p of dm[1].matchAll(/--([\w-]+)\s*:/g)) if (!rootProps.has(p[1])) missing.add(p[1]);
  }
  if (missing.size) throw new Error("Colors defined only in a dark theme block (add them to bare :root): --" + [...missing].join(", --"));
}

// Every action carries a phase, and the split is exactly the reviewed 27/47/36/14.
const PHASE_COUNTS = { 1: 27, 2: 47, 3: 36, 4: 14 };
const phaseSeen = { 1: 0, 2: 0, 3: 0, 4: 0 };
for (const a of merged.actions) {
  if (!Number.isInteger(a.phase) || a.phase < 1 || a.phase > 4) throw new Error(`${a.code}: missing or invalid phase (must be 1-4)`);
  phaseSeen[a.phase]++;
}
for (const p of [1, 2, 3, 4]) {
  if (phaseSeen[p] !== PHASE_COUNTS[p]) throw new Error(`Phase ${p} has ${phaseSeen[p]} actions; expected ${PHASE_COUNTS[p]}`);
}

// Category floors per phase (IA excluded), bendable only through listed exceptions.
if (!merged.phaseFloors) throw new Error("planner-config.json needs phaseFloors");
const floorErr = checkFloors(merged.actions, merged.phaseFloors, merged.floorExceptions);
if (floorErr) throw new Error(floorErr);
if (!merged.floorNote || !merged.floorNote.includes("{category}")) throw new Error("planner-config.json needs a floorNote with a {category} placeholder");
if (!Array.isArray(merged.suggestPriority) || merged.suggestPriority.length !== 5) throw new Error("planner-config.json needs a 5-entry suggestPriority");

// Each phase's cumulative single-pass points must reach the next award threshold,
// so the recommended path always carries enough points to unlock the next phase.
{
  let cum = 0;
  const tiers = merged.tiers;
  for (const p of [1, 2, 3]) {
    cum += merged.actions.filter((a) => a.phase === p).reduce((s, a) => s + a.pts, 0);
    if (cum < tiers[p - 1].points)
      throw new Error(`Phases 1-${p} carry ${cum} single-pass points, below the ${tiers[p - 1].name} threshold of ${tiers[p - 1].points}`);
  }
}

if (!merged.homeIntro) throw new Error("planner-config.json needs a homeIntro line for the home page");
if (!merged.displayYear) throw new Error("planner-config.json needs a displayYear for the top bar");
if (!merged.privacy) throw new Error("planner-config.json needs a privacy line for the footer");
if (!Array.isArray(merged.phases) || merged.phases.length !== 4) throw new Error("planner-config.json needs a 4-entry phases array");
for (const [i, ph] of merged.phases.entries()) {
  if (ph.number !== i + 1 || !ph.name || !Number.isInteger(ph.unlockPoints) || !ph.tagline || !ph.why)
    throw new Error(`phases[${i}] needs number ${i + 1}, name, unlockPoints, tagline, why`);
}

for (const c of merged.cats) {
  const possible = merged.actions
    .filter((a) => a.cat === c.id)
    .reduce((s, a) => s + (a.unlimited ? a.pts : a.pts * a.max), 0);
  if (c.possible !== possible) {
    console.warn(`Note: ${c.id} "possible" was ${c.possible}; recomputed to ${possible} from the actions.`);
    c.possible = possible;
  }
}

const json = JSON.stringify(merged).replace(/<\//g, "<\\/");
let html = template.replace("__CONFIG__", json);

// Inline the pure merge function so the page and the unit tests share one source.
const mergeSrc = read("src/merge.mjs").replace(/^export function/m, "function");
html = html.replace("__MERGE__", () => mergeSrc);

// Firebase: config JSON + the module script, or nothing at all for guest builds.
const firebaseBlock = firebaseCfg
  ? '<script id="cas-firebase" type="application/json">' + JSON.stringify(firebaseCfg).replace(/<\//g, "<\\/") + "</script>\n" +
    '<script type="module">\n' + read("src/cloud.module.js") + "\n</script>"
  : "";
html = html.replace("__FIREBASE__", () => firebaseBlock);

const wantPrerender = process.argv.includes("--prerender");
if (wantPrerender) {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.warn("Playwright is not installed; skipping pre-render. Run: npm install && npx playwright install chromium");
  }
  if (chromium) {
    const tmp = path.join(root, ".prerender.tmp.html");
    fs.writeFileSync(tmp, html.replace("__PRERENDER__", ""));
    const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
    const page = await browser.newPage();
    await page.goto("file://" + tmp);
    await page.waitForSelector("#total");
    // The app renders from an empty state on a fresh profile, which is exactly what a no-script viewer should see.
    const appHtml = await page.evaluate(() => document.getElementById("app").innerHTML);
    await browser.close();
    fs.unlinkSync(tmp);
    html = html.replace("__PRERENDER__", appHtml);
    console.log("Pre-rendered the zero-state page into index.html.");
  }
}
html = html.replace("__PRERENDER__", "");
const outFile = process.env.OUT || "index.html";
fs.writeFileSync(path.join(root, outFile), html);
console.log(`Wrote ${outFile} (${(html.length / 1024).toFixed(0)} KB, ${merged.actions.length} actions, accounts ${firebaseCfg ? "on" : "off"}).`);
