import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = process.env.TUTDIR || path.dirname(fileURLToPath(import.meta.url));
const sched = JSON.parse(fs.readFileSync(path.join(HERE, "schedule.json"), "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: path.join(HERE, "rec"), size: { width: 1920, height: 1080 } },
});
const page = await context.newPage();
context.on("page", (p) => { if (p !== page) p.close().catch(() => {}); });
await page.goto("file://" + path.join(HERE, "stage.html"));
const frame = async () => {
  for (let i = 0; i < 100; i++) {
    const f = page.frames().find((f) => /civic-?action-?planner/.test(f.url()) && f.url().includes("index.html"));
    if (f) return f;
    await sleep(100);
  }
  throw new Error("iframe never appeared");
};
let f = await frame();
await f.waitForSelector("#total", { timeout: 30000 });
await f.evaluate(() => {
  localStorage.clear();
  localStorage.setItem("cas-ui-v1", JSON.stringify({ sections: { all: { DE: false, ES: false, CW: false, AC: false, SI: false } }, tour: "done" }));
});
await f.evaluate(() => location.reload());
await sleep(500);
f = await frame();
await f.waitForSelector("#total", { timeout: 30000 });
await sleep(800);

const jsClick = (sel) => f.evaluate((q) => {
  const el = document.querySelector(q);
  if (!el) throw new Error("missing " + q);
  el.click();
}, sel);
await f.evaluate(() => document.fonts.ready.then(() => {}));
const t0 = Date.now();
await page.evaluate(() => window.go());
const until = async (s) => { const ms = t0 + s * 1000 - Date.now(); if (ms > 0) await sleep(ms); };
const at = (sceneStart, offset, fn) => ({ t: sceneStart + offset, fn });

