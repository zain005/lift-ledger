# Lift Ledger: notes for Claude Code

A free, offline-first workout log and calorie calculator. Plain HTML, CSS and JavaScript, no framework and no build step.
Live at https://zain005.github.io/lift-ledger/ (main app) and /beta/ (test version). Read `ROADMAP.md` for the plan,
decisions already agreed with the owner, and what's in the test version.

## Ground rules from the owner
- **Never delete or lose anyone's data.** Logs, programs and settings live in the phone's browser storage. Any change to how
  they're stored needs a migration that keeps a backup, plus a test proving old data still opens.
- **No personal data in this public repo**, including the owner's own weights or training logs.
- **Work in `beta/` first.** The owner tries the test version, then asks for a release. Don't touch the root app directly.
- **Ask before big decisions; keep first launch clean.** New users see a simple app; advanced parts sit behind Pro mode.
- Numbers always display as Western digits (1 2 3) in every language. Arabic-Indic digits typed by users are accepted.

## Layout
- `beta/` — the test version (everything new goes here). Same structure as the root.
- `index.html`, `css/`, `js/`, `data/`, `programs/`, `vendor/`, `fonts/`, `icons/` — the released app.
- `js/i18n.js` — English strings (`STRINGS.en`), `t()`, `tn()` (plurals), `bidi()`, `LANGS`. `js/strings-ar.js` — Arabic.
- `js/app.js` — programs, logs, workout, stats, home, settings. `js/builder.js` — program builder (weeks in Pro).
- `js/library.js` — exercise library and picker/search. `js/share.js` — share links, QR, import, trainee mode.
- `js/calories.js` — calorie calculator (Pro only). `data/exercises.json` — 171 exercises (`name_ar`, `cue_ar`, `terms_ar`).
- `programs/*.json` — ready-made programs; translated fields use the `_ar` suffix. Format: `docs/program-format.md`.
- `vendor/` — fflate and qrcode-generator (MIT, licences alongside). Fonts: IBM Plex Sans + Plex Sans Arabic (OFL).
- `docs/ui-research.md` — the UI/UX research the "Ledger" design and Pro/coach decisions came from.

## How things work
- Storage keys start with `PREFIX`: `ll-` for the main app, `llb-` for `/beta/`, so the two never share data.
- Logs format v2: `{ v: 2, w1: { ex: { [exerciseId]: { s: [...], alt?, altRef? } }, done: { [dayId]: true } } }`.
  Days and exercises have permanent ids; editing a program keeps them, so history never moves.
- Programs: a week is a phase; Pro programs are `weekly: true` with one phase per week (each week 1–7 days, up to 12 weeks).
  A one-week program built without Pro is `repeat: true` and has no end.
- Share links: `#p=2.<base64url(deflate(json))>.<checksum>`. Version 1 links must keep opening. Ready-made programs travel
  by id only. `SET.follow` marks a trainee following a coach's program (focused Home unless Pro is on).
- Every on-screen text goes through `t()`. Add the key to **both** `STRINGS.en` and `STRINGS.ar` (tests fail otherwise).
  Arabic plurals need all six forms (zero, one, two, few, many, other). Library exercises show their name in the app's
  language with the English name underneath; demo videos search by the English name.
- Service worker (`sw.js`): network-first with offline fallback. **Bump the cache name** in `beta/sw.js`
  (`lift-ledger-beta-N`) whenever a beta file changes, and add new files to its `SHELL` list.

## Commands
- Run locally: `npm start` (or `python -m http.server 4173`), then open http://localhost:4173/beta/
- Tests: `npm install`, `npx playwright install chromium`, then `npm test` (both the main app and `/beta/`).
  All tests must pass before pushing; GitHub Actions runs them on every push.
- Release the test version to the main app (only when the owner asks): `bash scripts/release-beta.sh <n>`
  (on Windows use Git Bash), then update the README, run the tests and commit. Before releasing, the newest entry in
  `CHANGES` (beta/js/app.js) must be version `<n>`, with its text as `new.<n>.<k>` in both strings files; the script
  refuses otherwise and stamps the release date. Settings → About shows it as "What's new".
- Roll the main app back (owner only, only when asked): `bash scripts/rollback.sh <n>`, or `--dry-run` first. It refuses
  versions older than v4 (they can't read today's logs) and re-releases the old files under a new version number.
- On Windows, edit files with Node or perl, not `sed`: Git Bash's `sed -i` turns this repo's CRLF line endings into LF.

## Style
- Keep it small: reuse existing code and native browser features before adding anything. No frameworks, no build step.
- Design ("Ledger"): CSS variables in `css/app.css`, light and dark themes, logical properties for right-to-left,
  44px minimum touch targets, colour always paired with a word or icon.
- Comments and commit messages in plain English; say what changed for the user.
