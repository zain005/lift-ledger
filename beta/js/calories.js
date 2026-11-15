/* Lift Ledger: calorie calculator. Stores its own data under PREFIX + "cal" and "whatif"; never touches workout logs. */
"use strict";

const CAL_KEY = PREFIX + "cal", WHATIF_KEY = PREFIX + "whatif";
const CAL_DEFAULT = {
  weight: 75, height: 175, age: 30, sex: "male", bf: 0, act: 1.2, target: 20,
  trainDays: 3, cardioDays: 0,
  warmMin: 5, warmSpd: 3, warmInc: 0, liftMin: 60, liftMet: 5,
  cardMin: 30, cardSpd: 3, cardInc: 5,
  usual: [], highDays: 0, highExtra: 500
};
let CAL = Object.assign({}, CAL_DEFAULT, load(CAL_KEY, {}));
let WHATIF = Object.assign({ type: "training", base: true, foods: [], acts: [] }, load(WHATIF_KEY, {}));

/* Per 100 g (or per item / scoop). Typical values from public nutrition tables; check your labels. Names come from the strings file. */
const FOODS = [
  { k: "chickenbreast", kcal: 120, p: 22.5, f: 2.6, c: 0, u: "g" },
  { k: "chickenthigh", kcal: 120, p: 19.5, f: 4.2, c: 0, u: "g" },
  { k: "beef", kcal: 176, p: 20, f: 10, c: 0, u: "g" },
  { k: "salmon", kcal: 208, p: 20, f: 13, c: 0, u: "g" },
  { k: "tuna", kcal: 116, p: 25.5, f: 0.8, c: 0, u: "g" },
  { k: "sardine", kcal: 208, p: 24.6, f: 11.5, c: 0, u: "g" },
  { k: "egg", kcal: 72, p: 6.3, f: 4.8, c: 0.4, u: "each" },
  { k: "yogurt", kcal: 59, p: 10.2, f: 0.4, c: 3.6, u: "g" },
  { k: "milk", kcal: 61, p: 3.2, f: 3.3, c: 4.8, u: "ml" },
  { k: "whey", kcal: 110, p: 25, f: 0.5, c: 1, u: "scoop" },
  { k: "oats", kcal: 389, p: 16.9, f: 6.9, c: 66.3, u: "g" },
  { k: "rice", kcal: 130, p: 2.7, f: 0.3, c: 28.2, u: "g" },
  { k: "pasta", kcal: 158, p: 5.8, f: 0.9, c: 30.9, u: "g" },
  { k: "bread", kcal: 270, p: 9, f: 3, c: 52, u: "g" },
  { k: "potato", kcal: 87, p: 1.9, f: 0.1, c: 20.1, u: "g" },
  { k: "lentils", kcal: 116, p: 9, f: 0.4, c: 20, u: "g" },
  { k: "banana", kcal: 89, p: 1.1, f: 0.3, c: 22.8, u: "g" },
  { k: "apple", kcal: 52, p: 0.3, f: 0.2, c: 13.8, u: "g" },
  { k: "dates", kcal: 282, p: 2.5, f: 0.4, c: 75, u: "g" },
  { k: "pb", kcal: 588, p: 25, f: 50, c: 20, u: "g" },
  { k: "oil", kcal: 884, p: 0, f: 100, c: 0, u: "g" },
  { k: "fries", kcal: 312, p: 3.4, f: 15, c: 41, u: "g" },
  { k: "custom", u: "kcal" }
];
const foodBy = k => FOODS.find(f => f.k === k);
const foodName = f => t("food." + f.k);
const per = f => (f.u === "g" || f.u === "ml") ? 100 : 1;
function foodMacros(k, amt) {
  const f = foodBy(k); const a = Math.max(0, +amt || 0);
  if (!f || f.u === "kcal") return { kcal: a, p: 0, f: 0, c: 0 };
  const m = a / per(f);
  return { kcal: f.kcal * m, p: f.p * m, f: f.f * m, c: f.c * m };
}
const addM = (a, b) => ({ kcal: a.kcal + b.kcal, p: a.p + b.p, f: a.f + b.f, c: a.c + b.c });
const ZERO = { kcal: 0, p: 0, f: 0, c: 0 };
const r0 = n => fmtInt(n);
const sgn = n => (n > 0 ? "+" : n < 0 ? "−" : "±") + r0(Math.abs(n));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(+v || 0)));
const pctText = p => (p > 0 ? "+" : p < 0 ? "−" : "") + Math.abs(Math.round(p)) + "%";

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
  { lo: -99, hi: -35, k: "veryAggressive", col: "#dc2626" },
  { lo: -35, hi: -25, k: "aggressive", col: "#f97316" },
  { lo: -25, hi: -15, k: "moderate", col: "#16a34a" },
  { lo: -15, hi: -5, k: "mild", col: "#86c99a" },
  { lo: -5, hi: 5, k: "maintenance", col: "#b9c2cf" },
  { lo: 5, hi: 15, k: "lean", col: "#93b4f5" },
  { lo: 15, hi: 99, k: "surplus", col: "#2f5fd0" }
];
const bandOf = p => BANDS.find(b => p >= b.lo && p < b.hi) || BANDS[BANDS.length - 1];
const bandName = b => t("band." + b.k);
const SC_LO = -50, SC_HI = 30, pos = p => (Math.min(SC_HI, Math.max(SC_LO, p)) - SC_LO) / (SC_HI - SC_LO) * 100;
const signed = v => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v);

