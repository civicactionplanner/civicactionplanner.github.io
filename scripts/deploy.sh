#!/usr/bin/env bash
# Creates or updates the GitHub repository, pushes this folder, turns on GitHub Pages, and waits until the site answers.
# Requirements: git, GitHub CLI (gh) logged in (`gh auth login`), Node 18+ for the build.
# Usage: bash scripts/deploy.sh [repo-name] [--private]
# A repo named <owner>.github.io is a user or organization site served at https://<owner>.github.io/;
# any other name is a project site at https://<owner>.github.io/<repo-name>/. The live URL is read
# from the Pages API either way. This copy defaults to the civicactionplanner organization site.
set -euo pipefail

REPO_NAME="${1:-civicactionplanner.github.io}"
VISIBILITY="--public"
if [[ "${2:-}" == "--private" ]]; then VISIBILITY="--private"; fi

cd "$(dirname "$0")/.."

command -v gh >/dev/null || { echo "GitHub CLI (gh) is not installed. See https://cli.github.com/"; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "Run: gh auth login   (then re-run this script)"; exit 1; }
# For a *.github.io repo the owner is baked into the name; otherwise deploy under the signed-in user.
if [[ "$REPO_NAME" == *.github.io ]]; then OWNER="${REPO_NAME%.github.io}"; else OWNER="$(gh api user --jq .login)"; fi

echo "== Building index.html"
if [[ -d node_modules/playwright ]]; then node scripts/build.mjs --prerender; else node scripts/build.mjs; fi
test -s index.html

echo "== Preparing git"
if [[ ! -d .git ]]; then git init -b main >/dev/null; fi
git add -A
git -c user.name="${GIT_AUTHOR_NAME:-$OWNER}" -c user.email="${GIT_AUTHOR_EMAIL:-$OWNER@users.noreply.github.com}" \
  commit -q -m "Civic Action Scorecard Planner" || true

echo "== Creating repository $OWNER/$REPO_NAME"
if gh repo view "$OWNER/$REPO_NAME" >/dev/null 2>&1; then
  echo "Repository already exists; pushing to it."
  git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$OWNER/$REPO_NAME.git"
else
  gh repo create "$REPO_NAME" $VISIBILITY --source=. --remote=origin \
    --description "Planner for the MDC iCED Civic Action Scorecard: actions, points, documentation rules, reflection prompts, live progress." >/dev/null
fi
git push -u origin main

if [[ "$VISIBILITY" == "--private" ]]; then
  echo "Note: GitHub Pages on a private repository needs GitHub Pro/Team/Enterprise. Make the repo public if Pages refuses."
fi

echo "== Turning on GitHub Pages (branch main, root)"
if ! gh api "repos/$OWNER/$REPO_NAME/pages" >/dev/null 2>&1; then
  gh api -X POST "repos/$OWNER/$REPO_NAME/pages" \
    -H "Accept: application/vnd.github+json" \
    --input - <<<'{"source":{"branch":"main","path":"/"}}' >/dev/null
fi
URL="$(gh api "repos/$OWNER/$REPO_NAME/pages" --jq .html_url)"

echo "== Waiting for $URL"
for i in $(seq 1 40); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "$URL" || true)"
  if [[ "$code" == "200" ]]; then
    echo "Live: $URL"
    if [[ -d node_modules/@playwright ]]; then
      echo "== Running the test suite against the live site"
      BASE_URL="$URL" npx playwright test || echo "Tests failed against the live site; the local suite (npm test) will show why."
    fi
    exit 0
  fi
  sleep 15
done
echo "Pages is still building. Check: https://github.com/$OWNER/$REPO_NAME/settings/pages"
