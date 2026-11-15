/* Lift Ledger: text and number helpers.
   Every piece of on-screen text lives in STRINGS so the app can be translated by adding a language block.
   Keys can hold {placeholders}. Plural keys hold an object of CLDR plural forms (zero, one, two, few, many, other). */
"use strict";

/* The test version at /beta/ keeps its data separate from the main app. */
const PREFIX = /\/beta\//.test(location.pathname) ? "llb-" : "ll-";

const STRINGS = {
  en: {
    "loading": "Loading programs…",
    "beta.tag": "Test version",
    "err.loadPrograms": "Couldn't load the built-in programs. If you opened index.html straight from your files, serve the folder with a local web server instead (see the README).",

    "nav.aria": "Section", "nav.workout": "Workout", "nav.calories": "Calories", "nav.settings": "Settings",
    "nav.weekAria": "Week", "nav.dayAria": "Workout day",

    "status.done": "Done", "status.missed": "Missed", "status.todo": "To do",
    "week.short": "WK", "week.aria": "Week {n}", "week.attention": "needs attention", "week.chartN": "W{n}",
    "phase.n": "Phase {n}",
    "day.n": "Day {n}", "day.shortN": "D{n}", "day.title": "Wk {w} · {name}", "day.gapsTitle": "Some sets have no weight logged",
    "dayDone.mark": "Mark day {n} done", "dayDone.done": "Day {n} done", "dayDone.undo": "tap to undo",
    "warn.empty": { one: "{n} set has no weight logged. Fill in the red box (enter 0 for bodyweight).", other: "{n} sets have no weight logged. Fill in the red boxes (enter 0 for bodyweight)." },
    "sets.n": "Set {n}", "unit.kg": "kg", "unit.lb": "lb",
    "rpe.pill": "RPE {rpe}",
    "last.plain": "Last time (week {w}):", "last.withName": "Last time (week {w}, {name}):",
    "swap.open": "Swap exercise", "swap.change": "Change exercise", "swap.insteadOf": "Instead of", "swap.tag": "Swapped",
    "swap.planned": "(planned)", "swap.note": "The swap applies to this week only. Keep the same sets, reps and RPE.",
    "demo.aria": "{name} demo",

    "rpe.summary": "What does RPE mean?",
    "rpe.p1": "RPE is how hard a set feels on a 1–10 scale, judged by how many more reps you could have done before failing.",
    "rpe.left0": "0 reps left", "rpe.left1": "1 rep left", "rpe.left2": "2 reps left", "rpe.left3": "3 reps left",
    "rpe.p2": "Two numbers like <b>7–8 / 9</b> mean your early sets at RPE 7–8 and your last set at 9. Reps are a range: when every set reaches the top of the range, add weight next time.",

    "stats.short": "STATS", "stats.aria": "Progress", "stats.title": "Your progress", "stats.heading": "Your progress · {name}",
    "stats.sessions": "Sessions done", "stats.pctProgram": "{pct}% of the program",
    "stats.missed": "Missed", "stats.missedSome": "Skipped before a later session", "stats.missedNone": "None so far",
    "stats.volume": "Total volume", "stats.volumeDesc": "Weight × reps, all logged sets",
    "stats.up": "Lifts going up", "stats.upDesc": "Heavier than the first time", "stats.upNone": "Log 2+ weeks to compare",
    "stats.byWeek": "Sessions by week", "stats.cellTitle": "Week {w} Day {d}: {status}",
    "stats.volTitle": "Weekly volume ({unit})", "stats.volSub": "Total weight moved each week, assuming the bottom of each rep range.",
    "vol.aria": "Weekly training volume",
    "stats.bestWeek": "Best week: Week {n}, {v} {unit}. Tap a bar for details.", "stats.volEmpty": "Log weights to see your weekly volume.",
    "stats.weekVol": "Week {n}: {v} {unit}", "stats.weekVolNone": "Week {n}: {v} {unit} (nothing logged)",
    "stats.strength": "Strength by exercise", "stats.strengthSub": "Heaviest set each week, first logged vs latest.",
    "stats.liftsEmpty": "Log weights on any workout and your lifts will show up here.", "stats.oneWeek": "1 week logged",

    "set.title": "Settings", "set.subtitle": "Your preferences",
    "set.program": "Program", "set.programSub": "Each program keeps its own log, so switching never deletes anything.",
    "set.import": "Import a program (.json)", "set.format": "Program file format",
    "set.look": "Look and language", "set.theme": "Theme", "set.themeLight": "Light", "set.themeDark": "Dark", "set.themeSystem": "Match phone",
    "set.language": "Language",
    "set.workoutScreen": "Workout screen", "set.app": "App",
    "set.videos": "Demo links", "set.videosDesc": "Exercise names link to the program's demo video, or a YouTube search.",
    "set.cues": "Exercise tips", "set.cuesDesc": "A short form cue under each exercise.",
    "set.last": "Last time", "set.lastDesc": "The weights you lifted the week before.",
    "set.rpeBox": "RPE explainer", "set.rpeBoxDesc": "The “What does RPE mean?” box above the workout.",
    "set.smartOpen": "Open on my next session", "set.smartOpenDesc": "Off: reopen on the week and day you last viewed.",
    "set.calTab": "Calories tab", "set.calTabDesc": "Show the calorie calculator.",
    "set.unit": "Weight unit", "set.unitNote": "The unit is a label only. Pick it before you start logging; it doesn't convert numbers you've already entered.",
    "set.details": "Your details", "set.detailsSub": "Used by the calorie calculator only.",

    "prog.daysWeek": { one: "{n} day a week", other: "{n} days a week" },
    "prog.imported": "imported", "prog.current": "current", "prog.done": "{n} of {total} sessions done",
    "prog.remove": "Remove program", "prog.removeConfirm": "Remove “{name}”? Its logged weights stay saved and come back if you import it again.",
    "prog.replaceConfirm": "Replace your imported program “{name}” with this file? Logged weights are kept.",
    "prog.importedMsg": "Imported “{name}” and switched to it.",

    "err.notProgram": "The file isn't a program (expected a JSON object).", "err.noName": "The program needs a “name”.",
    "err.weeks": "“weeks” must be between 1 and 12.", "err.days": "{where}: “days” must be a list of 1 to 7 days.",
    "err.exercises": "{where}, day {day}: “exercises” must be a list of 1 to 15 exercises.",
    "err.exName": "{where}, day {day}, exercise {ex}: missing “name”.", "err.sets": "“{name}”: “sets” must be 1 to 10.",
    "err.dupId": "The id “{id}” is used twice. Each day and exercise needs its own id.",
    "err.phaseRange": "Phase {n} has an empty week range.", "err.phaseDays": "Phase {n} must have the same number of days as the program.",
    "err.where.program": "Program", "err.where.phase": "Phase {n}",
    "err.fileLarge": "That file is too large.", "err.json": "That file isn't valid JSON.", "err.read": "Couldn't read the file.",

    "data.title": "Your data",
    "data.note": "Everything is stored in this browser on this device. Nothing is sent anywhere. Export a backup now and then, and before clearing your browser data.",
    "data.exportJson": "Export backup (.json)", "data.exportCsv": "Export sets (.csv)", "data.restore": "Restore backup",
    "data.reset": "Reset screen settings", "data.erase": "Erase all data",
    "data.backupDone": "Backup downloaded.", "data.csvDone": { one: "Exported {n} logged set.", other: "Exported {n} logged sets." },
    "data.csvEmpty": "No logged sets yet, so the CSV only has headers.", "data.notBackup": "That isn't a Lift Ledger backup file.",
    "data.restoreConfirm": "Replace all data on this device with this backup? Anything not in the backup will be lost.",
    "data.resetDone": "Screen settings reset. Your data wasn't touched.",
    "data.eraseConfirm1": "Erase all workouts, programs, calorie details and settings on this device?",
    "data.eraseConfirm2": "This can't be undone. Erase everything?",
    "foot.data": "Your data stays in this browser. Export a backup from Settings.",

    "p.weight": "Weight (kg)", "p.height": "Height (cm)", "p.age": "Age", "p.bf": "Body fat % (optional)", "p.sex": "Sex",
    "p.male": "Male", "p.female": "Female", "p.act": "Daily life",
    "p.act1": "Desk, little walking", "p.act2": "Desk + walk breaks", "p.act3": "On your feet a lot", "p.act4": "Physical job",
    "p.target": "Target ± (%)", "p.week": "Your week", "p.trainDays": "Training days", "p.cardioDays": "Cardio-only days",
    "p.trainingDay": "Training day", "p.warmMin": "Warm-up min", "p.speed": "Speed mph", "p.incline": "Incline %",
    "p.liftMin": "Lifting minutes", "p.liftEffort": "Lifting effort", "p.moderate": "Moderate", "p.hard": "Hard (RPE 7–9)",
    "p.cardioDay": "Cardio day", "p.minutes": "Minutes",

    "cal.title": "Calories", "cal.subtitle": "Calorie calculator",
    "cal.detailsIn": "Your weight, height and weekly routine are in", "cal.heroLabel": "Your usual week, on average",
    "cal.kcalMaint": "kcal maintenance", "cal.you": "You",
    "cal.hero.below": "You eat about <b>{eat} kcal</b> a day on average, against a maintenance of <b>{maint} kcal</b>. That's <b>{diff} kcal below</b> maintenance, or about <b>{kg} kg lost per week</b>.",
    "cal.hero.above": "You eat about <b>{eat} kcal</b> a day on average, against a maintenance of <b>{maint} kcal</b>. That's <b>{diff} kcal above</b> maintenance, or about <b>{kg} kg gained per week</b>.",
    "cal.hero.targets": "A −{tp}% deficit is <b>{def} kcal</b> a day and a +{tp}% surplus is <b>{sur} kcal</b>.",
    "cal.hero.noDiet1": "That's what you burn on an average day, based on your details and weekly routine in Settings.",
    "cal.hero.noDiet2": "Add your usual day of eating below to see whether you're in a deficit or a surplus.",
    "cal.bmr": "BMR (at rest)", "cal.bmrSub": "kcal a day lying still", "cal.maint": "Maintenance", "cal.maintSub": "kcal a day, week average",
    "cal.deficitN": "Deficit −{tp}%", "cal.surplusN": "Surplus +{tp}%",
    "cal.kgLostWeek": "≈ {kg} kg lost a week", "cal.kgGainedWeek": "≈ {kg} kg gained a week",
    "cal.byDay": "Maintenance by day", "cal.byDaySub": "What you burn on each type of day, and how many of each you have a week.",
    "cal.col.day": "Day", "cal.col.maintain": "Maintain",
    "cal.day.training": "Training", "cal.day.cardio": "Cardio", "cal.day.rest": "Rest", "cal.day.average": "Average",
    "cal.day.trainingSub": "+{warm} warm-up, +{lift} lifting", "cal.day.cardioSub": "+{card} treadmill", "cal.day.restSub": "Daily life only",
    "cal.day.averageSub": "BMR {bmr} × {act} daily life",
    "cal.usual": "Your usual day of eating", "cal.usualSub": "Add what you eat on a normal day. Amounts are raw or as listed.",
    "cal.food": "Food", "cal.addUsual": "Add to usual day", "cal.usualNone": "Nothing added yet",
    "cal.usualTotals": "Usual day: <span><b>{kcal}</b> kcal</span><span><b>{p}</b> g protein ({pkg} g/kg)</span><span><b>{f}</b> g fat</span><span><b>{c}</b> g carbs</span>",
    "cal.weekAvg": "Week average: <span><b>{kcal}</b> kcal a day</span>", "cal.biggerDaysTotal": "<span>Bigger days ≈ <b>{kcal}</b> kcal</span>",
    "cal.bigDays": "Bigger days / week", "cal.bigExtra": "Extra kcal on those",
    "cal.bigNote": "Bigger days are days you eat more than usual, like a meal out. Leave at 0 if you eat the same every day.",
    "cal.restLeft": { one: "That leaves {n} rest day a week.", other: "That leaves {n} rest days a week." },
    "cal.bmrNote": "BMR {bmr} kcal from Mifflin-St Jeor. Add a body fat % to also use Katch-McArdle.",
    "cal.bmrNoteBf": "Lean mass {lean} kg · BMR {katch} (Katch-McArdle) and {mifflin} (Mifflin-St Jeor), averaged to {bmr}.",
    "kcal.n": "{n} kcal", "g.n": "{n} g", "item.remove": "Remove {name}",

    "band.veryAggressive": "Very aggressive deficit", "band.veryAggressiveDesc": "Fast fat loss; building muscle is unlikely",
    "band.aggressive": "Aggressive deficit", "band.aggressiveDesc": "Quick fat loss; muscle gain is hard",
    "band.moderate": "Moderate deficit", "band.moderateDesc": "Steady fat loss; recomp still possible",
    "band.mild": "Mild deficit", "band.mildDesc": "Slow fat loss; good for recomp",
    "band.maintenance": "Maintenance", "band.maintenanceDesc": "Weight stays about the same",
    "band.lean": "Lean surplus", "band.leanDesc": "Slow gain, mostly muscle if training hard",
    "band.surplus": "Surplus", "band.surplusDesc": "Faster gain, more of it fat",
    "band.below": "below {v}", "band.above": "above {v}", "band.range": "{a} to {b}", "band.youAreHere": "you are here",

    "whatif.title": "What-if calculator", "whatif.sub": "Plan or check any single day: pick the day, add what you ate and any extra activity.",
    "whatif.includeUsual": "Include my usual day", "whatif.addFood": "Add food", "whatif.addAct": "Add activity",
    "whatif.noFood": "No extra food added", "whatif.noAct": "No extra activity added",
    "whatif.eaten": "Eaten", "whatif.burned": "Burned", "whatif.balance": "Balance", "whatif.effect": "Body weight effect",
    "whatif.protein": "{p} g protein", "whatif.inclExtra": "incl. +{kcal} extra activity", "whatif.maintDay": "maintenance for this day",
    "whatif.fatUsed": "body fat used that day", "whatif.fatStored": "stored; repeated, it adds up",
    "act.tread": "Treadmill walk", "act.lift": "Weight training", "act.walk": "Walking (steps)", "act.other": "Something else (enter kcal)",
    "act.speed": "Speed (mph)", "act.incline": "Incline (%)", "act.minutes": "Minutes", "act.steps": "Steps", "act.kcal": "kcal",
    "act.label.tread": "Treadmill {min} min · {spd} mph · {inc}%", "act.label.lift": "Weight training {min} min",
    "act.label.steps": "Walking {n} steps", "act.label.other": "Other activity",

    "how.title": "How this is calculated",
    "how.bmr": "<b>BMR</b> uses Mifflin-St Jeor (weight, height, age and sex). If you enter a body fat %, it's averaged with Katch-McArdle, which uses your lean mass.",
    "how.life": "<b>Daily life</b> multiplies BMR to cover a normal day at your activity level, including digesting food.",
    "how.tread": "<b>Treadmill</b> burn uses the ACSM walking formula from speed, incline and your weight, counting only what you burn above resting, because BMR already covers that. It assumes you don't hold the handrails. Treadmill displays usually show total calories, so they read higher.",
    "how.lift": "<b>Weight training</b> uses MET values for resistance training (moderate 3.5, hard 5.0). Most of a session is rest between sets, which is why it burns less than cardio.",
    "how.weight": "<b>Weight change</b> uses about 7,700 kcal per kg of body fat. Water and food in your gut make the scale swing day to day, so judge trends over 2–3 weeks.",
    "how.accuracy": "<b>Accuracy</b>: expect about ±10%. If your weight trend over 3–4 weeks doesn't match the estimate, adjust “Daily life” until it does. This is an estimate, not medical advice.",

    "food.chickenbreast": "Chicken breast, skinless (raw)", "food.chickenthigh": "Chicken thigh, skinless (raw)", "food.beef": "Beef mince, 10% fat (raw)",
    "food.salmon": "Salmon (raw)", "food.tuna": "Tuna, canned in water, drained", "food.sardine": "Sardines, canned in oil, drained",
    "food.egg": "Egg, large", "food.yogurt": "Greek yogurt, plain, non-fat", "food.milk": "Milk, whole", "food.whey": "Protein powder (1 scoop)",
    "food.oats": "Oats (dry)", "food.rice": "White rice (cooked)", "food.pasta": "Pasta (cooked)", "food.bread": "Bread or pita",
    "food.potato": "Potato, boiled with skin", "food.lentils": "Lentils (cooked)", "food.banana": "Banana", "food.apple": "Apple",
    "food.dates": "Dates", "food.pb": "Peanut butter", "food.oil": "Cooking or olive oil", "food.fries": "French fries",
    "food.custom": "Something else (enter kcal)", "food.other": "Other food",
    "food.unit.g": "Grams", "food.unit.ml": "ml", "food.unit.each": "How many", "food.unit.scoop": "Scoops", "food.unit.kcal": "kcal",
    "food.amt.g": "{a} g", "food.amt.ml": "{a} ml", "food.amt.each": "{a} ×", "food.amt.scoop": "{a} scoop(s)", "food.amt.kcal": "{a} kcal"
  }
};

