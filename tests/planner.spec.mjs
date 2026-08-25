// End-to-end checks for the planner. Runs against the built index.html.
// Local:   npm test                      (opens the file directly)
// Hosted:  BASE_URL=https://user.github.io/civic-action-planner/ npm test
import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = process.env.BASE_URL || "file://" + path.join(root, "index.html");
const num = (s) => parseInt(String(s).replace(/[^0-9]/g, ""), 10);

test.beforeEach(async ({ page }) => {
  await page.goto(target);
  await page.waitForSelector("#total");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector("#total");
});

test("loads every action with the right point totals", async ({ page }) => {
  expect(num(await page.textContent("#total"))).toBe(0);
  const items = await page.locator(".item").count();
  expect(items).toBe(109);
  const heads = await page.locator(".cat-h .cs").allTextContents();
  expect(heads.join(" ")).toContain("/ 390 pts");
  expect(heads.join(" ")).toContain("/ 280 pts");
  expect(heads.join(" ")).toContain("/ 350 pts");
  expect(heads.join(" ")).toContain("/ 160 pts");
  expect(heads.join(" ")).toContain("/ 115 pts");
});

test("toggles, multipliers, and the instructor item change the total", async ({ page }) => {
  await page.click("#item-DE-13 .row");
  expect(num(await page.textContent("#total"))).toBe(20);
  await page.click("#item-DE-11 .row");
  await page.click('#item-DE-11 .stp button[data-d="1"]');
  expect(num(await page.textContent("#total"))).toBe(40);
  await page.click("#item-IA-1 .row");
  await page.selectOption("#item-IA-1 select", "15");
  expect(num(await page.textContent("#total"))).toBe(55);
  await page.click("#item-DE-13 .row");
  expect(num(await page.textContent("#total"))).toBe(35);
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
    const slim = { v: 2, name: "Shared Person", counts: { "DE-13": 1, "CW-4": 1 }, ia: 10, sub: {}, appr: { "CW-4": true } };
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

test("page reads without scripts", async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(target);
  await expect(page.locator(".nojs")).toBeVisible();
  expect(await page.locator(".item").count()).toBe(109);
  await ctx.close();
});
