# Lift Ledger

**A workout log and program builder that runs in your browser, installs to your phone's home screen, and works offline, in English and Arabic. Coaches can send a program to trainees as a link. No account, no tracking: your data stays on your device.**

[**Open the app →**](https://zain005.github.io/lift-ledger/)

[![Tests](https://github.com/zain005/lift-ledger/actions/workflows/tests.yml/badge.svg)](https://github.com/zain005/lift-ledger/actions/workflows/tests.yml)
![No build step](https://img.shields.io/badge/build%20step-none-1d4ed8)
[![License: MIT](https://img.shields.io/badge/license-MIT-1d4ed8)](LICENSE)

<p>
  <img src="docs/screenshots/workout.png" width="220" alt="Workout screen with sets, target reps and RPE">
  <img src="docs/screenshots/progress.png" width="220" alt="Progress screen with sessions grid and weekly volume chart">
  <img src="docs/screenshots/calories.png" width="220" alt="Calorie calculator showing a moderate deficit">
</p>

<sub>Screenshots use made-up demo data and show the earlier design.</sub>

## Contents

- [Features](#features)
- [Install on your phone](#install-on-your-phone)
- [Built-in programs](#built-in-programs)
- [Your own programs](#your-own-programs)
- [Coaches and trainees](#coaches-and-trainees)
- [Your data and privacy](#your-data-and-privacy)
- [How the calorie numbers work](#how-the-calorie-numbers-work)
- [Run it locally](#run-it-locally)
- [Development](#development)
- [Sources](#sources)
- [Credits and license](#credits-and-license)

## Features

**Programs**
- Three ready-made 8-week programs, or build your own: 1–7 training days, each exercise with its own sets and reps.
- An exercise library of 171 exercises with search (including common gym nicknames), muscle and equipment filters, and form tips. Add your own exercises too.
- While you build, a 3D body and a list show how many sets each muscle gets per week.

**Workout log**
- One box per set, with target reps and effort (RPE) for every exercise. Last time's weight shows in grey inside each box, as the number to beat.
- Mark a day done when you finish:
  - Done days turn green.
  - A skipped day turns amber once you complete a later one.
  - A dot flags done days with empty sets.
- The app opens on your next session, or on the day that still needs weights.
- Swap any exercise for an alternative or anything from the library.
- A round play button opens a demo video, and the screen stays on while you train.

**Progress**
- Sessions completed and missed, week by week.
- Weekly training volume chart and a strength trend for every exercise.
- "Muscles worked": a 3D body coloured by the sets you logged for each muscle that week.

**Pro mode** (free, off by default)
- Programs planned week by week, up to 12 weeks, each week with its own days.
- The calorie calculator: BMR and maintenance from your details and routine, your usual day of eating, and a what-if calculator for any single day.

**Settings**
- English or Arabic (right-to-left, with Arabic exercise names and the English name underneath). Numbers always show as 1 2 3.
- Light, dark, or match your phone's theme. kg or lb.
- Show or hide demo links, exercise tips, last-time weights and the RPE explainer.

## Install on your phone

Open **[zain005.github.io/lift-ledger](https://zain005.github.io/lift-ledger/)**, then:

- **iPhone (Safari):** Share → **Add to Home Screen**.
- **Android (Chrome):** menu (⋮) → **Install app** or **Add to Home screen**.

It opens full-screen like an app and works offline after the first visit.

## Built-in programs

Three 8-week programs, written for this project. Each has two phases:
- **Weeks 1–4, Foundation:** moderate effort while you learn the movements.
- **Weeks 5–8, Build:** each set closer to failure.

The exercises stay the same throughout, which makes progress easy to track.

| Program | Days / week | Sessions | Hard sets per session |
|---|---|---|---|
| Full Body | 3 | Full Body A, B, C | 15–17 |
| Upper / Lower | 4 | Upper A, Lower A, Upper B, Lower B | 16–18 |
| Push Pull Legs | 6 | Pull, Push, Legs × 2 | 14–17 |

**Effort targets** are written as two numbers, for example **7–8 / 9**:
- The first number is the RPE for your early sets.
- The second is for your last set.

RPE 10 means no reps left in the tank; RPE 8 means two left.

**Reps** are ranges. When every set reaches the top of the range, add weight next time.

The design follows common evidence-based guidelines:
- About 6–12 hard sets per muscle per week, more on the 4- and 6-day programs.
- Effort measured by reps in reserve.
- Exercises that train muscles through a long range of motion, such as seated leg curls and overhead triceps extensions.

See [Sources](#sources). The programs are general guidance, not personal coaching. Check with a professional if you have an injury or health condition.

## Your own programs

Tap **Create my own program** on Home. Name it, add days, pick exercises from the library, and set the reps for each set. Without Pro, a program is one week that repeats with no end. With Pro on, plan it week by week: **Add week** copies the previous week so you only change what's different.

Programs are also plain JSON files, so you can write one by hand and import it. The format is documented in **[docs/program-format.md](docs/program-format.md)**.

Your programs stay on your device. Please only add programs to this repository that you wrote or have the right to share.

## Coaches and trainees

- **Share** a program as a link, a QR code or a file. The whole program travels inside the link, so there's no server and no account.
- A trainee who opens the link sees what's in it and taps **Add this program**. On a coach's normal program, the trainee sees only that program, with nothing else to choose. Turning on Pro shows the full app.
- To update, the coach edits the same program and sends a new link. The trainee sees what changed and chooses to update or keep their version. Logged weights are always kept.
- A coach in Pro can send a **Pro program**, which turns on Pro for the trainee.

## Your data and privacy

- Everything is saved in your browser's local storage, on your device. Nothing is sent to a server, and the app makes no requests to other sites; the fonts and libraries are bundled.
- A shared program travels inside its link and is never uploaded anywhere.
- **Settings → Your data** lets you:
  - **Export a backup (.json):** everything, to restore later or on another device.
  - **Export sets (.csv):** one row per logged set, ready for Excel, Google Sheets, Python or Power BI.
  - **Restore a backup**, or **erase all data**.
- Clearing your browser's site data deletes your logs, so export a backup now and then.

## How the calorie numbers work

| Part | Method |
|---|---|
| BMR (energy at rest) | Mifflin-St Jeor equation. If you enter a body fat %, it's averaged with Katch-McArdle, which uses lean mass. |
| Daily life | BMR × an activity multiplier (1.2–1.5), which also covers digestion. |
| Treadmill walking | ACSM metabolic equation for walking, from speed, incline and body weight, counting only energy above rest. It assumes you don't hold the handrails. |
| Weight training | MET values for resistance training (3.5 moderate, 5.0 vigorous), minus the resting MET. |
| Steps (what-if) | An estimate of about 0.5 kcal per kg per km, using a stride length of 41.5% of height. |
| Week average | Weighted by how many training, cardio and rest days you have. |
| Weight change | About 7,700 kcal per kg of body fat. Real change differs, especially early on, because of water and glycogen. |
| Foods | Typical values per 100 g, rounded from public nutrition tables. Your labels may differ. |

Expect around ±10%. If your weight trend over 3–4 weeks doesn't match, adjust **Daily life** until it does. This is an estimate, not medical or nutrition advice.

## Run it locally

No build step and no dependencies. Serve the folder with any static web server:

```sh
git clone https://github.com/zain005/lift-ledger.git
cd lift-ledger
python3 -m http.server 4173
# open http://localhost:4173
```

Opening `index.html` straight from your files won't load the programs, because browsers block that.

## Development

**Built with** plain HTML, CSS and JavaScript. It has no framework and no build tools. Three small libraries are bundled in `vendor/`: fflate (compresses share links), qrcode-generator (QR codes) and three.js (the 3D muscle map, loaded only when it's shown).
- **Charts** are inline SVG drawn by the app itself.
- **Offline support** comes from a service worker and a web app manifest, so it can be installed as a PWA.
- **Tests** use [Playwright](https://playwright.dev/).
- **CI** runs on GitHub Actions, and the site is hosted on GitHub Pages.

```sh
npm install
npx playwright install chromium
npm test
```

**Test version.** New work ships first to [`/beta/`](https://zain005.github.io/lift-ledger/beta/), a full copy of the app that stores its data separately. When it's ready, `scripts/release-beta.sh` promotes it to the main app. See [ROADMAP.md](ROADMAP.md) for what's planned and the decisions behind it.

The tests drive the app in a phone-sized browser. They check:
- logging and saving, and the warning if the phone refuses to save
- missed-session detection and last-week weights
- swaps and the exercise library
- the program builder, Pro weeks and safe editing of logged programs
- sharing between a coach and a trainee, including updates and damaged links
- program import, CSV and backup export and restore
- the Arabic version, including a scan for leftover English
- settings and the calorie calculator
- working offline, and that the page makes no outside requests

They run on every push and pull request.

```
index.html               page markup
css/app.css              styles
js/app.js                workout log, programs, stats, settings, export/import
js/builder.js            program builder
js/library.js            exercise library and picker
js/share.js              share links, QR codes, coach and trainee
js/muscle3d.js           3D muscle map
js/calories.js           calorie calculator
js/i18n.js, strings-ar.js  English and Arabic text
data/exercises.json      the 171-exercise library
programs/*.json          built-in programs
vendor/                  bundled libraries and their licences
docs/                    program format, UI research and screenshots
sw.js                    offline cache (bump VERSION on each release)
manifest.webmanifest     install metadata
icons/, fonts/           app icons and bundled fonts
tests/                   Playwright tests
beta/                    the test version (same layout)
```

## Sources

**Energy expenditure**
- Mifflin MD, St Jeor ST, Hill LA, Scott BJ, Daugherty SA, Koh YO. A new predictive equation for resting energy expenditure in healthy individuals. *Am J Clin Nutr.* 1990;51(2):241–247. [doi:10.1093/ajcn/51.2.241](https://doi.org/10.1093/ajcn/51.2.241)
- McArdle WD, Katch FI, Katch VL. *Exercise Physiology: Nutrition, Energy, and Human Performance.* Lippincott Williams & Wilkins (Katch-McArdle equation).
- American College of Sports Medicine. *ACSM's Guidelines for Exercise Testing and Prescription*, metabolic equations for walking.
- Ainsworth BE, et al. 2011 Compendium of Physical Activities: a second update of codes and MET values. *Med Sci Sports Exerc.* 2011;43(8):1575–1581. [doi:10.1249/MSS.0b013e31821ece12](https://doi.org/10.1249/MSS.0b013e31821ece12)
- Hall KD. What is the required energy deficit per unit weight loss? *Int J Obes.* 2008;32(3):573–576. [doi:10.1038/sj.ijo.0803720](https://doi.org/10.1038/sj.ijo.0803720)
- U.S. Department of Agriculture. [FoodData Central](https://fdc.nal.usda.gov/) (typical food values).

**Training**
- Schoenfeld BJ, Ogborn D, Krieger JW. Dose-response relationship between weekly resistance training volume and increases in muscle mass: a systematic review and meta-analysis. *J Sports Sci.* 2017;35(11):1073–1082. [doi:10.1080/02640414.2016.1210197](https://doi.org/10.1080/02640414.2016.1210197)
- Zourdos MC, et al. Novel resistance training–specific rating of perceived exertion scale measuring repetitions in reserve. *J Strength Cond Res.* 2016;30(1):267–275. [doi:10.1519/JSC.0000000000001049](https://doi.org/10.1519/JSC.0000000000001049)
- Maeo S, et al. Greater hamstrings muscle hypertrophy but similar damage protection after training at long versus short muscle lengths. *Med Sci Sports Exerc.* 2021;53(4):825–837. [PubMed 33009197](https://pubmed.ncbi.nlm.nih.gov/33009197/)
- Maeo S, et al. Triceps brachii hypertrophy is substantially greater after elbow extension training performed in the overhead versus neutral arm position. *Eur J Sport Sci.* 2023;23(7):1240–1250. [doi:10.1080/17461391.2022.2100279](https://doi.org/10.1080/17461391.2022.2100279)

## Credits and license

- Created by [Zain Ali](https://github.com/zain005).
- Code: [MIT License](LICENSE).
- Fonts: [IBM Plex Sans and IBM Plex Sans Arabic](https://github.com/IBM/plex) by IBM, under the [SIL Open Font License 1.1](fonts/IBM-Plex-OFL.txt).
- [fflate](https://github.com/101arrowz/fflate) by Arjun Barrett, [MIT](vendor/fflate-LICENSE.txt).
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) by Kazuhiko Arase, [MIT](vendor/qrcode-LICENSE.txt).
- [three.js](https://threejs.org/) by the three.js authors, [MIT](vendor/three-LICENSE.txt).
- Lift Ledger is a personal project and isn't affiliated with any coach, gym, program or equipment maker.