function renderLadder(p, target, show) {
  const el = $("cLadder"); el.innerHTML = "";
  BANDS.forEach(b => {
    const lo = Math.max(SC_LO, b.lo), hi = Math.min(SC_HI, b.hi);
    const i = document.createElement("i"); i.style.width = ((hi - lo) / (SC_HI - SC_LO) * 100) + "%"; i.style.background = b.col; el.appendChild(i);
  });
  [-target, 0, target].forEach(v => { const tk = document.createElement("span"); tk.className = "ltick"; tk.style.left = pos(v) + "%"; el.appendChild(tk); });
  if (show) { const m = document.createElement("span"); m.className = "lmark"; m.dataset.label = t("cal.you"); m.style.left = pos(p) + "%"; el.appendChild(m); }
  const sc = $("cScale"); sc.innerHTML = "";
  [[SC_LO, "−50%"], [-target, "−" + target + "%"], [0, "0"], [target, "+" + target + "%"]].forEach(([v, l]) => {
    const s = document.createElement("span"); s.style.left = Math.min(96, Math.max(4, pos(v))) + "%"; s.textContent = l; sc.appendChild(s);
  });
  const ul = $("cBands"); ul.innerHTML = "";
  const cur = show ? bandOf(p) : null;
  BANDS.slice().reverse().forEach(b => {
    const li = document.createElement("li"); if (b === cur) li.className = "on";
    const rng = b.lo <= -99 ? t("band.below", { v: "−35%" }) : b.hi >= 99 ? t("band.above", { v: "+15%" }) : t("band.range", { a: signed(b.lo), b: signed(b.hi) + "%" });
    li.innerHTML = '<i style="background:' + b.col + '"></i><span><span class="bn"></span><br><span class="bd" style="font-weight:400;color:var(--muted)"></span></span><small dir="ltr"></small>';
    li.querySelector(".bn").textContent = bandName(b) + (b === cur ? " · " + t("band.youAreHere") : "");
    li.querySelector(".bd").textContent = t("band." + b.k + "Desc");
    li.querySelector("small").textContent = rng;
    ul.appendChild(li);
  });
}

