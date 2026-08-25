#!/usr/bin/env node
// Builds index.html from src/planner.template.html + data/*.json.
// Usage: node scripts/build.mjs            (inject data only)
//        node scripts/build.mjs --prerender (also pre-render the zero-state page so it reads without JavaScript; needs Playwright)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

const template = read("src/planner.template.html");
const config = JSON.parse(read("data/planner-config.json"));
const scorecard = JSON.parse(read("data/civic-action-scorecard-2024-2025.json"));

const merged = {
  title: config.title,
  edition: config.edition || scorecard.edition,
  hubName: config.hubName,
  hubUrl: config.hubUrl,
  credit: config.credit,
  license: config.license,
  disclaimer: config.disclaimer,
  tiers: config.tiers || scorecard.tiers,
  homeIntro: config.homeIntro,
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
  if (!a.variable && !(Number.isInteger(a.pts) && a.pts > 0)) throw new Error(`${a.code}: points must be a positive integer`);
  if (!(Number.isInteger(a.max) && a.max >= 1)) throw new Error(`${a.code}: max must be an integer >= 1`);
}
// Every action carries a phase, and the split is exactly the reviewed 22/39/34/14.
const PHASE_COUNTS = { 1: 22, 2: 39, 3: 34, 4: 14 };
const phaseSeen = { 1: 0, 2: 0, 3: 0, 4: 0 };
for (const a of merged.actions) {
  if (!Number.isInteger(a.phase) || a.phase < 1 || a.phase > 4) throw new Error(`${a.code}: missing or invalid phase (must be 1-4)`);
  phaseSeen[a.phase]++;
}
for (const p of [1, 2, 3, 4]) {
  if (phaseSeen[p] !== PHASE_COUNTS[p]) throw new Error(`Phase ${p} has ${phaseSeen[p]} actions; expected ${PHASE_COUNTS[p]}`);
}
if (!merged.homeIntro) throw new Error("planner-config.json needs a homeIntro line for the home page");
if (!Array.isArray(merged.phases) || merged.phases.length !== 4) throw new Error("planner-config.json needs a 4-entry phases array");
for (const [i, ph] of merged.phases.entries()) {
  if (ph.number !== i + 1 || !ph.name || !Number.isInteger(ph.unlockPoints) || !ph.tagline || !ph.why)
    throw new Error(`phases[${i}] needs number ${i + 1}, name, unlockPoints, tagline, why`);
}

for (const c of merged.cats) {
  const possible = merged.actions
    .filter((a) => a.cat === c.id)
    .reduce((s, a) => s + (a.variable ? 15 : a.unlimited ? a.pts : a.pts * a.max), 0);
  if (c.possible !== possible) {
    console.warn(`Note: ${c.id} "possible" was ${c.possible}; recomputed to ${possible} from the actions.`);
    c.possible = possible;
  }
}

const json = JSON.stringify(merged).replace(/<\//g, "<\\/");
let html = template.replace("__CONFIG__", json);

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
fs.writeFileSync(path.join(root, "index.html"), html);
console.log(`Wrote index.html (${(html.length / 1024).toFixed(0)} KB, ${merged.actions.length} actions).`);
