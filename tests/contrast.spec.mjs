// WCAG contrast gate for the MDC theme, both color schemes.
// Text pairs must reach 4.5:1; UI pairs 3:1 (every pair below is text, so 4.5 applies).
import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = process.env.BASE_URL || "file://" + path.join(root, "index.html");

function parseColor(s) {
  s = s.trim();
  let m = /^#([0-9a-f]{6})$/i.exec(s);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(s);
  if (m) return [+m[1], +m[2], +m[3]];
  throw new Error("Unparseable color: " + s);
}
function luminance([r, g, b]) {
  const f = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function ratio(a, b) {
  const la = luminance(parseColor(a)), lb = luminance(parseColor(b));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

for (const scheme of ["light", "dark"]) {
  test(`contrast pairs pass in the ${scheme} theme`, async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: scheme, viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto(target);
    await page.waitForSelector(".pcard");
    const d = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      const v = (n) => cs.getPropertyValue(n).trim();
      const c = (sel, prop) => getComputedStyle(document.querySelector(sel))[prop];
      return {
        bg: v("--bg"), surface: v("--surface"), ink: v("--ink"), ink2: v("--ink-2"),
        primary: v("--primary"), primaryContrast: v("--primary-contrast"),
        catText: { DE: v("--de-text"), ES: v("--es-text"), CW: v("--cw-text"), AC: v("--ac-text"), SI: v("--si-text"), IA: v("--ia-text") },
        topbarBg: c(".top", "backgroundColor"),
        topbarText: c(".brand h1", "color"),
        link: c(".foot a", "color"),
        pillFg: c(".pcard .pc-pill", "color"),
        pillBg: c(".pcard .pc-pill", "backgroundColor"),
        laterPillFg: c(".pcard.later .pc-pill", "color"),
        laterCardBg: c(".pcard.later", "backgroundColor"),
        tabFg: c(".tabbar a", "color"),
        tabBg: c(".tabbar", "backgroundColor"),
      };
    });
    expect(ratio(d.ink, d.bg), "body text on bg").toBeGreaterThanOrEqual(4.5);
    expect(ratio(d.ink2, d.surface), "secondary text on surface").toBeGreaterThanOrEqual(4.5);
    expect(ratio(d.topbarText, d.topbarBg), "top bar text on its background").toBeGreaterThanOrEqual(4.5);
    expect(ratio(d.primaryContrast, d.primary), "primary button text on primary").toBeGreaterThanOrEqual(4.5);
    expect(ratio(d.link, d.bg), "link on bg").toBeGreaterThanOrEqual(4.5);
    for (const [id, col] of Object.entries(d.catText)) {
      expect(ratio(col, d.surface), `${id} code on surface`).toBeGreaterThanOrEqual(4.5);
    }
    expect(ratio(d.pillFg, d.pillBg), "status pill text on its background").toBeGreaterThanOrEqual(4.5);
    expect(ratio(d.laterPillFg, d.laterCardBg), "later pill text on its background").toBeGreaterThanOrEqual(4.5);
    expect(ratio(d.tabFg, d.tabBg), "tab label on tab bar").toBeGreaterThanOrEqual(4.5);
    if (scheme === "light") expect(d.topbarBg).toBe("rgb(0, 50, 160)"); // MDC Blue, Pantone 286
    const fonts = await page.evaluate(async () => {
      await document.fonts.ready;
      return {
        body: document.fonts.check("15px Jost"),
        heading: document.fonts.check('600 20px "EB Garamond"'),
      };
    });
    expect(fonts.body, "Jost loaded for body text").toBe(true);
    expect(fonts.heading, "EB Garamond loaded for headings").toBe(true);
    await ctx.close();
  });
}
