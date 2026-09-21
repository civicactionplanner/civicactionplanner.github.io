// End-to-end checks for the planner. Runs against the built index.html.
// Local:   npm test                      (opens the file directly)
// Hosted:  BASE_URL=https://civicactionplanner.github.io/ npm test
import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = process.env.BASE_URL || "file://" + path.join(root, "index.html");
const num = (s) => parseInt(String(s).replace(/[^0-9]/g, ""), 10);

// The landing view is #home; most tests exercise the full list, so start each on #all.
// Sections default to collapsed on #all, so the harness seeds them open (cas-ui-v1 is
// UI-only state, like the localStorage.clear() next to it); the collapse tests below
// use fresh contexts to exercise the real defaults.
const OPEN_ALL_SECTIONS = { sections: { all: { DE: false, ES: false, CW: false, AC: false, SI: false } } };
test.beforeEach(async ({ page }) => {
  await page.goto(target);
  await page.waitForSelector("#total");
  await page.evaluate((seed) => {
    localStorage.clear();
    localStorage.setItem("cas-ui-v1", JSON.stringify(seed));
    location.hash = "#all";
  }, OPEN_ALL_SECTIONS);
  await page.reload();
  await page.waitForSelector(".item");
});

test("loads every action with the right point totals", async ({ page }) => {
  expect(num(await page.textContent("#total"))).toBe(0);
  const items = await page.locator(".item").count();
  expect(items).toBe(124);
  await expect(page.locator(".cat")).toHaveCount(5);
  const heads = await page.locator(".cat-h .cs").allTextContents();
  expect(heads.join(" ")).toContain("/ 430 pts");
  expect(heads.join(" ")).toContain("/ 290 pts");
  expect(heads.join(" ")).toContain("/ 375 pts");
  expect(heads.join(" ")).toContain("/ 165 pts");
  expect(heads.join(" ")).toContain("/ 135 pts");
  // The one allowed occurrence is the migration toast copy, which the 2026-27 spec
  // mandates verbatim; no category remnant may remain anywhere else.
  const scrubbed = (await page.content()).split("Instructor-assigned points are no longer part of the scorecard.").join("");
  expect(scrubbed).not.toContain("Instructor");
});

test("toggles, multipliers, and repeat caps change the total", async ({ page }) => {
  await page.click("#item-DE-13 .row");
  expect(num(await page.textContent("#total"))).toBe(20);
  await page.click("#item-DE-11 .row");
  await page.click('#item-DE-11 .stp button[data-d="1"]');
  expect(num(await page.textContent("#total"))).toBe(40);
  // CW-12 is 15 points, repeatable twice: the stepper reaches 30.
  await page.click("#item-CW-12 .row");
  await page.click('#item-CW-12 .stp button[data-d="1"]');
  expect(num(await page.textContent("#total"))).toBe(70);
  await expect(page.locator("#item-CW-12 .stp .cnt")).toHaveText("×2 of 2");
  // DE-29 is unlimited but capped at 10 repeats.
  await page.click("#item-DE-29 .row");
  for (let i = 0; i < 9; i++) await page.click('#item-DE-29 .stp button[data-d="1"]');
  expect(num(await page.textContent("#total"))).toBe(170);
  await expect(page.locator("#item-DE-29 .stp .cnt")).toHaveText("×10");
  await expect(page.locator('#item-DE-29 .stp button[data-d="1"]')).toBeDisabled();
  await page.click("#item-DE-13 .row");
  expect(num(await page.textContent("#total"))).toBe(150);
});

test("old saved progress migrates to the 2026-27 codes with a one-time notice", async ({ page }) => {
  await page.evaluate(([key]) => {
    localStorage.setItem(key, JSON.stringify({ v: 2, counts: { "CW-10": 1, "IA-1": 1, "DE-13": 1 }, ia: 15 }));
  }, ["cas-planner-v2"]);
  await page.reload();
  await page.waitForSelector("#total");
  expect(num(await page.textContent("#total"))).toBe(30); // CW-10A 10 + DE-13 20
  await expect(page.locator("#toast.show")).toContainText("Updated to the 2026-27 scorecard");
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), "cas-planner-v2");
  expect(stored.v).toBe(3);
  expect(stored.counts["CW-10A"]).toBe(1);
  expect(stored.counts["CW-10"]).toBeUndefined();
  expect(stored.counts["IA-1"]).toBeUndefined();
  expect(stored.ia).toBeUndefined();
  await page.reload();
  await page.waitForSelector("#total");
  await page.waitForTimeout(400);
  await expect(page.locator("#toast.show")).toHaveCount(0);
  expect(num(await page.textContent("#total"))).toBe(30);
});

