/* Lift Ledger: calorie calculator. Stores its own data under "ll-cal" and "ll-whatif"; never touches workout logs. */
"use strict";

const CAL_KEY = "ll-cal", WHATIF_KEY = "ll-whatif";
const CAL_DEFAULT = {
  weight: 75, height: 175, age: 30, sex: "male", bf: 0, act: 1.2, target: 20,
  trainDays: 3, cardioDays: 0,
  warmMin: 5, warmSpd: 3, warmInc: 0, liftMin: 60, liftMet: 5,
  cardMin: 30, cardSpd: 3, cardInc: 5,
  usual: [], highDays: 0, highExtra: 500
};
let CAL = Object.assign({}, CAL_DEFAULT, load(CAL_KEY, {}));
let WHATIF = Object.assign({ type: "training", base: true, foods: [], acts: [] }, load(WHATIF_KEY, {}));

/* Per 100 g (or per item / scoop). Typical values from public nutrition tables; check your labels. */
const FOODS = [
  { k: "chickenbreast", n: "Chicken breast, skinless (raw)", kcal: 120, p: 22.5, f: 2.6, c: 0, u: "g" },
  { k: "chickenthigh", n: "Chicken thigh, skinless (raw)", kcal: 120, p: 19.5, f: 4.2, c: 0, u: "g" },
  { k: "beef", n: "Beef mince, 10% fat (raw)", kcal: 176, p: 20, f: 10, c: 0, u: "g" },
  { k: "salmon", n: "Salmon (raw)", kcal: 208, p: 20, f: 13, c: 0, u: "g" },
  { k: "tuna", n: "Tuna, canned in water, drained", kcal: 116, p: 25.5, f: 0.8, c: 0, u: "g" },
  { k: "sardine", n: "Sardines, canned in oil, drained", kcal: 208, p: 24.6, f: 11.5, c: 0, u: "g" },
  { k: "egg", n: "Egg, large", kcal: 72, p: 6.3, f: 4.8, c: 0.4, u: "each" },
  { k: "yogurt", n: "Greek yogurt, plain, non-fat", kcal: 59, p: 10.2, f: 0.4, c: 3.6, u: "g" },
  { k: "milk", n: "Milk, whole", kcal: 61, p: 3.2, f: 3.3, c: 4.8, u: "ml" },
  { k: "whey", n: "Protein powder (1 scoop)", kcal: 110, p: 25, f: 0.5, c: 1, u: "scoop" },
  { k: "oats", n: "Oats (dry)", kcal: 389, p: 16.9, f: 6.9, c: 66.3, u: "g" },
  { k: "rice", n: "White rice (cooked)", kcal: 130, p: 2.7, f: 0.3, c: 28.2, u: "g" },
  { k: "pasta", n: "Pasta (cooked)", kcal: 158, p: 5.8, f: 0.9, c: 30.9, u: "g" },
  { k: "bread", n: "Bread or pita", kcal: 270, p: 9, f: 3, c: 52, u: "g" },
  { k: "potato", n: "Potato, boiled with skin", kcal: 87, p: 1.9, f: 0.1, c: 20.1, u: "g" },
  { k: "lentils", n: "Lentils (cooked)", kcal: 116, p: 9, f: 0.4, c: 20, u: "g" },
  { k: "banana", n: "Banana", kcal: 89, p: 1.1, f: 0.3, c: 22.8, u: "g" },
  { k: "apple", n: "Apple", kcal: 52, p: 0.3, f: 0.2, c: 13.8, u: "g" },
  { k: "dates", n: "Dates", kcal: 282, p: 2.5, f: 0.4, c: 75, u: "g" },
  { k: "pb", n: "Peanut butter", kcal: 588, p: 25, f: 50, c: 20, u: "g" },
  { k: "oil", n: "Cooking or olive oil", kcal: 884, p: 0, f: 100, c: 0, u: "g" },
  { k: "fries", n: "French fries", kcal: 312, p: 3.4, f: 15, c: 41, u: "g" },
  { k: "custom", n: "Something else (enter kcal)", u: "kcal" }
];
const foodBy = k => FOODS.find(f => f.k === k);
const per = f => (f.u === "g" || f.u === "ml") ? 100 : 1;
function foodMacros(k, amt) {
  const f = foodBy(k); const a = Math.max(0, +amt || 0);
  if (!f || f.u === "kcal") return { kcal: a, p: 0, f: 0, c: 0 };
  const m = a / per(f);
  return { kcal: f.kcal * m, p: f.p * m, f: f.f * m, c: f.c * m };
}
const addM = (a, b) => ({ kcal: a.kcal + b.kcal, p: a.p + b.p, f: a.f + b.f, c: a.c + b.c });
const ZERO = { kcal: 0, p: 0, f: 0, c: 0 };
const r0 = n => Math.round(n).toLocaleString("en-US");
const sgn = n => (n > 0 ? "+" : n < 0 ? "−" : "±") + r0(Math.abs(n));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(+v || 0)));

