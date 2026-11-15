#!/usr/bin/env bash
# Promote the test version in beta/ to the main app at the repository root.
# Usage: scripts/release-beta.sh 3     (3 = the new service-worker cache version for the main app)
set -euo pipefail
cd "$(dirname "$0")/.."
ver="${1:?Give the new main-app version number, e.g. 3}"
for item in index.html css js programs data icons fonts; do
  rm -rf "./$item"; cp -R "beta/$item" "./$item"
done
cp beta/tests/*.spec.js tests/
# The main app keeps its own manifest; its service worker gets the beta file list with a new cache name
# and must keep ignoring /beta/.
sed -e "s/const VERSION = \"lift-ledger-beta-[0-9]*\";/const VERSION = \"lift-ledger-v$ver\";/" beta/sw.js > sw.js
grep -q "leaveAlone" sw.js || { echo "sw.js must ignore /beta/ requests" >&2; exit 1; }
echo "Released beta to the main app as v$ver. Run the tests, then commit."