test("award levels move with the total", async ({ page }) => {
  await expect(page.locator(".award")).toContainText("100 points to Bronze");
  for (const code of ["DE-13", "DE-14C", "ES-15", "CW-13C", "SI-5C"]) await page.click(`#item-${code} .row`);
  await expect(page.locator(".award")).toContainText("Bronze level reached");
});

test("details panel drafts, statuses, and copy button work", async ({ page }) => {
  await page.click("#item-DE-11 .exp");
  await expect(page.locator("#item-DE-11 .det .doc")).toContainText("photo");
  await page.fill('#item-DE-11 textarea[data-key="what"]', "I attended the commission meeting on July 21.");
  await page.check('#item-DE-11 input[data-st="appr"]');
  await expect(page.locator('#item-DE-11 input[data-st="sub"]')).toBeChecked();
  expect(num(await page.textContent("#total"))).toBe(10);
  await expect(page.locator(".stages")).toContainText("Approved by iCED 10 pts");
  await page.click('#item-DE-11 [data-act="copy"]');
  await expect(page.locator("#toast")).toContainText(/copied|Copy failed/);
});

test("progress survives a reload", async ({ page }) => {
  await page.fill("#name", "Test Student");
  await page.click("#item-CW-4 .row");
  await page.click("#item-CW-4 .exp");
  await page.fill('#item-CW-4 textarea[data-key="sowhat"]', "Draft text.");
  await page.reload();
  await page.waitForSelector("#total");
  expect(num(await page.textContent("#total"))).toBe(10);
  expect(await page.inputValue("#name")).toBe("Test Student");
  await page.click("#item-CW-4 .exp");
  expect(await page.inputValue('#item-CW-4 textarea[data-key="sowhat"]')).toBe("Draft text.");
});

test("export, share link, and import round-trip", async ({ page, context }) => {
  await page.click("#item-AC-5 .row");
  await page.click('#item-AC-5 .stp button[data-d="1"]');
  const [download] = await Promise.all([page.waitForEvent("download"), page.click("#btn-export")]);
  const file = await download.path();
  const exported = JSON.parse(fs.readFileSync(file, "utf8"));
  expect(exported.state.counts["AC-5"]).toBe(2);

  const share = await page.evaluate(() => {
    const slim = { v: 3, name: "Shared Person", counts: { "DE-13": 1, "CW-4": 1 }, sub: {}, appr: { "CW-4": true } };
    const b64 = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return location.href.split("#")[0] + "#s=" + b64(JSON.stringify(slim));
  });
  const other = await context.newPage();
  await other.goto(share);
  await other.waitForSelector("#sh-load");
  await other.click("#sh-load");
  expect(num(await other.textContent("#total"))).toBe(30);

  await other.setInputFiles("#file-import", file);
  await expect(other.locator("#toast")).toContainText("imported");
  expect(num(await other.textContent("#total"))).toBe(20);
});

test("search and filters narrow the list", async ({ page }) => {
  await page.fill("#search", "blood");
  const visible = await page.locator(".item:not(.hidden)").evaluateAll((els) => els.map((e) => e.dataset.code));
  expect(visible).toEqual(["CW-8", "CW-9A", "CW-9B"]);
  await page.fill("#search", "");
  await page.click("#item-ES-8 .row");
  await page.click('.chip[data-f="done"]');
  const done = await page.locator(".item:not(.hidden)").evaluateAll((els) => els.map((e) => e.dataset.code));
  expect(done).toEqual(["ES-8"]);
});

test("print sheet lists checked actions with totals", async ({ page }) => {
  await page.click("#item-DE-13 .row");
  await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
  const sheet = await page.textContent("#print");
  expect(sheet).toContain("DE-13");
  expect(sheet).toContain("Total points: 20");
});

// ---------- phases ----------
const scorecard = JSON.parse(fs.readFileSync(path.join(root, "data", "civic-action-scorecard-2026-2027.json"), "utf8"));
const byPhase = { 1: [], 2: [], 3: [], 4: [] };
for (const a of scorecard.actions) byPhase[a.phase].push(a);
const singlePass = (p) => byPhase[p].reduce((s, a) => s + a.pts, 0);
// 10-point, single-completion actions used to build exact point totals in tests below.
const tens = scorecard.actions.filter((a) => a.pts === 10 && a.max === 1 && !a.unlimited);
const stateWith = (codes) => ({ v: 3, name: "", counts: Object.fromEntries(codes.map((c) => [c, 1])), sub: {}, appr: {}, notes: {}, updated: 1 });

