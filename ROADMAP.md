# Roadmap

Lift Ledger is growing from a fixed set of programs into a tool trainers and trainees can use to build, share and follow their own programs, in English and Arabic.

Each step ships first to the **test version** at [zain005.github.io/lift-ledger/beta/](https://zain005.github.io/lift-ledger/beta/). It's checked on a real phone, then promoted to the main app with `scripts/release-beta.sh`. The test version stores its data separately (`llb-` keys instead of `ll-`), so trying it never affects real data.

## Status

| Step | What | Status |
|---|---|---|
| 1 | Groundwork: dark mode, translation system, right-to-left layout, permanent exercise ids | **Released** |
| 2 | Exercise library: 171 exercises, search and filters, "My exercises" | **Released** (19 Nov 2026) |
| 3 | Program builder: 1–7 days, exercises from the library or added by hand, one box per set (up to 5) with its own reps, weekly sets per muscle, edit safely | **Released** (19 Nov 2026) |
| 4 | Sharing programs: link, QR code and file; update keeps the trainee's weights; home-screen tip | **Released** (19 Nov 2026; backup reminders and a one-screen "Full program" view come later) |
| 4b | Pro mode (weeks, calories) and coach → trainee programs | **Released** (19 Nov 2026) |
| 5 | Arabic: every screen, 171 exercises with tips and Arabic/gym search words, ready-made programs | **Released** (19 Nov 2026; wording fixed as people report it) |

## Decisions

These were agreed before building. Change them here first if they change.

**Programs**
- Most trainees follow a 2–4 day program repeated weekly. A program is one week of days, repeated for a set number of weeks, with optional phases (for example, weeks 1–4 and 5–8 with different reps or effort).
- Every program has the same number of training days each week. The "missed session" logic and the progress grid rely on it.
- Presets stay, and can be copied into an editable program. Most people will start from a preset rather than a blank page.

**Exercises**
- A library of roughly 150–200 exercises covering barbell, dumbbell, machine, cable, bodyweight and bands, with search and filters by muscle and equipment.
- Every exercise has a primary muscle and optional secondary muscles from a fixed list of about 15 groups. This makes tags translatable and lets the builder show **weekly sets per muscle**.
- Users can add their own exercises (they must pick a primary muscle); these are saved to "My exercises" for reuse.
- Sets and reps are required. Reps can be a number or a range, the same for every set by default, with an optional per-set mode (12 / 10 / 8). Exercises can be timed (seconds), per side, or bodyweight. Effort (RPE) and notes are optional.
- All library content is original. Built-in programs must never copy a paid program.

**Weeks**
- The workout page has no week selector for now. It always opens on the next session to do, and Stats shows the whole program. A separate week feature is planned and will be designed before it's built. The builder has no week control either; programs use 8 weeks until then.

**Pro mode and coaching (agreed 17 November 2026)**
- The whole app stays free. "Pro mode" is a switch in Settings, off by default, that anyone can turn on or off at any time.
- Pro unlocks weeks and the calorie calculator. With Pro off, the Calories tab and personal details are hidden (never deleted).
- Weeks in Pro: a program is Week → Days → Exercises. Up to 12 weeks; each week has 1–7 days and can differ from the others. "Add week" copies the previous week so a coach only changes what's different.
- A program built without Pro is one week that repeats with no end. A program with 2 or more weeks ends with "Program complete" and stays there until a new program or link arrives.
- Coaches: a "Pro program" switch on the Share screen, shown only to coaches who have Pro on, off by default; it works for ready-made programs too. A trainee who opens a Pro program gets Pro switched on.
- Trainees who open a normal program see only that program: no ready-made list, no "Create my own", no edit or share. Turning Pro on shows the full app; that's also how a trainee stops following.
- Updates: the coach edits the same program and sends a new link (the program keeps a hidden permanent id). The trainee sees what changed and chooses Update or Keep current version; logged weights are always kept. A different program replaces the followed one; the old one and its history are kept, hidden.
- Existing users who already use calories or weeks are switched to Pro automatically, so nothing they use disappears.

**Look and feel ("Ledger" design)**
- Chosen from the UI research (November 2026): calm paper-and-ink surfaces, hairline rules, one warm signal colour for actions, sentence-case headings, tabular figures for every number. Light and dark themes both meet WCAG AA contrast.
- One font family for both scripts: IBM Plex Sans and IBM Plex Sans Arabic (OFL), bundled. The Arabic files load only when Arabic text appears.
- Status always pairs colour with a word or icon: done is green, skipped is amber (never alarm red), records are gold.
- Last time's weight shows in grey inside each set box as the number to beat. The screen stays awake while the workout page is open (a setting, on by default).
- Next, from the same research, to discuss before building: tick a set to log it (prefilled from last time) with a rest timer; a short first-launch question (kg or lb) leading straight into Day 1; "just today" vs "update program" when swapping; free charts per exercise, a records list and "2 of 3 days this week" in Stats.
- Released 19 November 2026; the README credits now list IBM Plex, fflate and qrcode-generator.
- A 3D muscle map was tried and removed on 19 November 2026: the owner found it added nothing. UI changes should make the app clearer or faster to use, not add showpieces.

**Data safety**
- Days and exercises have permanent ids, and logs are stored by id (log format v2), so reordering or editing a program never moves logged weights to the wrong exercise. Older logs are converted automatically, and an untouched copy of the original is kept.

**Arabic**
- The whole layout mirrors right-to-left, with an Arabic font (both OFL-licensed, bundled).
- **Numbers always show as 1 2 3.** Typed Arabic-Indic digits (١٢٣) and the Arabic decimal mark (٫) are accepted and converted, because many Arabic phone keyboards type them.
- Exercise names show in clear Modern Standard Arabic with the English name underneath, which is what people say in the gym. Search matches Arabic, English and common transliterations and dialect terms (for example سكوات، ديدلفت، بايسبس).
- Programs store exercise ids, not names, so a program built in English appears in Arabic for an Arabic-speaking trainee.
- All Arabic lives in one strings file. Decided 19 November 2026: rather than a line-by-line review of all ~1,400 texts before release, the Arabic goes live and wording is fixed as the owner and users report it.
- The app keeps the name "Lift Ledger" for now; an Arabic name may come later.

**Sharing**
- A trainer shares a program as a **link**. The whole program is compressed into the link itself, so there is no server, no account, no storage limit and no running cost, whatever the number of users.
- Links carry a format version so they keep working after app updates, and a checksum so a cut-off link is reported instead of importing a broken program.
- A **QR code** for sharing in person, and a **file** as a backup option.
- The phone's share sheet handles WhatsApp, Telegram, AirDrop, Bluetooth and the rest.
- If the trainer sends a new version of the same program, the trainee can update it and keep their history.

**The trainee always has their program**
- An imported program is saved on the phone and works offline; the link or QR code is only the delivery.
- Straight after import, the app shows how to add it to the home screen (on iPhone, Safari can clear data for sites not added to the home screen after about a week without use).
- The app asks the browser to keep its data permanently.
- The original link keeps working as a way to recover the program.
- Regular, one-tap backup reminders.
- A "Full program" view showing every day on one screen, easy to screenshot or save as a PDF.

**Hosting**
- GitHub Pages has a soft limit of about 100 GB of traffic a month, roughly 100,000 new installs. If usage approaches that, move to Cloudflare Pages (free, no traffic cap); the app needs no changes.

## Releasing the test version

```sh
scripts/release-beta.sh 3      # 3 = next main-app cache version
npm test                       # both versions must pass
git commit -am "Release: ..."
```