/* ACSM walking equation; kcal ABOVE resting for the bout (valid for walking speeds) */
function treadNet(mph, gradePct, min, kg) {
  const s = mph * 26.8224, g = gradePct / 100;
  const vo2 = mph <= 3.7 ? 0.1 * s + 1.8 * s * g : 0.2 * s + 0.9 * s * g;
  return vo2 * kg / 1000 * 5 * min;
}
const liftNet = (met, min, kg) => Math.max(0, met - 1) * kg * min / 60;
const stepNet = (steps, kg, cm) => steps * 0.5 * kg * (cm * 0.415 / 100) / 1000;

function calc() {
  const kg = +CAL.weight || 0, cm = +CAL.height || 0, age = +CAL.age || 30, bf = +CAL.bf || 0;
  const lean = kg * (1 - bf / 100);
  const mifflin = 10 * kg + 6.25 * cm - 5 * age + (CAL.sex === "female" ? -161 : 5);
  const katch = bf > 0 ? 370 + 21.6 * lean : null;
  const bmr = katch === null ? mifflin : (katch + mifflin) / 2;
  const life = bmr * (+CAL.act || 1.2);
  const warm = treadNet(+CAL.warmSpd || 0, +CAL.warmInc || 0, +CAL.warmMin || 0, kg);
  const lift = liftNet(+CAL.liftMet || 0, +CAL.liftMin || 0, kg);
  const card = treadNet(+CAL.cardSpd || 0, +CAL.cardInc || 0, +CAL.cardMin || 0, kg);
  const nt = clamp(CAL.trainDays, 0, 7), nc = clamp(CAL.cardioDays, 0, 7 - nt), nr = 7 - nt - nc;
  const days = { training: life + warm + lift, cardio: life + card, rest: life };
  const avg = (nt * days.training + nc * days.cardio + nr * days.rest) / 7;
  const usual = Array.isArray(CAL.usual) ? CAL.usual : [];
  const base = usual.reduce((m, it) => addM(m, foodMacros(it.k, it.a)), ZERO);
  const hd = clamp(CAL.highDays, 0, 7);
  const avgIn = (base.kcal * 7 + hd * (+CAL.highExtra || 0)) / 7;
  const bal = avgIn - avg;
  return { kg, age, bf, lean, katch, mifflin, bmr, life, warm, lift, card, days, nt, nc, nr, avg, base, hasDiet: usual.length > 0,
           avgIn, bal, pct: avg ? bal / avg * 100 : 0, t: Math.min(50, Math.max(1, +CAL.target || 20)) / 100 };
}