async function goPhase(page, hash) {
  await page.evaluate((h) => { location.hash = h; }, hash);
  await page.waitForSelector("#phase-head");
}

test("each phase view lists exactly its assigned actions", async ({ page }) => {
  for (const p of [1, 2, 3, 4]) {
    await goPhase(page, "#phase/" + p);
    const shown = await page.locator(".item").evaluateAll((els) => els.map((e) => e.dataset.code).sort());
    expect(shown).toEqual(byPhase[p].map((a) => a.code).sort());
  }
});

test("phase counts are 27/47/36/14 and phase pages show data-derived totals", async ({ page }) => {
  expect([1, 2, 3, 4].map((p) => byPhase[p].length)).toEqual([27, 47, 36, 14]);
  for (const p of [1, 2, 3, 4]) {
    await goPhase(page, "#phase/" + p);
    await expect(page.locator("#phase-prog")).toHaveText(`0 of ${byPhase[p].length} checked, 0 of ${singlePass(p)} points`);
  }
});

test("soft-lock banner appears at 60 points and disappears at 100", async ({ page }) => {
  const sixty = tens.filter((a) => a.phase !== 2).slice(0, 6).map((a) => a.code);
  const extra = tens.filter((a) => a.phase === 2).slice(0, 4).map((a) => a.code);
  expect(sixty.length).toBe(6);
  expect(extra.length).toBe(4);
  await page.evaluate(([key, s]) => localStorage.setItem(key, JSON.stringify(s)), ["cas-planner-v2", stateWith(sixty)]);
  await page.reload();
  await page.waitForSelector("#total");
  await goPhase(page, "#phase/2");
  await expect(page.locator("#phase-lock")).toContainText("Recommended after you reach Bronze (100 points). You have 60.");
  await expect(page.locator("#phase-head")).toHaveClass(/locked/);
  for (const code of extra) await page.click(`#item-${code} .row`);
  expect(num(await page.textContent("#total"))).toBe(100);
  await expect(page.locator("#phase-lock")).toHaveCount(0);
  await expect(page.locator("#phase-head")).not.toHaveClass(/locked/);
});

test("unlock toast fires once when crossing 100 and not again after reload", async ({ page }) => {
  const ninety = tens.slice(0, 9).map((a) => a.code);
  const last = tens[9].code;
  await page.evaluate(([key, s]) => localStorage.setItem(key, JSON.stringify(s)), ["cas-planner-v2", stateWith(ninety)]);
  await page.reload();
  await page.waitForSelector("#total");
  await page.click(`#item-${last} .row`);
  await expect(page.locator("#toast.show")).toHaveText("Bronze reached. Phase 2 is open.");
  await page.reload();
  await page.waitForSelector("#total");
  await page.click(`#item-${last} .row`); // back to 90
  await page.click(`#item-${last} .row`); // crosses 100 again
  expect(num(await page.textContent("#total"))).toBe(100);
  await page.waitForTimeout(400);
  await expect(page.locator("#toast.show")).toHaveCount(0);
});

test("#all still lists all 124 actions", async ({ page }) => {
  await page.evaluate(() => { location.hash = "#all"; });
  await expect(page.locator(".item")).toHaveCount(124);
  const navAll = page.locator('.nav a[href="#all"]');
  await expect(navAll).toHaveAttribute("aria-current", "page");
});

test("page reads without scripts", async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(target);
  await expect(page.locator(".nojs")).toBeVisible();
  // The pre-render is now the home page: explanation, meter, and the four phase cards.
  await expect(page.locator(".home-intro")).toContainText("Civic Action Scorecard");
  expect(await page.locator(".pcard").count()).toBe(4);
  await expect(page.locator("#total")).toHaveText(/0\s*PTS/);
  // The no-JS page still carries all 124 actions in its embedded data.
  const embedded = await page.evaluate(() => JSON.parse(document.getElementById("cas-config").textContent).actions.length);
  expect(embedded).toBe(124);
  await ctx.close();
});

