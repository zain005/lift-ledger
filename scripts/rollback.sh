#!/usr/bin/env bash
# Put the MAIN app back to an earlier release, for everyone. The test version in beta/ is left alone.
# Only someone who can push to the GitHub repository can do this.
#
#   scripts/rollback.sh 5            roll the main app back to release v5 (asks you to confirm)
#   scripts/rollback.sh 5 --dry-run  show what would happen, run the tests, change nothing
#
# The old release goes out under a NEW version number (one above the current one), so phones fetch it.
# It refuses releases older than v4, which can't read the workout logs people have now.
set -euo pipefail
cd "$(dirname "$0")/.."

want="${1:?Which release? For example: scripts/rollback.sh 5}"
want="${want#v}"
dry=""; [ "${2:-}" = "--dry-run" ] && dry=1

# The commit that released vN is the one that first set the main app's cache name to lift-ledger-vN
commit=$(git log -S"\"lift-ledger-v$want\";" --format=%h --reverse -- sw.js | head -1)
[ -n "$commit" ] || { echo "There is no release v$want. Releases so far: $(git log -p -- sw.js | grep -o '"lift-ledger-v[0-9]*"' | tr -d '"' | sed 's/lift-ledger-//' | sort -uV | tr '\n' ' ')"; exit 1; }
git show "$commit:js/app.js" | grep -q "L.v === 2" || { echo "v$want keeps workout logs in an older format, so people's logs would disappear from view. Choose v4 or later."; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "You have unsaved changes. Commit or discard them first, then run this again."; exit 1; }

cur=$(grep -o 'lift-ledger-v[0-9]*' sw.js | head -1 | sed 's/lift-ledger-v//')
[ "$want" != "$cur" ] || { echo "The main app is already v$cur."; exit 1; }
next=$((cur + 1))
echo "Rolling the main app back to v$want (commit $commit). It goes out as v$next."
if [ -z "$dry" ]; then
  read -r -p "Everyone using the main app gets v$want. Type yes to continue: " ok
  [ "$ok" = "yes" ] || { echo "Stopped. Nothing changed."; exit 1; }
fi

# Restore the main app's files exactly as they were in that release; files added since are removed
for item in index.html css js programs data vendor icons fonts manifest.webmanifest tests; do
  rm -rf "./$item"
  if git cat-file -e "$commit:$item" 2>/dev/null; then git checkout "$commit" -- "$item"; fi
done
git show "$commit:sw.js" | sed -e "s/const VERSION = \"lift-ledger-v[0-9]*\";/const VERSION = \"lift-ledger-v$next\";/" > sw.js
grep -q "leaveAlone" sw.js || { echo "That release's offline worker doesn't leave /beta/ alone; stopping."; git checkout -- . && git clean -fdq -- index.html css js programs data vendor icons fonts tests; exit 1; }

undo() { git reset -q --hard HEAD && git clean -fdq -- index.html css js programs data vendor icons fonts tests; }
echo "Running the main app's tests…"
if ! npx playwright test --project=stable --reporter=line; then
  echo "The tests failed, so nothing was saved or pushed. Your files are back as they were."
  undo; exit 1
fi
if [ -n "$dry" ]; then
  echo "Dry run: the tests pass with v$want. Nothing was saved or pushed; your files are back as they were."
  undo; exit 0
fi

git add -A -- index.html css js programs data vendor icons fonts manifest.webmanifest tests sw.js
git commit -q -m "Roll back the main app to v$want (released as v$next)" \
  -m "Restores the main app's files from $commit. The test version in beta/ is unchanged."
git push -q origin HEAD
echo "Done. The main app is v$want again (as v$next). GitHub publishes it in a few minutes."
echo "To undo the rollback later, release the test version again: scripts/release-beta.sh $((next + 1))"