const BANDS = [
  { lo: -99, hi: -35, n: "Very aggressive deficit", d: "Fast fat loss; building muscle is unlikely", col: "#dc2626" },
  { lo: -35, hi: -25, n: "Aggressive deficit", d: "Quick fat loss; muscle gain is hard", col: "#f97316" },
  { lo: -25, hi: -15, n: "Moderate deficit", d: "Steady fat loss; recomp still possible", col: "#16a34a" },
  { lo: -15, hi: -5, n: "Mild deficit", d: "Slow fat loss; good for recomp", col: "#86c99a" },
  { lo: -5, hi: 5, n: "Maintenance", d: "Weight stays about the same", col: "#b9c2cf" },
  { lo: 5, hi: 15, n: "Lean surplus", d: "Slow gain, mostly muscle if training hard", col: "#93b4f5" },
  { lo: 15, hi: 99, n: "Surplus", d: "Faster gain, more of it fat", col: "#2f5fd0" }
];
const bandOf = p => BANDS.find(b => p >= b.lo && p < b.hi) || BANDS[BANDS.length - 1];
const SC_LO = -50, SC_HI = 30, pos = p => (Math.min(SC_HI, Math.max(SC_LO, p)) - SC_LO) / (SC_HI - SC_LO) * 100;

function renderLadder(p, target, show) {
  const el = $("cLadder"); el.innerHTML = "";
  BANDS.forEach(b => {
    const lo = Math.max(SC_LO, b.lo), hi = Math.min(SC_HI, b.hi);
    const i = document.createElement("i"); i.style.width = ((hi - lo) / (SC_HI - SC_LO) * 100) + "%"; i.style.background = b.col; el.appendChild(i);
  });
  [-target, 0, target].forEach(v => { const t = document.createElement("span"); t.className = "ltick"; t.style.left = pos(v) + "%"; el.appendChild(t); });
  if (show) { const m = document.createElement("span"); m.className = "lmark"; m.style.left = pos(p) + "%"; el.appendChild(m); }
  const sc = $("cScale"); sc.innerHTML = "";
  [[SC_LO, "−50%"], [-target, "−" + target + "%"], [0, "0"], [target, "+" + target + "%"]].forEach(([v, l]) => {
    const s = document.createElement("span"); s.style.left = Math.min(96, Math.max(4, pos(v))) + "%"; s.textContent = l; sc.appendChild(s);
  });
  const ul = $("cBands"); ul.innerHTML = "";
  const cur = show ? bandOf(p) : null;
  BANDS.slice().reverse().forEach(b => {
    const li = document.createElement("li"); if (b === cur) li.className = "on";
    const rng = b.lo <= -99 ? "below −35%" : b.hi >= 99 ? "above +15%" : (b.lo > 0 ? "+" : b.lo < 0 ? "−" : "") + Math.abs(b.lo) + " to " + (b.hi > 0 ? "+" : b.hi < 0 ? "−" : "") + Math.abs(b.hi) + "%";
    li.innerHTML = '<i style="background:' + b.col + '"></i><span><span class="bn"></span><br><span class="bd" style="font-weight:400;color:var(--muted)"></span></span><small>' + rng + '</small>';
    li.querySelector(".bn").textContent = b.n + (b === cur ? " · you are here" : "");
    li.querySelector(".bd").textContent = b.d;
    ul.appendChild(li);
  });
}