// ---------- home page and navigation ----------
test("home shows explanation, meter, phase cards, and account control within the 390x844 fold", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(target);
  await page.waitForSelector("#total");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector(".pcard");
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.locator(".home-intro")).toContainText("Bronze (100)");
  const cards = page.locator(".pcard");
  await expect(cards).toHaveCount(4);
  const fourth = await cards.nth(3).boundingBox();
  expect(fourth.y + fourth.height).toBeLessThanOrEqual(844); // whole fourth card above the fold
  expect(fourth.x + fourth.width).toBeLessThanOrEqual(390); // no horizontal overflow
  for (let i = 0; i < 4; i++) await expect(cards.nth(i).locator(".pc-go")).toBeInViewport();
  // Account control shows only when a Firebase config is built in; guest builds show the chip alone.
  if (await page.locator("#btn-account").count()) {
    const acct = await page.locator("#btn-account").boundingBox();
    expect(acct.y + acct.height).toBeLessThanOrEqual(844);
  } else {
    await expect(page.locator(".foot")).toContainText("Saving to an account is not set up on this copy.");
  }
  const meter = await page.locator(".meter").boundingBox();
  expect(meter.y + meter.height).toBeLessThanOrEqual(844);
  await ctx.close();
});

test("phase card status pill stays inside its card at every width", async ({ page }) => {
  await page.evaluate(() => { location.hash = "#home"; });
  await page.waitForSelector(".pcard");
  for (const width of [390, 768, 1100, 1400]) {
    await page.setViewportSize({ width, height: 900 });
    const boxes = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".pcard")).map((card) => ({
        card: card.getBoundingClientRect().toJSON(),
        pill: card.querySelector(".pc-pill").getBoundingClientRect().toJSON(),
        name: card.querySelector(".pc-name").getBoundingClientRect().toJSON(),
      }))
    );
    expect(boxes.length).toBe(4);
    for (const { card, pill, name } of boxes) {
      for (const el of [pill, name]) {
        expect(el.left, `width ${width}`).toBeGreaterThanOrEqual(card.left - 1);
        expect(el.right, `width ${width}`).toBeLessThanOrEqual(card.right + 1);
        expect(el.top, `width ${width}`).toBeGreaterThanOrEqual(card.top - 1);
        expect(el.bottom, `width ${width}`).toBeLessThanOrEqual(card.bottom + 1);
      }
    }
    // Equal heights within each row: cards sharing a row top must share a bottom.
    const rows = new Map();
    for (const b of boxes) {
      const key = Math.round(b.card.top);
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key).push(Math.round(b.card.height));
    }
    for (const heights of rows.values()) expect(new Set(heights).size).toBe(1);
  }
});

test("the edition is 2026-2027 and source attribution lives in About and on the print sheet", async ({ page }) => {
  await expect(page.locator(".brand .yr")).toHaveText("2026-2027");
  await expect(page.locator(".brand .yr")).not.toContainText("scorecard");
  await page.click("#item-DE-13 .row");
  await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
  const sheet = await page.textContent("#print");
  expect(sheet).toContain("2026-2027 planning sheet");
  expect(sheet).toContain("2024-2025 Civic Action Scorecard"); // attribution note on the printed page
  await page.click("#btn-about");
  await expect(page.locator("#about-panel")).toContainText("2026-27 Civic Action Planning Sheet");
  await expect(page.locator("#about-panel")).toContainText("2024-2025 Civic Action Scorecard");
  await page.keyboard.press("Escape");
  await page.evaluate(() => { location.hash = "#home"; });
  await page.waitForSelector(".pcard");
  await expect(page.locator(".hero .lbl")).toContainText("2026-2027");
});

test("footer is minimal and attribution lives in the About panel", async ({ page }) => {
  const foot = await page.locator(".foot").textContent();
  expect(foot).toContain("An unofficial student planning tool by Daniel Llobet. Not an MDC or iCED system.");
  expect(foot).toContain("daniel.llobet.v@gmail.com");
  for (const bad of ["Creative Commons", "copyright", "CC BY"]) expect(foot).not.toContain(bad);
  await page.click("#btn-about");
  await expect(page.locator("#about-panel")).toBeVisible();
  await expect(page.locator("#about-panel")).toContainText("Creative Commons Attribution-NonCommercial-ShareAlike");
  await expect(page.locator("#about-panel")).toContainText("Institute for Civic Engagement");
  await expect(page.locator("#about-panel")).toContainText("daniel.llobet.v@gmail.com");
  await page.keyboard.press("Escape");
  await expect(page.locator("#about-panel")).toBeHidden();
});