/* Languages offered in Settings. Arabic is added here once its strings are complete and reviewed. */
const LANGS = [{ code: "en", name: "English", dir: "ltr" }];

let LANG = "en";
const MISSING = new Set();     // keys asked for but not defined (checked by the tests)

function lookup(key) {
  const tbl = STRINGS[LANG] || {};
  if (key in tbl) return tbl[key];
  if (key in STRINGS.en) return STRINGS.en[key];
  MISSING.add(key);
  return key;
}
function fill(s, vars) { return vars ? String(s).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : String(s); }
function t(key, vars) { const v = lookup(key); return fill(typeof v === "object" ? (v.other || "") : v, vars); }
let pluralRules = new Intl.PluralRules("en");
function tn(key, n, vars) {
  const v = lookup(key);
  if (typeof v !== "object") return fill(v, Object.assign({ n }, vars));
  const form = pluralRules.select(n);
  return fill(v[form] !== undefined ? v[form] : v.other, Object.assign({ n }, vars));
}
function setLanguage(code) {
  const L = LANGS.find(l => l.code === code) || LANGS[0];
  LANG = L.code;
  pluralRules = new Intl.PluralRules(L.code);
  document.documentElement.lang = L.code;
  document.documentElement.dir = L.dir;
}
/* Fill static markup: data-i18n (text), data-i18n-html (trusted markup from STRINGS), data-i18n-aria (aria-label) */
function applyI18n(root) {
  const r = root || document;
  r.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
  r.querySelectorAll("[data-i18n-html]").forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  r.querySelectorAll("[data-i18n-aria]").forEach(el => { el.setAttribute("aria-label", t(el.dataset.i18nAria)); });
}
/* Only for strings from STRINGS whose placeholders are numbers */
function setHtml(el, html) { el.innerHTML = html; }
function escAttr(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

/* Numbers always display as 1 2 3. Typed input also accepts Arabic-Indic (٠-٩) and Persian (۰-۹) digits
   and the Arabic decimal mark (٫), which many Arabic phone keyboards produce. */
function normDigits(s) {
  return String(s).replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
                  .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0))
                  .replace(/[٫,]/g, ".");
}
function cleanNumber(s, max) {
  let v = normDigits(s).replace(/[^0-9.]/g, "");
  const i = v.indexOf(".");
  if (i >= 0) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/\./g, "");
  return v.slice(0, max || 6);
}
const NUM_FMT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
function fmtInt(n) { return NUM_FMT.format(Math.round(n || 0)); }
