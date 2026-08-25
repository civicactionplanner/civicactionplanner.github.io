# Civic Action Scorecard Planner

A single-file web app for Miami Dade College students working through the iCED Civic Action Scorecard. It lists all 109 actions from the 2024-2025 scorecard with their point values, shows exactly what to submit for each one, holds a What / So what / Now what draft per action, and keeps a live total against the Bronze (100), Silver (200), and Gold (300) award levels.

What it is not: a submission system. Points are only awarded when a student submits documentation and a reflection in the Changemaker Hub (EngageMDC) and iCED staff approve it. The planner prepares that submission and tracks its status; it never sends anything anywhere.

## Files

- `index.html`: the whole app, built. HTML, CSS, JavaScript, and the scorecard data in one file. No server needed. It works when opened directly from a computer and when hosted on any static web host.
- `data/civic-action-scorecard-2024-2025.json`: the scorecard data on its own (categories, actions, points, multipliers, documentation requirements, reflection prompts, resource notes) for anyone who wants to build something else on top of it.
- `data/planner-config.json`: the text and links shown around the data (edition label, Changemaker Hub link, award tiers, credit, license, disclaimer).
- `src/planner.template.html`, `scripts/build.mjs`: the template and the build that turns data plus template into `index.html`.
- `tests/planner.spec.mjs`: the Playwright test suite. `scripts/deploy.sh`: one-command GitHub Pages deployment. `HANDOFF.md`: the prompt to give Claude Code.

## Host it in ten minutes

Option A, GitHub Pages with one command (free, permanent URL, no server): install the GitHub CLI, run `gh auth login`, then `bash scripts/deploy.sh`. It creates the repository if needed, pushes, turns on Pages, waits for the site, and runs the tests against it. This copy deploys to `https://civicactionplanner.github.io/`; a fork can pass its own repository name (`bash scripts/deploy.sh my-planner` gives `https://<your-username>.github.io/my-planner/`, and a repository named `<your-username>.github.io` gives a root URL).

Option A by hand: create a public repository, upload this folder, open Settings > Pages, set Source to "Deploy from a branch" with `main` and the root folder, and save. The page is live a minute later.

Option B, any static host: Netlify Drop (drag the file into app.netlify.com/drop), Cloudflare Pages, or an MDC-hosted web folder. There is nothing to configure.

Option C, no hosting at all: email the file. Students double-click it and it runs in their browser. Fonts fall back to system fonts if they are offline; everything else works.

## How students use it

1. Check an action when it is done. Repeatable actions (marked "X2" in the scorecard) get a small ×1 / ×2 counter; voting (DE-29) counts per election; the instructor-assigned item (IA-1) has a 5 / 10 / 15 point selector.
2. Open an action (the chevron on the right) to see what to submit, the three reflection prompts with a draft box under each, and the resources and notes from the scorecard. "Copy reflection for the Hub" puts a formatted version on the clipboard for the Add Impact form.
3. Mark the action "Submitted" once it is in the Hub and "Approved" once iCED approves it. The summary shows checked, submitted, and approved points separately.
4. "Print planning sheet" produces a one-page sheet in the format of the scorecard's Appendix A with subtotals, the award level, and signature lines. Print to PDF and attach it, or hand it in.
5. Progress is stored in the browser on that device. "Export backup" downloads a JSON file to keep or move to another device; "Import backup" restores it. "Copy share link" produces a link carrying only the checks and statuses (not drafts) so a student can show an advisor where they stand.

## How iCED can adapt it

Edit the two files in `data/`, then run `npm install` once and `npm run build` (or, without Node, edit the JSON block near the bottom of `index.html` directly; it is the same data). The fields:

- `edition`, `title`, `hubName`, `hubUrl`, `credit`, `license`, `disclaimer`: the text shown in the header and footer.
- `tiers`: award names and thresholds.
- `cats`: the six categories with their `id`, `name`, `tag` (subtitle), and `possible` (maximum points shown in the tiles).
- `actions`: one entry per action with `code`, `cat`, `title`, `pts`, `max` (times the action can be repeated for points), `unlimited` (true for DE-29), `variable` (true for IA-1), `req` (minimum hours or conditions), `doc` (documentation required), `what` / `sowhat` / `nowwhat` (reflection prompts), and `aside` (resources and notes, one line each). Add a `url` to a resource by writing the address into its line; students can copy it.

A new scorecard edition is a matter of editing the data files and rebuilding. Nothing in the template references specific actions. The build refuses duplicate codes, unknown categories, and non-integer points, and it recomputes each category's maximum.

## Testing

`npm test` runs nine Playwright checks against `index.html`: every action loads with the right category maximums, toggles and multipliers change the total, award levels move, the details panel saves drafts and statuses, progress survives a reload, export and import round-trip, the share link loads a snapshot, search and filters narrow the list, the print sheet lists checked actions, and the page still reads with JavaScript off. Set `BASE_URL` to run the same suite against the live site.

## Privacy

No accounts, no analytics, no network calls except loading three Google Fonts. Everything a student types stays in their browser's local storage until they export it. Clearing site data in the browser erases it, which is why the export exists.

## If iCED wants real submissions inside this tool

The planner already holds the structured pieces a submission system needs: the action catalog, per-action documentation rules, the reflection prompts, and a per-student status model (checked, submitted, approved). Turning it into a system of record would add three things it deliberately does not have: sign-in with MDC credentials, storage for uploads and reflections outside the browser, and a staff review queue. That is a backend project with FERPA implications and belongs with MDC IT, or inside the existing GivePulse contract as a custom Impact form. Until then the honest division of labor is: the planner for preparation and progress, the Changemaker Hub for submission and approval.

## Address history

The planner moved to https://civicactionplanner.github.io/ on August 25, 2026, when the repository was transferred to the civicactionplanner organization. The original address, https://danielllobetv-a11y.github.io/civic-action-planner/, now redirects there and forwards shared progress links.

## Design

The planner uses Miami Dade College's brand colors and typefaces without any MDC or iCED logo, seal, or wordmark: MDC Blue #0032A0 for the top bar, links, and primary controls, MDC Gray for secondary text, a navy dark theme, and a warm orange accent (#C8690A) for phase status highlights, chosen by sampling the iCED site's computed styles (docs/iced-color-sample.md). Type is EB Garamond for display and Jost for text, falling back to MDC's official Garamond and Futura. Category hues carry identity on stripes and meters; where a hue is used as text it switches to a darker or lighter variant so every pair passes WCAG contrast, enforced by tests/contrast.spec.mjs in both themes.

## License

The action list, point values, documentation requirements, and reflection prompts come from The 2024-2025 Civic Action Scorecard, copyright 2017-2025 Institute for Civic Engagement & Democracy, Miami Dade College, used under the Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License. This planner is shared under the same license. Built by Daniel Llobet, School for Advanced Studies, MDC Wolfson.