// build a flat action timeline
const acts = [];
for (const sc of sched.scenes) {
  const s = sc.start;
  // short caption beats: one sentence at a time, timed proportionally within the audio
  const STEPS = { browse: 1, check: 1, goal: 1, plan: 1, detail: 1, funnel: 2, phone: 3, close: 4 };
  const SIDES = { intro: "right", browse: "left", check: "right", goal: "right", plan: "left", detail: "left", funnel: "right", phone: "left", close: "right" };
  if (SIDES[sc.id]) acts.push(at(s, Math.max(0, s === 0 ? 0 : -0.0) + 0.02, async () => { await page.evaluate((d) => window.setSide(d), SIDES[sc.id]); }));
  if (STEPS[sc.id]) acts.push(at(s, 0.05, async () => { await page.evaluate((n) => window.setStep(n), STEPS[sc.id]); }));
  const voiceStart = Math.max(0, ((sc.talk && sc.talk[0] && sc.talk[0][0]) || 0) - 0.2);
  const chunks = (sc.caption || sc.text).split(/(?<=[.?!])\s+/).filter(Boolean);
  const totalChars = chunks.reduce((a, c) => a + c.length, 0);
  let cum = 0;
  for (const c of chunks) {
    const off = voiceStart + (cum / totalChars) * (sc.audio - voiceStart);
    acts.push(at(s, off, async () => { await page.evaluate((txt) => window.setBubble(txt), c); }));
    cum += c.length;
  }
  acts.push(at(s, 0, async () => { await page.evaluate((e) => window.speak(e), sc.env); }));
  if (sc.id === "intro") {
    acts.push(at(s, 0.15, async () => { await page.evaluate(() => window.enter()); }));
    acts.push(at(s, 3.0, async () => { await page.evaluate(() => window.hideIntro()); }));
    acts.push(at(s, 4.6, async () => { await f.evaluate(() => window.scrollTo({ top: 480, behavior: "smooth" })); }));
    acts.push(at(s, 6.6, async () => { await f.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" })); }));
  }
  if (sc.id === "browse") {
    acts.push(at(s, 0.3, async () => { await f.evaluate(() => { location.hash = "#all"; }); }));
    acts.push(at(s, 1.4, async () => { await f.evaluate(() => window.scrollTo({ top: 700, behavior: "smooth" })); }));
    acts.push(at(s, 3.2, async () => { await f.evaluate(() => window.scrollTo({ top: 1600, behavior: "smooth" })); }));
    
  }
  if (sc.id === "check") {
    acts.push(at(s, 0.2, async () => { await f.evaluate(() => { const el = document.getElementById("item-DE-1A"); if (el) el.scrollIntoView({ block: "center", behavior: "smooth" }); }); }));
    acts.push(at(s, 1.3, async () => { await jsClick("#item-DE-1A .row"); }));
    acts.push(at(s, 2.4, async () => { await jsClick("#item-DE-1B .row"); }));
    acts.push(at(s, 3.6, async () => { await f.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" })); }));
  }
  if (sc.id === "goal") {
    acts.push(at(s, 0.8, async () => { await jsClick("#btn-goal"); }));
    acts.push(at(s, 2.2, async () => { await f.selectOption("#goal-award", "Silver"); }));
    acts.push(at(s, 3.4, async () => { await f.fill("#goal-date", "2027-04-30"); }));
    acts.push(at(s, 5.2, async () => { await jsClick("#goal-save"); }));
  }
  if (sc.id === "plan") {
    acts.push(at(s, 0.5, async () => { await f.evaluate(() => { const el = document.getElementById("item-DE-2"); if (el) el.scrollIntoView({ block: "center", behavior: "smooth" }); }); }));
    acts.push(at(s, 1.4, async () => { await jsClick("#item-DE-2 .planb"); }));
    acts.push(at(s, 2.4, async () => { await jsClick("#item-DE-3 .planb"); }));
    acts.push(at(s, 3.7, async () => { await f.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" })); }));
  }
  if (sc.id === "detail") {
    acts.push(at(s, 0.4, async () => { await f.evaluate(() => { const el = document.getElementById("item-DE-11"); if (el) el.scrollIntoView({ block: "center", behavior: "smooth" }); }); }));
    acts.push(at(s, 1.8, async () => { await jsClick("#item-DE-11 .exp"); }));
    acts.push(at(s, 2.6, async () => { await f.evaluate(() => { const el = document.getElementById("item-DE-11"); if (el) el.scrollIntoView({ block: "center", behavior: "smooth" }); }); }));
    acts.push(at(s, 3.6, async () => { await f.type('#item-DE-11 textarea[data-key="what"]', "I watched the county commission meeting on Tuesday. They debated the new transit budget.", { delay: 26 }); }));
  }
  if (sc.id === "funnel") {
    acts.push(at(s, 0.6, async () => { await f.evaluate(() => { const b = document.querySelector('#item-DE-11 [data-act="hub"]'); if (b) b.scrollIntoView({ block: "center", behavior: "smooth" }); }); }));
    acts.push(at(s, 1.6, async () => { await jsClick('#item-DE-11 [data-copy="what"]'); }));
    acts.push(at(s, 6.0, async () => { await jsClick('#item-DE-11 [data-act="hub"]'); }));
  }
  if (sc.id === "phone") {
    acts.push(at(s, 0.4, async () => { await f.evaluate(() => { location.hash = "#how"; window.scrollTo(0, 0); }); }));
    acts.push(at(s, 3.0, async () => { await f.evaluate(() => window.scrollTo({ top: 520, behavior: "smooth" })); }));
    acts.push(at(s, 5.6, async () => { await f.evaluate(() => window.scrollTo({ top: 1040, behavior: "smooth" })); }));
  }
  if (sc.id === "close") {
    acts.push(at(s, 0.4, async () => { await f.evaluate(() => { location.hash = "#home"; window.scrollTo(0, 0); }); }));
    acts.push(at(s, 1.6, async () => { await f.evaluate(() => { const el = document.getElementById("poster"); if (el) el.scrollIntoView({ block: "center", behavior: "smooth" }); }); }));
    acts.push(at(s, 6.4, async () => { await page.evaluate(() => window.showEnd()); }));
  }
}
acts.sort((a, b) => a.t - b.t);

for (const a of acts) {
  await until(a.t);
  try { await a.fn(); } catch (e) { console.error("action @" + a.t + "s failed:", String(e).slice(0, 700)); }
}
await until(sched.total + 0.8);

const videoPath = await page.video().path();
await context.close();
await browser.close();
const out = path.join(HERE, "stage-video.webm");
fs.copyFileSync(videoPath, out);
console.log("video:", out, fs.statSync(out).size, "bytes");
