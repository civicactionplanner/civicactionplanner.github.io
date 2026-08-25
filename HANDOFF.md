# Handoff to Claude Code

Unzip this folder, open a terminal inside it, start Claude Code, and paste the prompt below. Before that, make sure two things are true on your machine: the GitHub CLI is installed and logged in (`gh auth login`), and Node 18 or newer is installed (`node -v`). Claude Code can install both for you if you tell it to, but the GitHub login step needs you at the keyboard once.

---

Paste this into Claude Code:

```
This folder is a finished single-file web app (see CLAUDE.md first). I want it live on GitHub Pages so people can test it from a link.

Do the following, in order, and stop and tell me if any step fails:

1. Run `gh auth status`. If I am not logged in, tell me to run `gh auth login` and wait.
2. `npm install` and `npx playwright install chromium`.
3. `npm run build` (this regenerates index.html with the no-JavaScript pre-render). If Playwright is missing, use `npm run build:quick` and say so.
4. `npm test`. All tests must pass before anything is pushed. If one fails, show me the failure and propose the fix; do not change test expectations to make them pass.
5. `bash scripts/deploy.sh civic-action-planner` to create the public repository under my GitHub account, push, turn on GitHub Pages from the main branch, wait for the site to answer, and run the test suite against the live URL.
6. Open the live URL in a browser, take a screenshot, and confirm the total shows 0 PTS, the Democratic Engagement header shows "/ 390 pts", and clicking an action changes the total.
7. Print the live URL and the repository URL, and list anything you changed.

Do not add analytics, sign-in, a build framework, or any dependency beyond what package.json lists. Do not edit index.html by hand.
```

---

## What "done" looks like

- A public repository named `civic-action-planner` under your GitHub account.
- A live page at `https://<your-username>.github.io/civic-action-planner/` that shows 0 PTS and 109 actions.
- Nine passing Playwright tests, run once locally and once against the live URL.

## Sharing it after that

Send people the live URL, not the HTML file. A link opens on any phone or laptop. The file itself opens fine in a desktop browser but many phones, mail apps, and previewers refuse to run scripts inside attachments, which is why the earlier attachment looked broken to whoever received it.

## Later changes

Edit `data/planner-config.json` (text, Hub link, award tiers) or `data/civic-action-scorecard-2024-2025.json` (actions and points), then `npm run build && npm test`, commit, and push. GitHub Pages redeploys within a minute or two. Ask Claude Code to do this for you with a sentence like: "Update the edition to 2025-2026, change DE-28 to 15 points, rebuild, test, and push."