function renderCalOutputs() {
  const R = calc(), T = R.t, tp = Math.round(T * 100);
  if (R.hasDiet) {
    $("cPct").textContent = (R.pct > 0 ? "+" : R.pct < 0 ? "−" : "") + Math.abs(Math.round(R.pct)) + "%";
    $("cBand").textContent = bandOf(R.pct).n;
    $("cHero1").innerHTML = "You eat about <b>" + r0(R.avgIn) + " kcal</b> a day on average, against a maintenance of <b>" + r0(R.avg) + " kcal</b>. That's <b>" + r0(Math.abs(R.bal)) + " kcal " + (R.bal < 0 ? "below" : "above") + "</b> maintenance, or about <b>" + Math.abs(R.bal * 7 / 7700).toFixed(2) + " kg " + (R.bal < 0 ? "lost" : "gained") + " per week</b>.";
    $("cHero2").innerHTML = "A −" + tp + "% deficit is <b>" + r0(R.avg * (1 - T)) + " kcal</b> a day and a +" + tp + "% surplus is <b>" + r0(R.avg * (1 + T)) + " kcal</b>.";
  } else {
    $("cPct").textContent = r0(R.avg);
    $("cBand").textContent = "kcal maintenance";
    $("cHero1").innerHTML = "That's what you burn on an average day, based on your details and weekly routine in Settings.";
    $("cHero2").innerHTML = "Add your usual day of eating below to see whether you're in a deficit or a surplus.";
  }
  renderLadder(R.pct, tp, R.hasDiet);
  $("tBmr").textContent = r0(R.bmr);
  $("tMaint").textContent = r0(R.avg);
  $("tDefK").textContent = "Deficit −" + tp + "%"; $("tSurK").textContent = "Surplus +" + tp + "%";
  $("tDef").textContent = r0(R.avg * (1 - T)); $("tDefS").textContent = "≈ " + (R.avg * T * 7 / 7700).toFixed(2) + " kg lost a week";
  $("tSur").textContent = r0(R.avg * (1 + T)); $("tSurS").textContent = "≈ " + (R.avg * T * 7 / 7700).toFixed(2) + " kg gained a week";
  const row = (n, s, v, cls) => '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + n + (s ? '<small>' + s + '</small>' : '') + '</td><td><b>' + r0(v) + '</b></td><td>' + r0(v * (1 - T)) + '</td><td>' + r0(v * (1 + T)) + '</td></tr>';
  const x = n => " <small style=\"display:inline;color:var(--muted)\">× " + n + "</small>";
  $("cTable").innerHTML = '<tr><th>Day</th><th>Maintain</th><th>−' + tp + '%</th><th>+' + tp + '%</th></tr>' +
    (R.nt ? row("Training" + x(R.nt), "+" + r0(R.warm) + " warm-up, +" + r0(R.lift) + " lifting", R.days.training) : "") +
    (R.nc ? row("Cardio" + x(R.nc), "+" + r0(R.card) + " treadmill", R.days.cardio) : "") +
    (R.nr ? row("Rest" + x(R.nr), "Daily life only", R.days.rest) : "") +
    row("Average", "BMR " + r0(R.bmr) + " × " + (+CAL.act) + " daily life", R.avg, "avg");
  $("cTableSub").textContent = "What you burn on each type of day, and how many of each you have a week.";
  $("rBaseOut").innerHTML = R.hasDiet
    ? "Usual day: <span><b>" + r0(R.base.kcal) + "</b> kcal</span><span><b>" + r0(R.base.p) + "</b> g protein" + (R.kg ? " (" + (R.base.p / R.kg).toFixed(1) + " g/kg)" : "") + "</span><span><b>" + r0(R.base.f) + "</b> g fat</span><span><b>" + r0(R.base.c) + "</b> g carbs</span>"
    : "";
  $("rWeekOut").innerHTML = R.hasDiet ? "Week average: <span><b>" + r0(R.avgIn) + "</b> kcal a day</span>" + (+CAL.highDays ? "<span>Bigger days ≈ <b>" + r0(R.base.kcal + (+CAL.highExtra || 0)) + "</b> kcal</span>" : "") : "";
  $("wkNote").textContent = "That leaves " + R.nr + " rest day" + (R.nr === 1 ? "" : "s") + " a week.";
  $("pAgeNote").textContent = R.katch === null
    ? "BMR " + r0(R.bmr) + " kcal from Mifflin-St Jeor. Add a body fat % to also use Katch-McArdle."
    : "Lean mass " + R.lean.toFixed(1) + " kg · BMR " + r0(R.katch) + " (Katch-McArdle) and " + r0(R.mifflin) + " (Mifflin-St Jeor), averaged to " + r0(R.bmr) + ".";
  renderWhatIfResult(R);
}

/* ---- inputs ---- */
const BIND = { pWeight: "weight", pHeight: "height", pAge: "age", pBf: "bf", pSex: "sex", pAct: "act", pTarget: "target",
  wkTrain: "trainDays", wkCardio: "cardioDays", rHighDays: "highDays", rHighExtra: "highExtra",
  tWm: "warmMin", tWs: "warmSpd", tWi: "warmInc", tLm: "liftMin", tLi: "liftMet", cMin: "cardMin", cSpd: "cardSpd", cInc: "cardInc" };
