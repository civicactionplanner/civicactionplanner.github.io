#!/usr/bin/env bash
# Deploys firestore.rules with firebase-tools, if available; otherwise says what to paste where.
# Usage: bash scripts/rules-deploy.sh [project-id]
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT="${1:-civic-action-planner}"

if ! command -v npx >/dev/null; then
  echo "npx is not available. Paste the contents of firestore.rules into the Firebase console:"
  echo "  Firestore Database -> Rules -> paste -> Publish"
  exit 1
fi

# firebase deploy needs a firebase.json pointing at the rules file; write a minimal one if absent.
if [[ ! -f firebase.json ]]; then
  printf '{\n  "firestore": { "rules": "firestore.rules" }\n}\n' > firebase.json
  echo "Wrote a minimal firebase.json (firestore.rules only)."
fi

if npx --yes firebase-tools deploy --only firestore:rules --project "$PROJECT"; then
  echo "Rules deployed to project $PROJECT."
else
  echo
  echo "firebase-tools could not deploy (not logged in? wrong project id?)."
  echo "Either run: npx firebase-tools login   and re-run this script,"
  echo "or paste the contents of firestore.rules into the console:"
  echo "  console.firebase.google.com -> Firestore Database -> Rules -> paste -> Publish"
  exit 1
fi