test("EngageMDC naming holds across the built page", async ({ page }) => {
  const content = await page.content();
  expect(content.toLowerCase()).not.toContain("changemaker hub");
  expect(content.toLowerCase()).not.toContain("givepulse");
  expect(content).toContain("Changemaking 101");
  expect(content).toContain("EngageMDC");
});

test("navigation marks the active view with aria-current", async ({ page }) => {
  await expect(page.locator('.nav a[href="#all"]')).toHaveAttribute("aria-current", "page");
  await page.evaluate(() => { location.hash = "#phase/3"; });
  await page.waitForSelector("#phase-head");
  await expect(page.locator('.nav a[href="#phase/3"]')).toHaveAttribute("aria-current", "page");
  expect(await page.locator('.nav a[aria-current="page"]').count()).toBe(1);
  await page.evaluate(() => { location.hash = "#home"; });
  await page.waitForSelector(".pcard");
  await expect(page.locator('.nav a[href="#home"]')).toHaveAttribute("aria-current", "page");
});

test("Continue opens the lowest phase with unchecked actions", async ({ page }) => {
  await page.evaluate(([key, s]) => localStorage.setItem(key, JSON.stringify(s)),
    ["cas-planner-v2", stateWith(byPhase[1].map((a) => a.code))]);
  await page.evaluate(() => { location.hash = "#home"; });
  await page.reload();
  await page.waitForSelector("#btn-continue");
  await page.click("#btn-continue");
  await page.waitForSelector("#phase-head");
  expect(await page.evaluate(() => location.hash)).toBe("#phase/2");
  await expect(page.locator("#phase-head h2")).toHaveText("Bronze");
});

// ---------- balanced phases: coverage, suggestions, breadth, floor notes ----------
const firstOf = (phase, cat) => byPhase[phase].find((a) => a.cat === cat);
const lowestOf = (phase, cat) => byPhase[phase].filter((a) => a.cat === cat).reduce((b, a) => (!b || a.pts < b.pts ? a : b), null);

test("coverage dots fill as categories get checked in a phase", async ({ page }) => {
  await goPhase(page, "#phase/1");
  await expect(page.locator("#phase-head .cov-dot")).toHaveCount(5);
  await expect(page.locator("#phase-head .cov-dot.on")).toHaveCount(0);
  await page.click(`#item-${firstOf(1, "ES").code} .row`);
  await expect(page.locator("#phase-head .cov-dot.on")).toHaveCount(1);
  await expect(page.locator("#phase-head .cov-cap")).toHaveText("1 of 5 areas");
  await expect(page.locator("#phase-head .covstrip")).toHaveAttribute("aria-label", "Coverage: 1 of 5 areas in this phase");
});

test("suggestion line follows the ES-first priority and disappears at full coverage", async ({ page }) => {
  const de = byPhase[1].filter((a) => a.cat === "DE").slice(0, 2);
  for (const a of de) await page.click(`#item-${a.code} .row`);
  await goPhase(page, "#phase/1");
  const sug = page.locator("#phase-sug");
  await expect(sug).toContainText("Nothing from Environment & Sustainability yet.");
  await expect(sug).toContainText(lowestOf(1, "ES").code);
  await page.click(`#item-${firstOf(1, "ES").code} .row`);
  await expect(sug).toContainText("Nothing from Community Well-Being yet.");
  for (const cat of ["CW", "AC", "SI"]) await page.click(`#item-${firstOf(1, cat).code} .row`);
  await expect(page.locator("#phase-sug")).toHaveCount(0);
  await expect(page.locator("#phase-head .cov-cap")).toHaveText("5 of 5 areas");
});

test("breadth chip counts categories across phases and turns ok at four", async ({ page }) => {
  await expect(page.locator("#breadth-chip")).toHaveText("Breadth: 0 of 5 areas");
  for (const cat of ["DE", "ES", "CW", "AC"]) {
    await page.click(`#item-${scorecard.actions.find((a) => a.cat === cat).code} .row`);
  }
  await expect(page.locator("#breadth-chip")).toHaveText("Breadth: 4 of 5 areas");
  await expect(page.locator("#breadth-chip")).toHaveClass(/on/);
});