function saveCal() { store(CAL_KEY, CAL); }
function fillInputs() {
  Object.entries(BIND).forEach(([id, k]) => { const el = $(id); if (el && document.activeElement !== el) el.value = k === "bf" && !+CAL[k] ? "" : CAL[k]; });
}
Object.entries(BIND).forEach(([id, k]) => {
  const el = $(id); if (!el) return;
  const ev = el.tagName === "SELECT" ? "change" : "input";
  el.addEventListener(ev, () => {
    let v = el.value;
    if (el.tagName !== "SELECT") { v = v.replace(",", ".").replace(/[^0-9.]/g, ""); if (v !== el.value) el.value = v; }
    CAL[k] = k === "sex" ? v : (v === "" ? 0 : parseFloat(v));
    saveCal(); renderCalOutputs();
  });
});

/* ---- food pickers ---- */
const unitLabel = f => f.u === "g" ? "Grams" : f.u === "ml" ? "ml" : f.u === "each" ? "How many" : f.u === "scoop" ? "Scoops" : "kcal";
const amtText = (f, a) => f.u === "kcal" ? r0(a) + " kcal" : a + (f.u === "g" ? " g" : f.u === "ml" ? " ml" : f.u === "each" ? " ×" : " scoop" + (a == 1 ? "" : "s"));
["fSel", "uSel"].forEach(id => FOODS.forEach(f => { const o = document.createElement("option"); o.value = f.k; o.textContent = f.n; $(id).appendChild(o); }));
function syncFoodUnit() { $("fAmtL").textContent = unitLabel(foodBy($("fSel").value)); $("uAmtL").textContent = unitLabel(foodBy($("uSel").value)); }
$("fSel").addEventListener("change", syncFoodUnit);
$("uSel").addEventListener("change", syncFoodUnit);
const readAmt = id => parseFloat(($(id).value || "").replace(",", "."));

function itemRow(label, value, onRemove) {
  const li = document.createElement("li");
  const s = document.createElement("span"); s.textContent = label;
  const b = document.createElement("b"); b.textContent = value;
  const x = document.createElement("button"); x.type = "button"; x.textContent = "×"; x.setAttribute("aria-label", "Remove " + label);
  x.addEventListener("click", onRemove);
  li.append(s, b, x); return li;
}
function renderUsual() {
  const ul = $("uList"); ul.innerHTML = "";
  if (!CAL.usual.length) ul.innerHTML = '<li class="none">Nothing added yet</li>';
  CAL.usual.forEach((it, idx) => {
    const f = foodBy(it.k) || FOODS[FOODS.length - 1];
    ul.appendChild(itemRow((f.u === "kcal" ? "Other food" : f.n) + " · " + amtText(f, it.a), r0(foodMacros(it.k, it.a).kcal) + " kcal",
      () => { CAL.usual.splice(idx, 1); saveCal(); renderUsual(); renderCalOutputs(); }));
  });
}
$("uAdd").addEventListener("click", () => {
  const a = readAmt("uAmt"); if (!(a > 0)) { $("uAmt").focus(); return; }
  if (!Array.isArray(CAL.usual)) CAL.usual = [];
  CAL.usual.push({ k: $("uSel").value, a }); $("uAmt").value = ""; saveCal(); renderUsual(); renderCalOutputs();
});

