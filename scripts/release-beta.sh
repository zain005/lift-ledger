#!/usr/bin/env bash
# Promote the test version in beta/ to the main app at the repository root.
# Usage: scripts/release-beta.sh 3     (3 = the new service-worker cache version for the main app)
set -euo pipefail
cd "$(dirname "$0")/.."
ver="${1:?Give the new main-app version number, e.g. 3}"
# What's new (CHANGES in beta/js/app.js): the entry for this version gets today's date, so it no longer reads
# "In the test version". perl keeps each file's line endings as they are.
grep -q "{ v: $ver, date: " beta/js/app.js || { echo "What's new has no entry for v$ver. Add one to CHANGES in beta/js/app.js (and its text to both strings files) first." >&2; exit 1; }
perl -pi -e "s/\\{ v: $ver, date: \"\"/{ v: $ver, date: \"$(date +%F)\"/" beta/js/app.js
for item in index.html css js programs data vendor icons fonts; do
  rm -rf "./$item"; cp -R "beta/$item" "./$item"
done
cp beta/tests/*.spec.js tests/
# The main app keeps its own manifest; its service worker gets the beta file list with a new cache name
# and must keep ignoring /beta/.
sed -e "s/const VERSION = \"lift-ledger-beta-[0-9]*\";/const VERSION = \"lift-ledger-v$ver\";/" beta/sw.js > sw.js
grep -q "leaveAlone" sw.js || { echo "sw.js must ignore /beta/ requests" >&2; exit 1; }
echo "Released beta to the main app as v$ver. Run the tests, then commit."