test("floor note appears only on phases with a listed exception", async ({ page }) => {
  await goPhase(page, "#phase/3");
  await expect(page.locator("#floor-note")).toContainText("Social Innovation has fewer starter actions");
  for (const p of [1, 2, 4]) {
    await goPhase(page, "#phase/" + p);
    await expect(page.locator("#floor-note")).toHaveCount(0);
  }
});

// ---------- collapsible sections (fresh contexts: real defaults, no harness seed) ----------
test("#all starts collapsed except the featured section, with counts showing", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(target + "#all");
  await page.waitForSelector(".cat");
  await expect(page.locator(".cat")).toHaveCount(5);
  await expect(page.locator(".cat.closed")).toHaveCount(4); // SI is featured and starts open
  await expect(page.locator("#rows-DE")).toBeHidden();
  await expect(page.locator("#cs-DE")).toBeVisible();
  await expect(page.locator("#cs-DE")).toContainText("0 of 40 checked");
  await expect(page.locator("#cat-DE .cat-h")).toHaveAttribute("aria-expanded", "false");
  await ctx.close();
});

test("#phase/2 starts with sections expanded", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(target + "#phase/2");
  await page.waitForSelector(".cat");
  await expect(page.locator(".cat.closed")).toHaveCount(0);
  await expect(page.locator("#rows-DE")).toBeVisible();
  await expect(page.locator("#cat-DE .cat-h")).toHaveAttribute("aria-expanded", "true");
  await ctx.close();
});

test("section toggling persists across reload", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(target + "#all");
  await page.waitForSelector(".cat");
  await page.click("#cat-DE .cat-h");
  await expect(page.locator("#rows-DE")).toBeVisible();
  await page.reload();
  await page.waitForSelector(".cat");
  await expect(page.locator("#cat-DE")).not.toHaveClass(/closed/);
  await expect(page.locator("#cat-ES")).toHaveClass(/closed/);
  await ctx.close();
});

test("search blood expands only Community Well-Being", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(target + "#all");
  await page.waitForSelector(".cat");
  await page.fill("#search", "blood");
  await expect(page.locator("#cat-CW")).not.toHaveClass(/closed/);
  await expect(page.locator("#cat-DE")).toHaveClass(/closed/);
  await expect(page.locator("#cat-CW .item:not(.hidden)")).toHaveCount(3);
  await page.fill("#search", "");
  await expect(page.locator("#cat-CW")).toHaveClass(/closed/);
  await ctx.close();
});

test("keyboard toggles a section header", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(target + "#all");
  await page.waitForSelector(".cat");
  await page.focus("#cat-DE .cat-h");
  await page.keyboard.press("Enter");
  await expect(page.locator("#rows-DE")).toBeVisible();
  await expect(page.locator("#cat-DE .cat-h")).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press(" ");
  await expect(page.locator("#rows-DE")).toBeHidden();
  await expect(page.locator("#cat-DE .cat-h")).toHaveAttribute("aria-expanded", "false");
  await ctx.close();
});

// ---------- navigation (tab bar, responsive labels, More menu) ----------
test("bottom tab bar below 700, pill nav above", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(target);
  await page.waitForSelector("#total");
  await expect(page.locator(".tabbar")).toBeVisible();
  await expect(page.locator(".tabbar a")).toHaveCount(6);
  await expect(page.locator(".nav")).toBeHidden();
  await expect(page.locator('.tabbar a[href="#home"]')).toHaveAttribute("aria-current", "page");
  const bar = await page.locator(".tabbar").boundingBox();
  expect(Math.round(bar.y + bar.height)).toBeGreaterThanOrEqual(843); // pinned to the viewport bottom
  expect(bar.height).toBeGreaterThanOrEqual(44);
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator(".tabbar")).toBeHidden();
  await expect(page.locator(".nav")).toBeVisible();
  await ctx.close();
});

test("sign-in label matches the width", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(target);
  await page.waitForSelector("#btn-account");
  const label = () => page.evaluate(() => {
    const b = document.getElementById("btn-account");
    return {
      after: getComputedStyle(b, "::after").content,
      spanShown: getComputedStyle(b.querySelector(".al")).display !== "none",
    };
  });
  let l = await label();
  expect(l.spanShown).toBe(false);
  expect(l.after).toBe('"Sign in"');
  await page.setViewportSize({ width: 900, height: 900 });
  l = await label();
  expect(l.spanShown).toBe(false);
  expect(l.after).toBe('"Sign in to save"');
  await page.setViewportSize({ width: 1280, height: 900 });
  l = await label();
  expect(l.spanShown).toBe(true);
  expect(l.after).toBe("none");
  await ctx.close();
});