function renderCalOutputs() {
  const R = calc(), T = R.t, tp = Math.round(T * 100);
  if (R.hasDiet) {
    $("cPct").textContent = pctText(R.pct);
    $("cBand").textContent = bandName(bandOf(R.pct));
    setHtml($("cHero1"), t(R.bal < 0 ? "cal.hero.below" : "cal.hero.above", {
      eat: r0(R.avgIn), maint: r0(R.avg), diff: r0(Math.abs(R.bal)), kg: Math.abs(R.bal * 7 / 7700).toFixed(2) }));
    setHtml($("cHero2"), t("cal.hero.targets", { tp, def: r0(R.avg * (1 - T)), sur: r0(R.avg * (1 + T)) }));
  } else {
    $("cPct").textContent = r0(R.avg);
    $("cBand").textContent = t("cal.kcalMaint");
    setHtml($("cHero1"), t("cal.hero.noDiet1"));
    setHtml($("cHero2"), t("cal.hero.noDiet2"));
  }
  renderLadder(R.pct, tp, R.hasDiet);
  $("tBmr").textContent = r0(R.bmr);
  $("tMaint").textContent = r0(R.avg);
  $("tDefK").textContent = t("cal.deficitN", { tp }); $("tSurK").textContent = t("cal.surplusN", { tp });
  $("tDef").textContent = r0(R.avg * (1 - T)); $("tDefS").textContent = t("cal.kgLostWeek", { kg: (R.avg * T * 7 / 7700).toFixed(2) });
  $("tSur").textContent = r0(R.avg * (1 + T)); $("tSurS").textContent = t("cal.kgGainedWeek", { kg: (R.avg * T * 7 / 7700).toFixed(2) });
  const tb = $("cTable"); tb.innerHTML = "";
  const tr = (cells, cls, head) => {
    const r = document.createElement("tr"); if (cls) r.className = cls;
    cells.forEach(c => { const td = document.createElement(head ? "th" : "td"); if (c && c.nodeType) td.appendChild(c); else td.textContent = c; r.appendChild(td); });
    tb.appendChild(r);
  };
  const first = (name, count, sub) => {
    const f = document.createDocumentFragment();
    f.append(name);
    if (count) { const x = document.createElement("small"); x.style.display = "inline"; x.style.color = "var(--muted)"; x.textContent = " × " + count; f.append(x); }
    const s = document.createElement("small"); s.textContent = sub; f.append(s);
    return f;
  };
  const bold = v => { const b = document.createElement("b"); b.textContent = r0(v); return b; };
  tr([t("cal.col.day"), t("cal.col.maintain"), "−" + tp + "%", "+" + tp + "%"], "", true);
  if (R.nt) tr([first(t("cal.day.training"), R.nt, t("cal.day.trainingSub", { warm: r0(R.warm), lift: r0(R.lift) })), bold(R.days.training), r0(R.days.training * (1 - T)), r0(R.days.training * (1 + T))]);
  if (R.nc) tr([first(t("cal.day.cardio"), R.nc, t("cal.day.cardioSub", { card: r0(R.card) })), bold(R.days.cardio), r0(R.days.cardio * (1 - T)), r0(R.days.cardio * (1 + T))]);
  if (R.nr) tr([first(t("cal.day.rest"), R.nr, t("cal.day.restSub")), bold(R.days.rest), r0(R.days.rest * (1 - T)), r0(R.days.rest * (1 + T))]);
  tr([first(t("cal.day.average"), 0, t("cal.day.averageSub", { bmr: r0(R.bmr), act: +CAL.act })), bold(R.avg), r0(R.avg * (1 - T)), r0(R.avg * (1 + T))], "avg");
  setHtml($("rBaseOut"), R.hasDiet ? t("cal.usualTotals", { kcal: r0(R.base.kcal), p: r0(R.base.p), pkg: R.kg ? (R.base.p / R.kg).toFixed(1) : "–", f: r0(R.base.f), c: r0(R.base.c) }) : "");
  setHtml($("rWeekOut"), R.hasDiet ? t("cal.weekAvg", { kcal: r0(R.avgIn) }) + (+CAL.highDays ? t("cal.biggerDaysTotal", { kcal: r0(R.base.kcal + (+CAL.highExtra || 0)) }) : "") : "");
  $("wkNote").textContent = tn("cal.restLeft", R.nr);
  $("pAgeNote").textContent = R.katch === null
    ? t("cal.bmrNote", { bmr: r0(R.bmr) })
    : t("cal.bmrNoteBf", { lean: R.lean.toFixed(1), katch: r0(R.katch), mifflin: r0(R.mifflin), bmr: r0(R.bmr) });
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
    if (el.tagName !== "SELECT") { v = cleanNumber(v, 8); if (v !== el.value) el.value = v; }
    CAL[k] = k === "sex" ? v : (v === "" ? 0 : parseFloat(v));
    saveCal(); renderCalOutputs();
  });
});

/* ---- food pickers ---- */
const unitLbl = f => t("food.unit." + f.u);
const amtText = (f, a) => t("food.amt." + f.u, { a: f.u === "kcal" ? r0(a) : a });
function fillFoodSelects() {
  ["fSel", "uSel"].forEach(id => {
    const sel = $(id), cur = sel.value; sel.innerHTML = "";
    FOODS.forEach(f => { const o = document.createElement("option"); o.value = f.k; o.textContent = foodName(f); sel.appendChild(o); });
    if (cur) sel.value = cur;
  });
}
function syncFoodUnit() { $("fAmtL").textContent = unitLbl(foodBy($("fSel").value) || FOODS[0]); $("uAmtL").textContent = unitLbl(foodBy($("uSel").value) || FOODS[0]); }
$("fSel").addEventListener("change", syncFoodUnit);
$("uSel").addEventListener("change", syncFoodUnit);
const readAmt = id => parseFloat(cleanNumber($(id).value || "", 8));

