# CLAUDE.md

Context for Claude Code (or any developer) working in this repository.

## What this is

A single-file web app, `index.html`, for Miami Dade College students working through iCED's Civic Action Scorecard. It lists all 124 actions from iCED's 2026-27 Civic Action Planning Sheet with point values, shows what to submit for each, holds What / So what / Now what drafts, tracks Submitted and Approved status, and totals points against Bronze 100 / Silver 200 / Gold 300. Everything is stored in the browser's localStorage. There is no backend, no account, no analytics, and no network call other than Google Fonts.

It is an unofficial student project by Daniel Llobet. Official submissions happen in EngageMDC (https://engage.mdc.edu). Keep that distinction in every piece of copy.

## Layout

- `src/planner.template.html`: the app. `__CONFIG__` is replaced with JSON at build time; `__PRERENDER__` is replaced with the zero-state markup so the page reads without JavaScript.
- `data/planner-config.json`: title, edition, Hub link, tiers, credit, license, disclaimer text.
- `data/civic-action-scorecard-2026-2027.json`: categories and the 124 actions (code, category, phase, title, pts, max, unlimited, skill, req, doc, what, sowhat, nowwhat, aside). Titles and points transcribed from the 2026-27 Civic Action Planning Sheet; documentation and reflection details carried from the 2024-25 scorecard, with fresh text for the 16 new actions.
- `scripts/build.mjs`: injects the data into the template and writes `index.html`. `--prerender` needs Playwright.
- `scripts/deploy.sh`: creates the GitHub repo with `gh`, pushes, enables Pages on `main` at `/`, waits for HTTP 200, runs the tests against the live URL.
- `tests/planner.spec.mjs`: Playwright end-to-end suite (totals, multipliers, details, persistence, export/import, share link, search, print sheet, no-JS rendering).
- `index.html`: the built artifact. It is committed on purpose so GitHub Pages can serve it with no build step.

## Commands

```
npm install
npx playwright install chromium   # once
npm run build                     # data + template -> index.html (with pre-render)
npm test                          # local suite against index.html
BASE_URL=https://civicactionplanner.github.io/ npm test   # against the live site
npm run deploy                    # create repo, push, enable Pages, verify
```

## Rules

- Never edit `index.html` by hand; edit the template or the data and rebuild. The build validates codes, categories, and point integrity and recomputes each category's "possible" total.
- Keep the page a single file with no runtime dependencies. Students open it from email attachments and locked-down campus machines.
- Do not add tracking, sign-in, or any data collection. If someone asks for real submissions inside the tool, that is a separate project (MDC SSO, upload storage, staff review queue, FERPA); write it up rather than bolting it on.
- Keep the CC BY-NC-SA 4.0 attribution in the footer and `LICENSE.md`; the scorecard content is iCED's.
- Design tokens live at the top of the template's `<style>`, on bare `:root` first, then overridden in the two dark blocks (the build fails if a token exists only in a dark block). The palette is MDC-branded: `--primary` #0032A0 (MDC Blue, chrome only: top bar, links, primary buttons, meter fill, active tab, focus), `--accent` #C8690A (warm highlights: status pills, unlock toasts; sampled fallback, see docs/iced-color-sample.md), a navy dark theme, and category hues `--de/--es/--cw/--ac/--si/--ia` with 12% `-soft` tints and darker or lighter `-text` variants used wherever the hue is text (codes, checked point values) so tests/contrast.spec.mjs passes 4.5:1. Typefaces: EB Garamond (display, lining tabular figures) and Jost (body), MDC's Garamond and Futura as fallbacks. If you change a category hue, update its `-soft` and `-text` pair, re-check adjacent pairs for color-vision separation, and keep the contrast suite green.
- After any change: `npm run build && npm test`, then read the diff of `index.html` size and the test output before committing.