test("More menu folds the tools between 1100 and 1279", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(target);
  await page.waitForSelector("#total");
  const more = page.locator("#more-menu");
  await expect(more).toBeVisible();
  await page.click("#more-menu summary");
  await expect(page.locator(".more-list")).toBeVisible();
  await expect(page.locator(".more-list [data-more]")).toHaveCount(6); // five tools plus About
  await page.keyboard.press("Escape");
  await expect(page.locator(".more-list")).toBeHidden();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(more).toBeHidden();
  await ctx.close();
});

test("top bar stays one row under 64px from 1100 to 1400", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(target);
  await page.waitForSelector("#total");
  for (const width of [1100, 1200, 1280, 1400]) {
    await page.setViewportSize({ width, height: 900 });
    const m = await page.evaluate(() => {
      const bar = document.querySelector(".top-in");
      const b = bar.getBoundingClientRect();
      const tops = Array.from(bar.children)
        .filter((k) => getComputedStyle(k).display !== "none")
        .map((k) => Math.round(k.getBoundingClientRect().top - b.top));
      return { h: b.height, tops };
    });
    expect(m.h, `bar height at ${width}`).toBeLessThan(64);
    for (const t of m.tops) expect(t, `child top at ${width}`).toBeLessThan(20);
  }
  await ctx.close();
});

// ---------- skill chips, featured SI, browse card, nav fit ----------
const SKILL_CODES = ["CW-13B", "CW-13C", "DE-14B", "DE-14C", "ES-18B", "ES-18C", "SI-5B", "SI-5C"];

test("skill-based trainings carry a visible chip and a filter", async ({ page }) => {
  expect(scorecard.actions.filter((a) => a.skill).map((a) => a.code).sort()).toEqual(SKILL_CODES);
  await expect(page.locator(".badge.skill")).toHaveCount(8);
  for (const c of SKILL_CODES) await expect(page.locator(`#item-${c} .badge.skill`)).toHaveText("Skill-based training");
  await page.click('.chip[data-f="skill"]');
  const visible = await page.locator(".item:not(.hidden)").evaluateAll((els) => els.map((e) => e.dataset.code).sort());
  expect(visible).toEqual(SKILL_CODES);
  await page.click('.chip[data-f="all"]');
  await page.click("#item-DE-14B .exp");
  await expect(page.locator("#item-DE-14B .det")).toContainText("Counts as a skills-based training or workshop.");
});

test("Social Innovation is featured: open by default, tagged, tinted", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(target + "#all");
  await page.waitForSelector(".cat");
  await expect(page.locator("#cat-SI")).not.toHaveClass(/closed/);
  await expect(page.locator("#cat-SI .cat-h .badge.featured")).toHaveText("Featured");
  await expect(page.locator("#rows-SI")).toBeVisible();
  const bg = await page.locator("#cat-SI .item .row").first().evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).toBe("rgba(122, 77, 184, 0.08)");
  await ctx.close();
});

test("home offers a prominent browse-everything card", async ({ page }) => {
  await page.evaluate(() => { location.hash = "#home"; });
  await page.waitForSelector("#browse-card");
  await expect(page.locator("#browse-card h2")).toHaveText("Prefer to see everything?");
  await expect(page.locator("#browse-card p")).toHaveText("Browse all 124 actions in one list, organized by category.");
  await expect(page.locator("#browse-card .btn")).toHaveText("Browse the full list");
  await page.click("#browse-card");
  await page.waitForSelector(".cat");
  expect(await page.evaluate(() => location.hash)).toBe("#all");
  await expect(page.locator(".item")).toHaveCount(124);
});

test("nav labels never truncate and the page never scrolls sideways", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(target);
  await page.waitForSelector("#total");
  for (const width of [360, 390, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    const m = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll(".nav a, .tabbar a"))
        .filter((a) => a.offsetParent !== null)
        .map((a) => ({ label: a.textContent, over: a.scrollWidth > a.clientWidth }));
      return { links, pageOver: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    expect(m.links.length, `links visible at ${width}`).toBeGreaterThan(0);
    for (const l of m.links) expect(l.over, `"${l.label}" truncated at ${width}`).toBe(false);
    expect(m.pageOver, `horizontal overflow at ${width}`).toBeLessThanOrEqual(0);
  }
  await ctx.close();
});