function itemRow(label, value, onRemove) {
  const li = document.createElement("li");
  const s = document.createElement("span"); s.textContent = label;
  const b = document.createElement("b"); b.textContent = value;
  const x = document.createElement("button"); x.type = "button"; x.textContent = "×"; x.setAttribute("aria-label", t("item.remove", { name: label }));
  x.addEventListener("click", onRemove);
  li.append(s, b, x); return li;
}
function noneRow(ul, key) { const li = document.createElement("li"); li.className = "none"; li.textContent = t(key); ul.appendChild(li); }
const foodLabel = it => { const f = foodBy(it.k) || FOODS[FOODS.length - 1]; return (f.u === "kcal" ? t("food.other") : foodName(f)) + " · " + amtText(f, it.a); };
function renderUsual() {
  const ul = $("uList"); ul.innerHTML = "";
  if (!CAL.usual.length) noneRow(ul, "cal.usualNone");
  CAL.usual.forEach((it, idx) => {
    ul.appendChild(itemRow(foodLabel(it), t("kcal.n", { n: r0(foodMacros(it.k, it.a).kcal) }),
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
  const tp = $("aSel").value;
  $("aL1").textContent = t(tp === "steps" ? "act.steps" : tp === "other" ? "act.kcal" : "act.minutes");
  $("aMore").hidden = tp !== "tread";
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
  if (a.t === "tread") return t("act.label.tread", { min: a.v, spd: a.spd, inc: a.inc });
  if (a.t === "lift") return t("act.label.lift", { min: a.v });
  if (a.t === "steps") return t("act.label.steps", { n: r0(a.v) });
  return t("act.label.other");
}
$("aAdd").addEventListener("click", () => {
  const tp = $("aSel").value;
  const v = readAmt("aV1"); if (!(v > 0)) { $("aV1").focus(); return; }
  const a = { t: tp, v };
  if (tp === "tread") { a.spd = readAmt("aV2") || 0; a.inc = readAmt("aV3") || 0; if (!(a.spd > 0)) { $("aV2").focus(); return; } }
  WHATIF.acts.push(a); $("aV1").value = ""; saveWhatIf(); renderWhatIfLists(); renderCalOutputs();
});
function renderWhatIfLists() {
  document.querySelectorAll("#wType button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.t === WHATIF.type)));
  $("wBase").checked = !!WHATIF.base;
  const fl = $("fList"); fl.innerHTML = "";
  if (!WHATIF.foods.length) noneRow(fl, "whatif.noFood");
  WHATIF.foods.forEach((it, idx) => {
    fl.appendChild(itemRow(foodLabel(it), t("kcal.n", { n: r0(foodMacros(it.k, it.a).kcal) }),
      () => { WHATIF.foods.splice(idx, 1); saveWhatIf(); renderWhatIfLists(); renderCalOutputs(); }));
  });
  const al = $("aList"); al.innerHTML = "";
  if (!WHATIF.acts.length) noneRow(al, "whatif.noAct");
  WHATIF.acts.forEach((a, idx) => {
    al.appendChild(itemRow(actLabel(a), "+" + t("kcal.n", { n: r0(actNet(a)) }), () => { WHATIF.acts.splice(idx, 1); saveWhatIf(); renderWhatIfLists(); renderCalOutputs(); }));
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
  $("wIn").textContent = r0(eat.kcal); $("wInS").textContent = t("whatif.protein", { p: r0(eat.p) });
  $("wOut").textContent = r0(burn); $("wOutS").textContent = extra ? t("whatif.inclExtra", { kcal: r0(extra) }) : t("whatif.maintDay");
  $("wBal").textContent = sgn(bal); $("wBalS").textContent = pctText(pct) + " · " + bandName(bandOf(pct));
  $("wFat").textContent = (bal < 0 ? "−" : "+") + t("g.n", { n: r0(Math.abs(bal) / 7.7) });
  $("wFatS").textContent = t(bal < 0 ? "whatif.fatUsed" : "whatif.fatStored");
}

function renderCal() { fillFoodSelects(); fillInputs(); syncFoodUnit(); syncActFields(); renderUsual(); renderWhatIfLists(); renderCalOutputs(); }
if (typeof renderAll === "function" && typeof appMode !== "undefined" && appMode !== "workout") renderAll();