/* ---- what-if ---- */
function saveWhatIf() { store(WHATIF_KEY, WHATIF); }
$("fAdd").addEventListener("click", () => {
  const a = readAmt("fAmt"); if (!(a > 0)) { $("fAmt").focus(); return; }
  WHATIF.foods.push({ k: $("fSel").value, a }); $("fAmt").value = ""; saveWhatIf(); renderWhatIfLists(); renderCalOutputs();
});
function syncActFields() {
  const t = $("aSel").value;
  $("aL1").textContent = t === "steps" ? "Steps" : t === "other" ? "kcal" : "Minutes";
  $("aMore").hidden = t !== "tread";
}
$("aSel").addEventListener("change", syncActFields);
function actNet(a) {
  const kg = +CAL.weight || 0;
  if (a.t === "tread") return treadNet(a.spd || 0, a.inc || 0, a.v || 0, kg);
  if (a.t === "lift") return liftNet(+CAL.liftMet || 5, a.v || 0, kg);
  if (a.t === "steps") return stepNet(a.v || 0, kg, +CAL.height || 175);
  return a.v || 0;
}
function actLabel(a) {
  if (a.t === "tread") return "Treadmill " + a.v + " min · " + a.spd + " mph · " + a.inc + "%";
  if (a.t === "lift") return "Weight training " + a.v + " min";
  if (a.t === "steps") return "Walking " + r0(a.v) + " steps";
  return "Other activity";
}
$("aAdd").addEventListener("click", () => {
  const t = $("aSel").value;
  const v = readAmt("aV1"); if (!(v > 0)) { $("aV1").focus(); return; }
  const a = { t, v };
  if (t === "tread") { a.spd = readAmt("aV2") || 0; a.inc = readAmt("aV3") || 0; if (!(a.spd > 0)) { $("aV2").focus(); return; } }
  WHATIF.acts.push(a); $("aV1").value = ""; saveWhatIf(); renderWhatIfLists(); renderCalOutputs();
});
function renderWhatIfLists() {
  document.querySelectorAll("#wType button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.t === WHATIF.type)));
  $("wBase").checked = !!WHATIF.base;
  const fl = $("fList"); fl.innerHTML = "";
  if (!WHATIF.foods.length) fl.innerHTML = '<li class="none">No extra food added</li>';
  WHATIF.foods.forEach((it, idx) => {
    const f = foodBy(it.k) || FOODS[FOODS.length - 1];
    fl.appendChild(itemRow((f.u === "kcal" ? "Other food" : f.n) + " · " + amtText(f, it.a), r0(foodMacros(it.k, it.a).kcal) + " kcal",
      () => { WHATIF.foods.splice(idx, 1); saveWhatIf(); renderWhatIfLists(); renderCalOutputs(); }));
  });
  const al = $("aList"); al.innerHTML = "";
  if (!WHATIF.acts.length) al.innerHTML = '<li class="none">No extra activity added</li>';
  WHATIF.acts.forEach((a, idx) => {
    al.appendChild(itemRow(actLabel(a), "+" + r0(actNet(a)) + " kcal", () => { WHATIF.acts.splice(idx, 1); saveWhatIf(); renderWhatIfLists(); renderCalOutputs(); }));
  });
}
document.querySelectorAll("#wType button").forEach(b => b.addEventListener("click", () => { WHATIF.type = b.dataset.t; saveWhatIf(); renderWhatIfLists(); renderCalOutputs(); }));
$("wBase").addEventListener("change", () => { WHATIF.base = $("wBase").checked; saveWhatIf(); renderCalOutputs(); });

function renderWhatIfResult(R) {
  let eat = WHATIF.base ? R.base : ZERO;
  WHATIF.foods.forEach(it => { eat = addM(eat, foodMacros(it.k, it.a)); });
  const extra = WHATIF.acts.reduce((s, a) => s + actNet(a), 0);
  const burn = (R.days[WHATIF.type] || R.days.rest) + extra;
  const bal = eat.kcal - burn, pct = burn ? bal / burn * 100 : 0;
  $("wIn").textContent = r0(eat.kcal); $("wInS").textContent = r0(eat.p) + " g protein";
  $("wOut").textContent = r0(burn); $("wOutS").textContent = extra ? "incl. +" + r0(extra) + " extra activity" : "maintenance for this day";
  $("wBal").textContent = sgn(bal); $("wBalS").textContent = (pct > 0 ? "+" : pct < 0 ? "−" : "") + Math.abs(Math.round(pct)) + "% · " + bandOf(pct).n.toLowerCase();
  $("wFat").textContent = (bal < 0 ? "−" : "+") + r0(Math.abs(bal) / 7.7) + " g";
  $("wFatS").textContent = bal < 0 ? "body fat used that day" : "stored; repeated, it adds up";
}

function renderCal() { fillInputs(); syncFoodUnit(); syncActFields(); renderUsual(); renderWhatIfLists(); renderCalOutputs(); }
if (typeof renderAll === "function" && typeof appMode !== "undefined" && appMode !== "workout") renderAll();