test("How it works explains EngageMDC submission and the planner", async ({ page }) => {
  await page.click('.nav a[href="#how"]');
  await page.waitForSelector("#how-view");
  await expect(page.locator('.nav a[href="#how"]')).toHaveAttribute("aria-current", "page");
  const t = await page.locator("#how-view").textContent();
  expect(t).toContain("engage.mdc.edu");
  expect(t).toContain("Add Impact");
  expect(t).toContain("So What");
  expect(t).toContain("This planner does not submit anything for you. Submissions only count in EngageMDC.");
  expect(t).toContain("daniel.llobet.v@gmail.com");
  await expect(page.locator('.foot a[href="#how"]')).toHaveText("How it works");
  await page.evaluate(() => { location.hash = "#home"; });
  await page.waitForSelector(".how-link a");
  await expect(page.locator('.how-link a')).toHaveText("How it works");
});

// ---------- accounts (build variants; no real Firebase project needed) ----------
test("guest build: empty firebase config hides accounts and everything still works", async ({ browser }) => {
  const out = path.join(root, ".guest-test.html");
  execSync("node scripts/build.mjs", { cwd: root, env: { ...process.env, FIREBASE_CONFIG: "no-such-file.json", OUT: ".guest-test.html" } });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("file://" + out);
  await page.waitForSelector("#total");
  expect(await page.content()).not.toContain("gstatic.com/firebasejs");
  expect(await page.locator("#btn-account").count()).toBe(0);
  await expect(page.locator(".foot")).toContainText("Saving to an account is not set up on this copy.");
  await expect(page.locator("#save-chip")).toHaveText("Saved on this device only");
  await page.evaluate((seed) => { localStorage.setItem("cas-ui-v1", JSON.stringify(seed)); location.hash = "#all"; }, OPEN_ALL_SECTIONS);
  await page.reload();
  await page.waitForSelector(".item");
  await page.click("#item-DE-11 .row");
  expect(num(await page.textContent("#total"))).toBe(10);
  expect(errors).toEqual([]);
  fs.unlinkSync(out);
  await ctx.close();
});

test("account build: control renders, and a blocked SDK never throws", async ({ browser }) => {
  const cfgFile = path.join(root, ".fake-firebase.json");
  fs.writeFileSync(cfgFile, JSON.stringify({ apiKey: "fake-key", authDomain: "fake.firebaseapp.com", projectId: "fake", appId: "1:1:web:1" }));
  const out = path.join(root, ".account-test.html");
  execSync("node scripts/build.mjs", { cwd: root, env: { ...process.env, FIREBASE_CONFIG: ".fake-firebase.json", OUT: ".account-test.html" } });
  const ctx = await browser.newContext();
  await ctx.route(/gstatic\.com/, (r) => r.abort()); // simulate the SDK failing to load
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("file://" + out);
  await page.waitForSelector("#total");
  await expect(page.locator("#btn-account")).toHaveText("Sign in with Google to save progress");
  await page.click("#btn-about");
  await expect(page.locator("#about-panel")).toContainText("Firebase project owned by Daniel Llobet");
  await page.keyboard.press("Escape");
  await page.click("#btn-account");
  await expect(page.locator("#toast")).toContainText("did not load");
  await page.evaluate((seed) => { localStorage.setItem("cas-ui-v1", JSON.stringify(seed)); location.hash = "#all"; }, OPEN_ALL_SECTIONS);
  await page.reload();
  await page.waitForSelector(".item");
  await page.click("#item-DE-11 .row");
  expect(num(await page.textContent("#total"))).toBe(10);
  expect(errors).toEqual([]);
  fs.unlinkSync(cfgFile); fs.unlinkSync(out);
  await ctx.close();
});

test("import restores progress from a phase view", async ({ page }) => {
  await page.click("#item-AC-5 .row");
  const [download] = await Promise.all([page.waitForEvent("download"), page.click("#btn-export")]);
  const file = await download.path();
  await page.evaluate(() => { localStorage.clear(); location.hash = "#phase/3"; });
  await page.reload();
  await page.waitForSelector("#phase-head");
  await page.setInputFiles("#file-import", file);
  await expect(page.locator("#toast")).toContainText("imported");
  const ac5 = scorecard.actions.find((a) => a.code === "AC-5").pts;
  expect(num(await page.textContent("#total"))).toBe(ac5);
});
