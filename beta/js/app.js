/* Lift Ledger: workout log. Plain JavaScript, no dependencies.
   All data lives in localStorage under keys that start with PREFIX (see i18n.js). */
"use strict";

const $ = id => document.getElementById(id);
const range = n => Array.from({ length: n }, (_, k) => k);
const KEY = { custom: PREFIX + "programs-custom", prog: PREFIX + "program", view: PREFIX + "view", set: PREFIX + "settings", log: id => PREFIX + "log-" + id };
function load(key, fallback) { try { const v = JSON.parse(localStorage.getItem(key)); return v === null || v === undefined ? fallback : v; } catch (e) { return fallback; } }
function store(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }

const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const PLAY_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5.5v13l10.5-6.5z"/></svg>';

/* ---------- settings ---------- */
const SET_DEFAULT = { pro: false, follow: "", videos: true, cues: true, last: true, rpeBox: true, awake: true, smartOpen: true, calTab: true, unit: "kg", theme: "system", lang: "en" };
const SAVED_SET = load(KEY.set, {}) || {};
let SET = Object.assign({}, SET_DEFAULT, SAVED_SET);
const SET_ITEMS = [
  ["setWorkout", "videos", "set.videos", "set.videosDesc"],
  ["setWorkout", "cues", "set.cues", "set.cuesDesc"],
  ["setWorkout", "last", "set.last", "set.lastDesc"],
  ["setWorkout", "rpeBox", "set.rpeBox", "set.rpeBoxDesc"],
  ["setWorkout", "awake", "set.awake", "set.awakeDesc"],
  ["setApp", "smartOpen", "set.smartOpen", "set.smartOpenDesc"],
  ["setApp", "calTab", "set.calTab", "set.calTabDesc", "pro"]
];
function saveSettings() { store(KEY.set, SET); }

/* ---------- theme ---------- */
const darkQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
function applyTheme() {
  const th = ["light", "dark", "system"].includes(SET.theme) ? SET.theme : "system";
  document.documentElement.dataset.theme = th;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = getComputedStyle(document.documentElement).getPropertyValue("--surface").trim() || "#ffffff";
}
if (darkQuery && darkQuery.addEventListener) darkQuery.addEventListener("change", applyTheme);

/* ---------- programs ---------- */
const slug = s => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
const str = (v, max) => (typeof v === "string" || typeof v === "number") ? String(v).slice(0, max || 200) : "";
const sid = s => String(s || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 24);
const fail = (key, vars) => { const e = new Error(t(key, vars)); throw e; };

/* Turn a program file into the shape the app uses. Throws an Error with a readable message if it's invalid.
   Every day and exercise gets a permanent id; logs are stored by id, so reordering never moves history. */
function normalizeProgram(raw, builtin) {
  if (!raw || typeof raw !== "object") fail("err.notProgram");
  const name = str(raw.name, 40).trim();
  if (!name) fail("err.noName");
  const weeks = raw.weeks === undefined ? 8 : Math.floor(+raw.weeks);
  if (!(weeks >= 1 && weeks <= 12)) fail("err.weeks");
  const parseDays = (days, where) => {
    if (!Array.isArray(days) || days.length < 1 || days.length > 7) fail("err.days", { where });
    const seenDay = new Set();
    return days.map((d, di) => {
      if (!d || !Array.isArray(d.exercises) || !d.exercises.length || d.exercises.length > 15) fail("err.exercises", { where, day: di + 1 });
      const dayId = sid(d.id) || "d" + (di + 1);
      if (seenDay.has(dayId)) fail("err.dupId", { id: dayId });
      seenDay.add(dayId);
      const seenEx = new Set();
      return {
        id: dayId, name: str(d.name, 30).trim() || t("day.n", { n: di + 1 }), short: str(d.short, 8).trim(),
        exercises: d.exercises.map((e, ei) => {
          const en = e && str(e.name, 60).trim();
          if (!en) fail("err.exName", { where, day: di + 1, ex: ei + 1 });
          const sets = Math.floor(+e.sets);
          if (!(sets >= 1 && sets <= 10)) fail("err.sets", { name: en });
          const exId = sid(e.id) || dayId + "e" + (ei + 1);
          if (seenEx.has(exId)) fail("err.dupId", { id: exId });
          seenEx.add(exId);
          const video = str(e.video, 300);
          return {
            id: exId, ref: sid(e.ref), name: en, sets, reps: str(e.reps, 60) || "",
            setReps: Array.isArray(e.setReps) && e.setReps.length === sets ? e.setReps.map(r => str(r, 7)) : null, type: str(e.type, 20), rpe: str(e.rpe, 16), cue: str(e.cue, 300),
            alts: Array.isArray(e.alts) ? e.alts.map(a => str(a, 60).trim()).filter(Boolean).slice(0, 8) : [],
            timed: !!e.timed, perSide: !!e.perSide,
            primary: str(e.primary, 20), secondary: Array.isArray(e.secondary) ? e.secondary.map(m => str(m, 20)).slice(0, 8) : [],
            video: /^https:\/\//.test(video) ? video : ""
          };
        })
      };
    });
  };
  const baseDays = parseDays(raw.days, t("err.where.program"));
  let phases = Array.isArray(raw.phases) && raw.phases.length ? raw.phases : [{ name: "", weeks: [1, weeks] }];
  phases = phases.map((ph, pi) => {
    const w = Array.isArray(ph.weeks) ? ph.weeks : [1, weeks];
    const from = Math.max(1, Math.floor(+w[0] || 1)), to = Math.min(weeks, Math.floor(+w[w.length - 1] || weeks));
    if (to < from) fail("err.phaseRange", { n: pi + 1 });
    const days = ph.days ? parseDays(ph.days, t("err.where.phase", { n: pi + 1 })) : baseDays;
    const rpe = ph.rpe && typeof ph.rpe === "object" ? ph.rpe : {};
    return {
      name: str(ph.name, 30), from, to,
      dayIds: days.map(d => d.id), dayNames: days.map(d => d.name), dayShort: days.map(d => d.short),
      days: days.map(d => d.exercises.map(e => Object.assign({}, e, { rpe: e.rpe || str(rpe[e.type], 16) })))
    };
  }).sort((a, b) => a.from - b.from);
  return {
    id: slug(raw.id) || slug(name), name, builtin: !!builtin, byBuilder: !!raw.builder, shared: !!raw.shared,
    repeat: weeks === 1 && !!raw.repeat,          // a one-week program that repeats with no end
    weekly: !!raw.weekly,                         // built week by week in Pro (each week is its own block)
    description: str(raw.description, 200), schedule: str(raw.schedule, 300), weeks,
    dayIds: baseDays.map(d => d.id), dayNames: baseDays.map(d => d.name), dayShort: baseDays.map(d => d.short),
    phases
  };
}

let PROGRAMS = [];          // normalized programs, built-in first
let P = null;               // current program
let LOGS = {};              // per program id: { v: 2, w1: { ex: { [exerciseId]: { s: ["", ""], alt? } }, done: { [dayId]: true } } }
let logs = {};
let view = { week: 1, day: 0 };

const progById = id => PROGRAMS.find(p => p.id === id);
/* A repeating program has as many weeks as you've trained, plus the next one; others have a fixed length */
function nwOf(p, L) {
  if (!p.repeat) return p.weeks;
  let hi = 0;
  Object.keys(L || {}).forEach(k => { const m = /^w(\d+)$/.exec(k); if (m && L[k] && L[k].done && Object.keys(L[k].done).length) hi = Math.max(hi, +m[1]); });
  return Math.max(1, hi + 1);
}
const NW = () => nwOf(P, logs);
const phaseFor = (p, w) => p.phases.find(x => w >= x.from && w <= x.to) || p.phases[p.phases.length - 1];
const phaseOf = w => phaseFor(P, w);
const phaseNum = w => P.phases.indexOf(phaseOf(w)) + 1;
const dayList = (w, d) => phaseOf(w).days[d];
const dayIdOf = (w, d) => phaseOf(w).dayIds[d];
const DPW = w => phaseOf(w).days.length;          // each week can have its own number of days
const dayName = (w, d) => phaseOf(w).dayNames[d];
/* Sessions are numbered in program order across weeks that may have different numbers of days */
function weekStart(w) { let n = 0; for (let v = 1; v < w; v++) n += DPW(v); return n; }
const totalSessions = () => weekStart(NW() + 1);
const STATS = () => NW() + 1;   // the Stats "week"

/* Logs saved before version 2 were keyed by position ("day-exercise" and "done<day>").
   Convert them once to id-based keys, keeping an untouched copy of the original. */
function migrateLogs(p, L) {
  if (!L || L.v === 2) return L || { v: 2 };
  store(PREFIX + "log-v1-backup-" + p.id, L);
  const out = { v: 2 };
  Object.keys(L).forEach(wk => {
    const m = /^w(\d+)$/.exec(wk); if (!m || !L[wk] || typeof L[wk] !== "object") return;
    const w = +m[1], ph = phaseFor(p, w), old = L[wk], nw = { ex: {}, done: {} };
    Object.keys(old).forEach(k => {
      let mm;
      if ((mm = /^done(\d+)$/.exec(k)) && old[k] && ph.dayIds[+mm[1]]) nw.done[ph.dayIds[+mm[1]]] = true;
      else if ((mm = /^(\d+)-(\d+)$/.exec(k)) && ph.days[+mm[1]] && ph.days[+mm[1]][+mm[2]]) nw.ex[ph.days[+mm[1]][+mm[2]].id] = old[k];
    });
    out[wk] = nw;
  });
  return out;
}
function logsFor(p) {
  if (!LOGS[p.id]) {
    const raw = load(KEY.log(p.id), null);
    const L = migrateLogs(p, raw);
    if (raw && raw.v !== 2) store(KEY.log(p.id), L);
    LOGS[p.id] = L;
  }
  return LOGS[p.id];
}
function useProgram(id) {
  P = progById(id) || PROGRAMS[0];
  logs = logsFor(P);
  store(KEY.prog, P.id);
}

/* ---------- log access ---------- */
function weekLog(w, create) {
  const k = "w" + w;
  if (!logs[k] && create) logs[k] = { ex: {}, done: {} };
  return logs[k];
}
function entry(w, d, i) {
  const wk = weekLog(w, true), ex = dayList(w, d)[i];
  return wk.ex[ex.id] || (wk.ex[ex.id] = { s: Array(ex.sets).fill("") });
}
function peek(w, d, i) { const wk = weekLog(w); const ex = dayList(w, d)[i]; return wk && ex && wk.ex[ex.id]; }
function persist() { store(KEY.log(P.id), logs); }
function saveView() { store(KEY.view, view); }

/* ---------- derived state ---------- */
function isDayDone(w, d) { const wk = weekLog(w); return !!(wk && wk.done[dayIdOf(w, d)]); }
function weekComplete(w) { return range(DPW(w)).every(d => isDayDone(w, d)); }
/* A session is missed when it isn't done but a later session (in program order) is. */
function lastDoneIndex() {
  let last = -1, start = 0;
  for (let w = 1; w <= NW(); w++) { const D = DPW(w); for (let d = 0; d < D; d++) if (isDayDone(w, d)) last = start + d; start += D; }
  return last;
}
function isMissed(w, d) { return !isDayDone(w, d) && weekStart(w) + d < lastDoneIndex(); }
/* A done day with any set left empty */
function dayHasGaps(w, d) {
  if (!isDayDone(w, d)) return false;
  return dayList(w, d).some((ex, i) => { const e = peek(w, d, i); return !e || !e.s || range(ex.sets).some(k => !e.s[k]); });
}
/* Which day a week opens on: first day needing attention, otherwise the next day not done, otherwise Day 1 */
function smartDay(w) {
  const D = DPW(w);
  for (let d = 0; d < D; d++) if (isMissed(w, d) || dayHasGaps(w, d)) return d;
  for (let d = 0; d < D; d++) if (!isDayDone(w, d)) return d;
  return 0;
}
function weekHasMissed(w) { return range(DPW(w)).some(d => isMissed(w, d) || dayHasGaps(w, d)); }
/* Where the app opens: earliest done day with empty sets, otherwise the session after the latest done one */
function currentSpot() {
  for (let w = 1; w <= NW(); w++) for (let d = 0; d < DPW(w); d++) if (dayHasGaps(w, d)) return { week: w, day: d };
  const last = lastDoneIndex();
  if (!P.repeat && last >= totalSessions() - 1) return { week: STATS(), day: 0 };   // program complete
  let i = last + 1, w = 1;
  while (w < NW() && i >= DPW(w)) { i -= DPW(w); w++; }
  return { week: w, day: smartDay(w) };
}
/* Most recent earlier week with this exercise logged: same exercise id first, then the same name on any day */
function lastTime(w, d0, ex) {
  for (let pw = w - 1; pw >= 1; pw--) {
    const wk = logs["w" + pw]; if (!wk) continue;
    const days = phaseOf(pw).days;
    const cands = [];
    days.forEach((day, d) => day.forEach(e => { if (e.id === ex.id) cands.unshift(e); else if (e.name === ex.name) cands.push(e); }));
    for (const e of cands) {
      const en = wk.ex[e.id];
      if (en && en.s && en.s.some(v => v !== "")) return { week: pw, s: en.s.slice(0, e.sets), actual: en.alt || e.name };
    }
  }
  return null;
}

/* ---------- demo links ---------- */
function demoUrl(name, video) {
  if (!SET.videos) return null;
  return video || "https://www.youtube.com/results?search_query=" + encodeURIComponent(name + " exercise form");
}
function nameNode(n, url) {
  if (!url) { const s = document.createElement("span"); s.textContent = n; return s; }
  const a = document.createElement("a");
  a.href = url; a.target = "_blank"; a.rel = "noopener"; a.className = "vlink";
  a.append(n + " "); a.insertAdjacentHTML("beforeend", PLAY_SVG);
  a.setAttribute("aria-label", t("demo.aria", { name: n }));
  return a;
}

/* ---------- render: header ---------- */
function goWeek(w) { if (view.week !== w) view.day = w <= NW() ? smartDay(w) : 0; view.week = w; saveView(); renderAll(); window.scrollTo({ top: 0 }); }

let weeksOpen = false;
function renderWeeks() {
  const el = $("weeks"); el.innerHTML = "";
  const cols = [];
  if (P.weekly || P.repeat) cols.push("repeat(" + NW() + ", minmax(0, 1fr))");
  else P.phases.forEach((ph, pi) => { if (pi) cols.push("6px"); cols.push("repeat(" + (ph.to - ph.from + 1) + ", minmax(0, 1fr))"); });
  el.style.gridTemplateColumns = cols.join(" ");
  let anyMissed = false;
  for (let w = 1; w <= NW(); w++) {
    if (!P.weekly && !P.repeat && P.phases.some((ph, pi) => pi && ph.from === w)) { const g = document.createElement("span"); g.className = "gap"; g.setAttribute("aria-hidden", "true"); el.appendChild(g); }
    const b = document.createElement("button");
    const wc = weekComplete(w), wm = weekHasMissed(w);
    if (wm) anyMissed = true;
    b.type = "button"; b.className = "wk" + (wc ? " complete" : "") + (wm ? " has-missed" : "");
    b.setAttribute("aria-pressed", String(w === view.week));
    b.setAttribute("aria-label", t("week.aria", { n: w }) + (wc ? ", " + t("status.done") : "") + (wm ? ", " + t("week.attention") : ""));
    b.innerHTML = "<small></small>" + w;
    b.querySelector("small").textContent = t("week.short");
    b.addEventListener("click", () => { weeksOpen = false; goWeek(w); });
    el.appendChild(b);
  }
  el.hidden = !weeksOpen;
  const tg = $("weekToggle"), isStats = view.week === STATS();
  tg.setAttribute("aria-expanded", String(weeksOpen));
  tg.classList.toggle("has-missed", anyMissed);
  $("statsBtn").setAttribute("aria-pressed", String(isStats));
  $("phase").textContent = "";
  if (isStats) { $("wtMain").textContent = t("stats.title"); $("wtSub").textContent = t("week.choose"); return; }
  const ph = phaseOf(view.week);
  $("wtMain").textContent = P.repeat ? t("week.n", { n: view.week }) : t("week.ofN", { n: view.week, total: NW() });
  $("wtSub").textContent = P.weekly || P.repeat ? "" : P.phases.length > 1 ? t("phase.n", { n: phaseNum(view.week) }) + (ph.name ? " · " + ph.name : "") : ph.name;
}
$("weekToggle").addEventListener("click", () => { weeksOpen = !weeksOpen; renderWeeks(); });
$("statsBtn").addEventListener("click", () => { weeksOpen = false; goWeek(view.week === STATS() ? currentSpot().week : STATS()); });

function renderDays() {
  const el = $("days"); el.innerHTML = "";
  const D = DPW(view.week), ph = phaseOf(view.week);
  el.style.gridTemplateColumns = "repeat(" + D + ", minmax(0, 1fr))";
  el.classList.toggle("many", D > 4);
  for (let d = 0; d < D; d++) {
    const done = isDayDone(view.week, d), missed = isMissed(view.week, d), gaps = dayHasGaps(view.week, d);
    const b = document.createElement("button");
    b.type = "button"; b.className = "day" + (done ? " complete" : missed ? " missed" : "") + (gaps ? " has-gaps" : "");
    if (gaps) b.title = t("day.gapsTitle");
    b.setAttribute("aria-pressed", String(d === view.day));
    const status = done ? t("status.done") : missed ? t("status.missed") : t("status.todo");
    b.setAttribute("aria-label", t("day.n", { n: d + 1 }) + ", " + ph.dayNames[d] + ", " + status);
    const sh = ph.dayShort[d];
    const sub = sh ? (done ? "✓ " : "") + sh : (done ? "✓ " + status : status);
    b.innerHTML = "<span></span><small></small>";
    b.querySelector("span").textContent = (D > 4 ? t("day.shortN", { n: d + 1 }) : t("day.n", { n: d + 1 }));
    b.querySelector("small").textContent = sub;
    b.addEventListener("click", () => { view.day = d; saveView(); renderAll(); window.scrollTo({ top: 0 }); });
    el.appendChild(b);
  }
}

function renderHead() {
  const done = isDayDone(view.week, view.day), missed = isMissed(view.week, view.day);
  $("dayTitle").textContent = dayName(view.week, view.day);
  const st = $("dayStatus");
  st.hidden = !(done || missed);
  st.className = "status " + (done ? "done" : "missed");
  st.textContent = done ? "✓ " + t("status.done") : t("status.missed");
  const btn = $("dayDone");
  btn.setAttribute("aria-pressed", String(done));
  btn.innerHTML = CHECK_SVG + "<span></span>" + (done ? " <small></small>" : "");
  btn.querySelector("span").textContent = done ? t("dayDone.done", { n: view.day + 1 }) : t("dayDone.mark", { n: view.day + 1 });
  if (done) btn.querySelector("small").textContent = "· " + t("dayDone.undo");
  $("list").classList.toggle("is-done", done);
  updateEmptyWarn();
}
function updateEmptyWarn() {
  const el = $("emptyWarn");
  if (!isDayDone(view.week, view.day) || view.week === STATS()) { el.hidden = true; return; }
  const n = $("list").querySelectorAll(".set input.empty").length;
  el.hidden = n === 0;
  el.textContent = tn("warn.empty", n);
}
$("dayDone").addEventListener("click", () => {
  const w = view.week, wk = weekLog(w, true), id = dayIdOf(w, view.day);
  if (wk.done[id]) delete wk.done[id]; else wk.done[id] = true;
  persist(); renderWeeks(); renderDays(); renderHead();
});

/* ---------- render: workout ---------- */
const fmt = v => v === "" || v === undefined ? "–" : v;
const unitLabel = () => t(SET.unit === "lb" ? "unit.lb" : "unit.kg");

function renderList() {
  const list = $("list"); list.innerHTML = "";
  const w = view.week, d = view.day;
  dayList(w, d).forEach((ex, i) => {
    const { name, sets, reps, rpe, cue, alts } = ex;
    const e = peek(w, d, i) || { s: Array(sets).fill("") };
    const shown = e.alt || name;
    const card = document.createElement("article"); card.className = "ex";

    const top = document.createElement("div"); top.className = "ex-top";
    const num = document.createElement("div"); num.className = "num"; num.textContent = i + 1;
    const nm = document.createElement("div"); nm.className = "ex-name";
    const h = document.createElement("h3"); h.appendChild(nameNode(shown, demoUrl(shown, e.alt ? "" : ex.video)));
    nm.append(h);
    if (e.alt) {
      const sw = document.createElement("p"); sw.className = "swapped";
      sw.append(t("swap.insteadOf") + " "); const b = document.createElement("b"); b.textContent = name; sw.append(b);
      nm.append(sw);
    }
    const pr = document.createElement("div"); pr.className = "presc";
    pr.innerHTML = '<span class="sr" dir="ltr"></span>' + (rpe ? '<span class="pill"></span>' : '') + (e.alt ? '<span class="tag"></span>' : '');
    pr.querySelector(".sr").innerHTML = sets + "<i>×</i>";
    pr.querySelector(".sr").append(reps + (ex.timed ? " " + t("unit.sec") : ""));
    if (ex.perSide) { const sd = document.createElement("span"); sd.className = "pill side"; sd.textContent = t("lib.perSide"); pr.querySelector(".sr").after(sd); }
    if (rpe) { const pl = pr.querySelector(".pill"); pl.textContent = t("rpe.pill", { rpe }); }
    if (e.alt) pr.querySelector(".tag").textContent = t("swap.tag");
    nm.append(pr);
    top.append(num, nm);
    card.append(top);

    if (SET.cues && cue && !e.alt) { const c = document.createElement("p"); c.className = "cue"; c.textContent = cue; card.append(c); }

    const lt = SET.last ? lastTime(w, d, ex) : null;
    const setsEl = document.createElement("div"); setsEl.className = "sets";
    for (let s = 0; s < sets; s++) {
      const id = "w" + w + "d" + d + "e" + i + "s" + s;
      const wrap = document.createElement("div"); wrap.className = "set";
      wrap.innerHTML = '<label for="' + id + '"></label><div class="field"><input id="' + id + '" type="text" inputmode="decimal" autocomplete="off" placeholder="0"><span class="unit"></span></div>';
      wrap.querySelector("label").textContent = ex.setReps ? t("sets.nReps", { n: s + 1, r: ex.setReps[s] }) : t("sets.n", { n: s + 1 });
      wrap.querySelector(".unit").textContent = unitLabel();
      const inp = wrap.querySelector("input");
      if (lt && lt.s[s]) inp.placeholder = fmt(lt.s[s]);          // last time's weight, in grey, as the target to match
      inp.value = (e.s && e.s[s]) || "";
      inp.classList.toggle("empty", !inp.value);
      inp.addEventListener("input", () => {
        const clean = cleanNumber(inp.value, 6);
        if (clean !== inp.value) inp.value = clean;
        entry(w, d, i).s[s] = clean; persist();
        inp.classList.toggle("empty", !clean); updateEmptyWarn();
        if (isDayDone(w, d)) { renderWeeks(); renderDays(); }
      });
      setsEl.appendChild(wrap);
    }
    card.append(setsEl);

    if (lt) {
      const p = document.createElement("p"); p.className = "last";
      p.append(t(lt.actual !== shown ? "last.withName" : "last.plain", { w: lt.week, name: lt.actual }) + " ");
      const b = document.createElement("b"); b.dir = "ltr"; b.textContent = lt.s.map(fmt).join(" · "); p.append(b, " " + unitLabel());
      card.appendChild(p);
    }

    if (alts.length || typeof openPicker === "function") {
      const det = document.createElement("details"); det.className = "alts";
      const sum = document.createElement("summary"); sum.textContent = e.alt ? t("swap.change") : t("swap.open");
      const ul = document.createElement("ul");
      [name].concat(alts).filter(s => s !== shown).forEach(s => {
        const li = document.createElement("li");
        const btn = document.createElement("button"); btn.type = "button";
        if (s === name) btn.className = "orig";
        const lbl = document.createElement("span"); lbl.textContent = s + (s === name ? " " + t("swap.planned") : "");
        btn.appendChild(lbl);
        btn.addEventListener("click", () => { const en = entry(w, d, i); if (s === name) delete en.alt; else en.alt = s; persist(); renderList(); });
        li.appendChild(btn);
        const vu = demoUrl(s, s === name ? ex.video : "");
        if (vu) {
          const va = document.createElement("a"); va.href = vu; va.target = "_blank"; va.rel = "noopener";
          va.className = "vbtn"; va.innerHTML = PLAY_SVG; va.setAttribute("aria-label", t("demo.aria", { name: s }));
          li.appendChild(va);
        }
        ul.appendChild(li);
      });
      const note = document.createElement("p"); note.textContent = t("swap.note");
      det.append(sum, ul, libraryButton(ex, w, d, i), note);
      card.appendChild(det);
    }
    list.appendChild(card);
  });
}

/* Swap to anything in the library, starting with exercises for the same muscle */
function libraryButton(ex, w, d, i) {
  const b = document.createElement("button"); b.type = "button"; b.className = "ghostbtn libbtn"; b.textContent = t("swap.library");
  b.addEventListener("click", () => {
    const base = ex.ref && exById(ex.ref);
    openPicker({ muscle: base ? base.primary : "", onPick: pick => {
      const en = entry(w, d, i);
      if (pick.name === ex.name) { delete en.alt; delete en.altRef; } else { en.alt = pick.name; en.altRef = pick.id; }
      persist(); renderList();
    } });
  });
  return b;
}

/* ---------- render: progress ---------- */
const num = v => { const n = parseFloat(v); return isFinite(n) && n > 0 ? n : 0; };
const fmtKg = n => n >= 10000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : fmtInt(n);
const fmtW = n => (Math.round(n * 10) / 10).toString();

function computeStats() {
  let done = 0, missed = 0;
  const weekVol = [], lifts = {};
  for (let w = 1; w <= NW(); w++) {
    let vol = 0;
    for (let d = 0; d < DPW(w); d++) {
      if (isDayDone(w, d)) done++; else if (isMissed(w, d)) missed++;
      dayList(w, d).forEach((ex, i) => {
        const e = peek(w, d, i); if (!e || !e.s) return;
        const ws = e.s.slice(0, ex.sets).map(num).filter(Boolean); if (!ws.length) return;
        vol += e.s.slice(0, ex.sets).reduce((a, v, k) => a + num(v) * (parseInt(ex.setReps ? ex.setReps[k] : ex.reps, 10) || 0), 0);
        const actual = e.alt || ex.name;
        const L = lifts[actual] || (lifts[actual] = { name: actual, pts: {} });
        L.pts[w] = Math.max(L.pts[w] || 0, ...ws);
      });
    }
    weekVol.push(vol);
  }
  const liftList = Object.values(lifts).map(L => {
    const weeks = Object.keys(L.pts).map(Number).sort((a, b) => a - b);
    const first = L.pts[weeks[0]], last = L.pts[weeks[weeks.length - 1]];
    return { name: L.name, pts: L.pts, weeks, first, last, firstW: weeks[0], lastW: weeks[weeks.length - 1], diff: last - first, pct: first ? (last - first) / first * 100 : 0 };
  }).sort((a, b) => (b.weeks.length > 1) - (a.weeks.length > 1) || b.pct - a.pct || a.name.localeCompare(b.name));
  return { done, missed, weekVol, liftList, totalVol: weekVol.reduce((a, b) => a + b, 0) };
}

function sparkline(L) {
  const W = 84, H = 28, pad = 4, span1 = Math.max(1, NW() - 1);
  const vals = L.weeks.map(w => L.pts[w]);
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const x = w => pad + (w - 1) / span1 * (W - pad * 2);
  const y = v => hi === lo ? H / 2 : H - pad - (v - lo) / span * (H - pad * 2);
  const pts = L.weeks.map(w => x(w).toFixed(1) + "," + y(L.pts[w]).toFixed(1));
  const lw = L.weeks[L.weeks.length - 1];
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">' +
    '<line x1="' + pad + '" x2="' + (W - pad) + '" y1="' + (H - 1) + '" y2="' + (H - 1) + '" stroke="var(--line)" stroke-width="1"/>' +
    (L.weeks.length > 1 ? '<polyline points="' + pts.join(" ") + '" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' : '') +
    '<circle cx="' + x(lw).toFixed(1) + '" cy="' + y(L.pts[lw]).toFixed(1) + '" r="3.5" fill="var(--accent)" stroke="var(--surface)" stroke-width="1.5"/></svg>';
}

function volumeChart(weekVol) {
  const W = 340, H = 170, L = 38, R = 6, T = 10, B = 24, n = weekVol.length;
  const max = Math.max(...weekVol);
  const step = max <= 0 ? 1000 : Math.pow(10, Math.floor(Math.log10(max / 3)));
  const nice = [1, 2, 2.5, 5, 10].map(m => m * step).find(s => s * 3 >= max) || step * 10;
  const top = Math.max(nice * 3, 1);
  const y = v => T + (H - T - B) * (1 - v / top);
  const bw = (W - L - R) / n, gap = Math.min(6, bw * 0.2);
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + escAttr(t("vol.aria")) + '" direction="ltr">';
  for (let k = 0; k <= 3; k++) {
    const v = nice * k, yy = y(v).toFixed(1);
    s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '" stroke="var(--line)" stroke-width="1"' + (k ? ' stroke-dasharray="2 3"' : '') + '/>';
    s += '<text x="' + (L - 6) + '" y="' + yy + '" dy="0.32em" text-anchor="end" font-size="10.5" fill="var(--muted)">' + fmtKg(v) + '</text>';
  }
  weekVol.forEach((v, i) => {
    const x0 = L + i * bw + gap / 2, w = bw - gap, x1 = x0 + w, yb = y(0), yt = y(v), r = Math.min(4, (yb - yt) / 2, w / 2);
    if (v > 0) s += '<path d="M' + x0 + ',' + yb + 'V' + (yt + r) + 'Q' + x0 + ',' + yt + ' ' + (x0 + r) + ',' + yt + 'H' + (x1 - r) + 'Q' + x1 + ',' + yt + ' ' + x1 + ',' + (yt + r) + 'V' + yb + 'Z" fill="var(--accent)"/>';
    s += '<rect class="hit" data-i="' + i + '" x="' + (L + i * bw) + '" y="' + T + '" width="' + bw + '" height="' + (H - T - B) + '" fill="transparent" style="cursor:pointer"/>';
    s += '<text x="' + (x0 + w / 2) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="10.5" fill="var(--muted)">' + escAttr(t("week.chartN", { n: i + 1 })) + '</text>';
  });
  return s + '</svg>';
}

function renderProgress() {
  const st = computeStats(), el = $("progress"), total = totalSessions(), U = escAttr(unitLabel());
  let D = 0; for (let w = 1; w <= NW(); w++) D = Math.max(D, DPW(w));
  const pct = Math.round(st.done / total * 100);
  const best = st.weekVol.map((v, i) => [v, i]).filter(([v]) => v > 0).reduce((b, c) => (c[0] > (b ? b[0] : -1) ? c : b), null);
  const gains = st.liftList.filter(l => l.weeks.length > 1);
  const ups = gains.filter(l => l.diff > 0).length;
  const T = k => escAttr(t(k));

  let h = '<h2 id="progTitle"></h2><div class="tiles">' +
    (P.repeat ? '<div class="tile"><div class="k">' + T("stats.sessions") + '</div><div class="v">' + st.done + '</div><div class="s">' + escAttr(tn("stats.weeksTrained", NW() - 1)) + '</div></div>'
      : '<div class="tile"><div class="k">' + T("stats.sessions") + '</div><div class="v">' + st.done + '<small> / ' + total + '</small></div><div class="meter"><i style="width:' + pct + '%"></i></div><div class="s">' + escAttr(t("stats.pctProgram", { pct })) + '</div></div>') +
    '<div class="tile"><div class="k">' + T("stats.missed") + '</div><div class="v">' + st.missed + '</div><div class="s">' + T(st.missed ? "stats.missedSome" : "stats.missedNone") + '</div></div>' +
    '<div class="tile"><div class="k">' + T("stats.volume") + '</div><div class="v">' + fmtKg(st.totalVol) + '<small> ' + U + '</small></div><div class="s">' + T("stats.volumeDesc") + '</div></div>' +
    '<div class="tile"><div class="k">' + T("stats.up") + '</div><div class="v">' + ups + '<small> / ' + gains.length + '</small></div><div class="s">' + T(gains.length ? "stats.upDesc" : "stats.upNone") + '</div></div>' +
    '</div>';

  const cols = ["22px"], blocks = !P.weekly && !P.repeat;
  if (blocks) P.phases.forEach((ph, pi) => { if (pi) cols.push("4px"); cols.push("repeat(" + (ph.to - ph.from + 1) + ", minmax(0, 1fr))"); });
  else cols.push("repeat(" + NW() + ", minmax(0, 1fr))");
  const isBreak = w => blocks && P.phases.some((ph, pi) => pi && ph.from === w);
  h += '<div class="panel"><h3>' + T("stats.byWeek") + '</h3><div class="sessgrid" style="grid-template-columns:' + cols.join(" ") + '"><span></span>';
  for (let w = 1; w <= NW(); w++) { if (isBreak(w)) h += '<span></span>'; h += '<span class="lbl">' + escAttr(t("week.chartN", { n: w })) + '</span>'; }
  for (let d = 0; d < D; d++) {
    h += '<span class="lbl">' + escAttr(t("day.shortN", { n: d + 1 })) + '</span>';
    for (let w = 1; w <= NW(); w++) {
      if (isBreak(w)) h += '<span></span>';
      if (d >= DPW(w)) { h += '<span class="cell none"></span>'; continue; }     // this week has fewer days
      const dn = isDayDone(w, d), ms = isMissed(w, d);
      h += '<span class="cell' + (dn ? ' done' : ms ? ' missed' : '') + '" title="' + escAttr(t("stats.cellTitle", { w, d: d + 1, status: t(dn ? "status.done" : ms ? "status.missed" : "status.todo") })) + '">' + (dn ? '✓' : ms ? '✕' : '') + '</span>';
    }
  }
  h += '</div><div class="legend"><span><i class="done"></i>' + T("status.done") + '</span><span><i class="missed"></i>' + T("status.missed") + '</span><span><i></i>' + T("status.todo") + '</span></div></div>';

  h += '<div class="panel chart"><h3>' + escAttr(t("stats.volTitle", { unit: unitLabel() })) + '</h3><p class="sub">' + T("stats.volSub") + '</p>' +
    volumeChart(st.weekVol) + '<div class="readout" id="volReadout"></div></div>';

  h += '<div class="panel"><h3>' + T("stats.strength") + '</h3><p class="sub">' + T("stats.strengthSub") + '</p><div class="lifts">';
  if (!st.liftList.length) h += '<p class="empty">' + T("stats.liftsEmpty") + '</p>';
  st.liftList.forEach(l => {
    const cls = l.weeks.length < 2 ? '' : l.diff > 0 ? ' up' : l.diff < 0 ? ' down' : '';
    const delta = l.weeks.length < 2 ? '<span style="color:var(--muted)">–</span><small>' + T("stats.oneWeek") + '</small>'
      : '<span dir="ltr">' + (l.diff > 0 ? '+' : l.diff < 0 ? '−' : '±') + fmtW(Math.abs(l.diff)) + ' ' + U + '</span><small dir="ltr">' + (l.diff >= 0 ? '+' : '−') + Math.abs(Math.round(l.pct)) + '%</small>';
    const wl = n => escAttr(t("week.chartN", { n }));
    h += '<div class="lift"><div><div class="n"></div><div class="r" dir="ltr">' +
      (l.weeks.length < 2 ? wl(l.firstW) + ': ' + fmtW(l.first) + ' ' + U : wl(l.firstW) + ' ' + fmtW(l.first) + ' → ' + wl(l.lastW) + ' ' + fmtW(l.last) + ' ' + U) +
      '</div></div>' + sparkline(l) + '<div class="d' + cls + '">' + delta + '</div></div>';
  });
  h += '</div></div>';
  el.innerHTML = h;
  $("progTitle").textContent = t("stats.heading", { name: P.name });
  el.querySelectorAll(".lift .n").forEach((n, i) => { n.textContent = st.liftList[i].name; });

  const ro = $("volReadout");
  const show = i => { ro.textContent = t(st.weekVol[i] ? "stats.weekVol" : "stats.weekVolNone", { n: i + 1, v: fmtInt(st.weekVol[i]), unit: unitLabel() }); };
  ro.textContent = best ? t("stats.bestWeek", { n: best[1] + 1, v: fmtInt(best[0]), unit: unitLabel() }) : t("stats.volEmpty");
  el.querySelectorAll(".hit").forEach(r => { const i = +r.dataset.i; r.addEventListener("click", () => show(i)); r.addEventListener("mouseenter", () => show(i)); });
}

/* ---------- settings page ---------- */
/* [sessions done, sessions in the program]; a repeating program has no total */
function doneCount(p) {
  const L = logsFor(p), nw = nwOf(p, L); let n = 0, tot = 0;
  for (let w = 1; w <= nw; w++) {
    const ph = phaseFor(p, w), wk = L["w" + w];
    tot += ph.dayIds.length;
    if (wk && wk.done) ph.dayIds.forEach(id => { if (wk.done[id]) n++; });
  }
  return [n, p.repeat ? 0 : tot];
}
const doneText = (n, tot) => tot ? t("prog.done", { n, total: tot }) : tn("prog.doneN", n);
/* Someone who already uses the calorie calculator or has trained past week 1 starts in Pro, so nothing disappears */
function usesProFeatures() {
  if (typeof detailsComplete === "function" && detailsComplete()) return true;
  return PROGRAMS.some(p => { const L = logsFor(p); return Object.keys(L).some(k => { const m = /^w(\d+)$/.exec(k); return m && +m[1] > 1 && L[k] && ((L[k].ex && Object.keys(L[k].ex).length) || (L[k].done && Object.keys(L[k].done).length)); }); });
}
function hasLogs(p) {
  const L = logsFor(p);
  return Object.keys(L).some(k => /^w\d+$/.test(k) && L[k] && ((L[k].ex && Object.keys(L[k].ex).length) || (L[k].done && Object.keys(L[k].done).length)));
}
function openWorkout(spot) { appMode = "workout"; view = spot || currentSpot(); saveView(); renderAll(); window.scrollTo({ top: 0 }); }
function forgetProgram() { P = null; logs = {}; try { localStorage.removeItem(KEY.prog); } catch (e) {} }

function deleteProgram(p) {
  if (!confirm(t("prog.removeConfirm", { name: p.name }))) return;
  store(KEY.custom, load(KEY.custom, []).filter(r => slug(r.id || r.name) !== p.id));
  PROGRAMS = PROGRAMS.filter(x => x !== p);
  if (P && P.id === p.id) forgetProgram();
  if (SET.follow === p.id) { SET.follow = ""; saveSettings(); }
  renderAll();
}
/* Buttons under a program: your own get Share, Edit, Delete; a coach's program can only be removed;
   a ready-made one can be shared */
function ownActions(p) {
  const acts = document.createElement("div"); acts.className = "own-acts";
  const shareBtn = () => { const b = document.createElement("button"); b.type = "button"; b.className = "ghostbtn share"; b.textContent = t("share.button"); b.dataset.act = "share"; b.addEventListener("click", () => openShare(p.id)); return b; };
  if (p.builtin) { acts.classList.add("one"); acts.append(shareBtn()); return acts; }
  if (p.shared) {
    const rm = document.createElement("button"); rm.type = "button"; rm.className = "ghostbtn danger"; rm.textContent = t("prog.remove"); rm.dataset.act = "delete";
    rm.addEventListener("click", () => deleteProgram(p));
    acts.classList.add("one"); acts.append(rm); return acts;
  }
  const ed = document.createElement("button"); ed.type = "button"; ed.className = "ghostbtn"; ed.textContent = t("prog.edit"); ed.dataset.act = "edit";
  ed.addEventListener("click", () => openBuilder(p.id));
  const rm = document.createElement("button"); rm.type = "button"; rm.className = "ghostbtn danger"; rm.textContent = t("prog.remove"); rm.dataset.act = "delete";
  rm.addEventListener("click", () => deleteProgram(p));
  acts.append(shareBtn(), ed, rm);
  return acts;
}
function programCard(p) {
  const cur = P && p.id === P.id, [n, tot] = doneCount(p), started = !cur && hasLogs(p);
  const b = document.createElement("button"); b.type = "button"; b.className = "pcard home-card"; b.dataset.id = p.id;
  b.setAttribute("aria-pressed", String(!!cur));
  b.innerHTML = '<span><b></b><small class="desc"></small><small class="meta"></small></span><span class="act"></span>';
  b.querySelector("b").textContent = p.name;
  b.querySelector(".desc").textContent = p.description || tn("prog.daysWeek", p.dayNames.length);
  b.querySelector(".meta").textContent = (p.builtin ? tn("prog.daysWeek", p.dayNames.length) : t(p.byBuilder ? "prog.mine" : p.shared ? "prog.shared" : "prog.imported")) + (started ? " · " + doneText(n, tot) : "");
  b.querySelector(".act").textContent = t(cur ? "home.open" : started ? "home.resume" : "home.start");
  b.addEventListener("click", () => { if (!cur) setProgram(p.id); openWorkout(); });
  return b;
}
function renderHome() {
  const trainee = traineeView();
  $("homeHeadline").textContent = t(P ? "home.welcomeBack" : "home.welcome");
  $("homeSub").textContent = t(trainee ? "home.subTrainee" : P ? "home.subBack" : "home.subNew");
  // A trainee on a coach's program sees just that program: nothing to choose, build or import
  ["homeCreate", "homeChooseH", "homeProgs"].forEach(id => { $(id).hidden = trainee; });
  document.querySelector("#home .home-links").hidden = trainee;
  const hc = $("homeContinue"); hc.innerHTML = "";
  if (P) {
    const spot = currentSpot(), [n, tot] = doneCount(P), finished = spot.week === STATS();
    // A repeating program shows this week; a program with an end shows the whole program
    const wDone = finished ? 0 : range(DPW(spot.week)).filter(d => isDayDone(spot.week, d)).length;
    const frac = tot ? n / tot : wDone / DPW(spot.week);
    const c = document.createElement("button"); c.type = "button"; c.className = "continue" + (finished ? " complete" : ""); c.id = "homeGo";
    c.innerHTML = '<span class="c-k"></span><b class="c-name"></b><span class="c-next"></span><span class="meter"><i style="width:' + Math.round(frac * 100) + '%"></i></span><span class="c-meta"></span>' +
      '<svg class="c-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
    c.querySelector(".c-k").textContent = t(finished ? "home.finished" : P.id === SET.follow ? "home.fromCoach" : P.builtin ? "home.continue" : "home.yourProgram");
    c.querySelector(".c-name").textContent = P.name;
    c.querySelector(".c-next").textContent = finished ? t("home.seeProgress") : t("home.next", { name: dayName(spot.week, spot.day) });
    c.querySelector(".c-meta").textContent = tot ? doneText(n, tot) : t("home.thisWeek", { n: wDone, total: DPW(spot.week) });
    c.addEventListener("click", () => openWorkout(spot));
    hc.appendChild(c);
    if (finished) { const n2 = document.createElement("p"); n2.className = "note complete-note"; n2.textContent = t(P.id === SET.follow ? "home.completeCoach" : "home.completeOwn"); hc.appendChild(n2); }
    if (!trainee) hc.appendChild(ownActions(P));
  }
  // my other programs
  const mine = trainee ? [] : PROGRAMS.filter(p => !p.builtin && !(P && p.id === P.id));
  $("homeMineH").hidden = !mine.length;
  const mg = $("homeMine"); mg.innerHTML = "";
  mine.forEach(p => { const w = document.createElement("div"); w.className = "pcard-wrap"; w.append(programCard(p), ownActions(p)); mg.appendChild(w); });
  // ready-made programs
  $("homeChooseH").textContent = t("home.orPreset");
  const pg = $("homeProgs"); pg.innerHTML = "";
  PROGRAMS.filter(p => p.builtin).forEach(p => pg.appendChild(programCard(p)));
}
$("homeCreate").addEventListener("click", () => openBuilder(null));

function showMsg(id, text, err) { const m = $(id); m.hidden = !text; m.textContent = text || ""; m.classList.toggle("err", !!err); }
function setProgram(id) {
  useProgram(id); view = currentSpot(); saveView();
  if (SET.follow && SET.follow !== id) { SET.follow = ""; saveSettings(); }   // choosing another program stops following the coach's
}
/* A trainee following a coach's normal program sees only that program; Pro shows everything */
const traineeView = () => !!(!SET.pro && SET.follow && P && P.id === SET.follow);

function renderSeg(id, key, value) {
  document.querySelectorAll("#" + id + " button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset[key] === value)));
}
let setPage = "";
const SET_PAGES = [
  ["language", "set.language", () => (LANGS.find(l => l.code === LANG) || LANGS[0]).name],
  ["pro", "pro.title", () => t(SET.pro ? "pro.on" : "pro.off")],
  ["appearance", "set.look", () => t({ light: "set.themeLight", dark: "set.themeDark" }[SET.theme] || "set.themeSystem")],
  ["workout", "set.workoutScreen", () => t("set.workoutSum", { unit: unitLabel() })],
  ["app", "set.app", () => t(SET.calTab ? "set.appSum" : "set.appSumNoCal")],
  ["details", "set.details", () => typeof detailsSummary === "function" ? detailsSummary() : "", "pro"],
  ["library", "lib.title", () => typeof LIBRARY !== "undefined" ? tn("lib.count", LIBRARY.exercises.length + CUSTOM_EX.length) : ""],
  ["data", "data.title", () => t("data.sum")]
];
function openSetPage(page) { setPage = page; appMode = "settings"; renderAll(); window.scrollTo({ top: 0 }); }
function renderSettings() {
  const list = $("setList"); list.innerHTML = "";
  SET_PAGES.forEach(([page, title, sum, needs]) => {
    if (needs === "pro" && !SET.pro) return;
    const b = document.createElement("button"); b.type = "button"; b.className = "setrow"; b.dataset.page = page;
    b.innerHTML = '<span><b></b><small></small></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
    b.querySelector("b").textContent = t(title); b.querySelector("small").textContent = sum();
    b.addEventListener("click", () => openSetPage(page));
    list.appendChild(b);
  });
  list.hidden = !!setPage;
  $("setBack").hidden = !setPage;
  document.querySelectorAll("#settings .subpage").forEach(el => { el.hidden = el.dataset.page !== setPage; });
  const cur = SET_PAGES.find(x => x[0] === setPage);
  $("phase").textContent = cur ? t(cur[1]) : t("set.subtitle");
  ["setWorkout", "setApp"].forEach(id => { $(id).innerHTML = ""; });
  $("proToggle").checked = !!SET.pro;
  SET_ITEMS.forEach(([box, k, title, desc, needs]) => {
    if (needs === "pro" && !SET.pro) return;
    const lab = document.createElement("label"); lab.className = "tog";
    lab.innerHTML = '<span><b></b><small></small></span><input type="checkbox" role="switch">';
    lab.querySelector("b").textContent = t(title); lab.querySelector("small").textContent = t(desc);
    const inp = lab.querySelector("input"); inp.checked = !!SET[k];
    inp.addEventListener("change", () => { SET[k] = inp.checked; saveSettings(); applyChrome(); });
    $(box).appendChild(lab);
  });
  if (typeof LIBRARY !== "undefined") {
    $("libSummary").textContent = t(CUSTOM_EX.length ? "lib.summary" : "lib.summaryNone", { n: LIBRARY.exercises.length, mine: CUSTOM_EX.length });
  }
  renderSeg("unitSeg", "u", SET.unit);
  renderSeg("themeSeg", "th", SET.theme);
  const lg = $("langSeg"); lg.innerHTML = "";
  LANGS.forEach(l => {
    const b = document.createElement("button"); b.type = "button"; b.lang = l.code; b.dir = l.dir;
    b.setAttribute("aria-pressed", String(l.code === LANG));
    b.textContent = l.name;
    if (!l.ready) { b.disabled = true; const s = document.createElement("small"); s.textContent = " · " + (l.soon || t("set.langSoon")); b.appendChild(s); }
    else b.addEventListener("click", () => { if (l.code === LANG) return; SET.lang = l.code; saveSettings(); setLanguage(SET.lang); renderAll(); });
    lg.appendChild(b);
  });
  if (setPage === "details" && typeof renderCal === "function") renderCal();
}
$("setBack").addEventListener("click", () => openSetPage(""));
document.querySelectorAll("#unitSeg button").forEach(b => b.addEventListener("click", () => { SET.unit = b.dataset.u; saveSettings(); renderSettings(); }));
document.querySelectorAll("#themeSeg button").forEach(b => b.addEventListener("click", () => { SET.theme = b.dataset.th; saveSettings(); applyTheme(); renderSeg("themeSeg", "th", SET.theme); }));

function readFile(input, cb) {
  const f = input.files && input.files[0]; input.value = "";
  if (!f) return;
  if (f.size > 2e6) { cb(new Error(t("err.fileLarge"))); return; }
  const r = new FileReader();
  r.onload = () => { try { cb(null, JSON.parse(r.result)); } catch (e) { cb(new Error(t("err.json"))); } };
  r.onerror = () => cb(new Error(t("err.read")));
  r.readAsText(f);
}
$("progFile").addEventListener("change", e => readFile(e.target, (err, raw) => {
  if (err) { showMsg("progMsg", err.message, true); return; }
  let p;
  try { p = normalizeProgram(raw, false); } catch (x) { showMsg("progMsg", x.message, true); return; }
  if (PROGRAMS.some(q => q.builtin && q.id === p.id)) { p.id = p.id + "-custom"; raw = Object.assign({}, raw, { id: p.id }); }
  const existing = progById(p.id);
  if (existing && !confirm(t("prog.replaceConfirm", { name: existing.name }))) return;
  store(KEY.custom, load(KEY.custom, []).filter(r => slug(r.id || r.name) !== p.id).concat([Object.assign({}, raw, { id: p.id })]));
  PROGRAMS = PROGRAMS.filter(q => q.id !== p.id).concat([p]);
  delete LOGS[p.id];
  setProgram(p.id);
  renderAll();
  showMsg("progMsg", t("prog.importedMsg", { name: p.name }));
}));

/* ---------- export / import ---------- */
function download(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
const stamp = () => new Date().toISOString().slice(0, 10);
function allKeys() { const out = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(PREFIX)) out.push(k); } return out; }

$("expJson").addEventListener("click", () => {
  const data = {}; allKeys().forEach(k => { data["ll-" + k.slice(PREFIX.length)] = load(k, null); });
  download("lift-ledger-backup-" + stamp() + ".json", JSON.stringify({ app: "lift-ledger", format: 2, exported: new Date().toISOString(), data }, null, 2), "application/json");
  showMsg("dataMsg", t("data.backupDone"));
});
$("expCsv").addEventListener("click", () => {
  const q = v => /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v);
  const rows = [["program", "week", "phase", "day", "session", "exercise_no", "planned_exercise", "exercise", "set", "weight", "unit", "target_reps", "target_rpe", "day_done"]];
  PROGRAMS.forEach(p => {
    const L = logsFor(p);
    for (let w = 1, nw = nwOf(p, L); w <= nw; w++) {
      const wk = L["w" + w]; if (!wk) continue;
      const ph = phaseFor(p, w);
      ph.days.forEach((day, d) => day.forEach((ex, i) => {
        const e = wk.ex && wk.ex[ex.id]; if (!e || !e.s) return;
        e.s.slice(0, ex.sets).forEach((v, s) => {
          if (v === "" || v === undefined) return;
          rows.push([p.name, w, ph.name, d + 1, ph.dayNames[d], i + 1, ex.name, e.alt || ex.name, s + 1, v, SET.unit, ex.reps, ex.rpe, wk.done && wk.done[ph.dayIds[d]] ? "yes" : "no"]);
        });
      }));
    }
  });
  download("lift-ledger-sets-" + stamp() + ".csv", "﻿" + rows.map(r => r.map(q).join(",")).join("\n") + "\n", "text/csv");
  showMsg("dataMsg", rows.length > 1 ? tn("data.csvDone", rows.length - 1) : t("data.csvEmpty"));
});
$("impFile").addEventListener("change", e => readFile(e.target, (err, raw) => {
  if (err) { showMsg("dataMsg", err.message, true); return; }
  if (!raw || raw.app !== "lift-ledger" || !raw.data || typeof raw.data !== "object") { showMsg("dataMsg", t("data.notBackup"), true); return; }
  if (!confirm(t("data.restoreConfirm"))) return;
  allKeys().forEach(k => localStorage.removeItem(k));
  Object.entries(raw.data).forEach(([k, v]) => { const m = /^llb?-(.+)$/.exec(k); if (m) store(PREFIX + m[1], v); });
  location.reload();
}));
$("setReset").addEventListener("click", () => {
  SET = Object.assign({}, SET_DEFAULT, { lang: SET.lang });
  saveSettings(); applyTheme(); renderAll(); showMsg("dataMsg", t("data.resetDone"));
});
$("eraseAll").addEventListener("click", () => {
  if (!confirm(t("data.eraseConfirm1"))) return;
  if (!confirm(t("data.eraseConfirm2"))) return;
  allKeys().forEach(k => localStorage.removeItem(k));
  location.reload();
});

/* ---------- frame ---------- */
let appMode = "home", openedOnce = false;
/* Pro mode unlocks weeks and the calorie calculator; with it off they're hidden, never deleted */
const calOn = () => !!(SET.pro && SET.calTab);
function applyChrome() {
  document.body.dataset.pro = SET.pro ? "1" : "";
  $("modeCal").hidden = !calOn();
  $("modeWorkout").hidden = !P;
  if (!calOn() && appMode === "cal") appMode = "home";
  if (!SET.pro && setPage === "details") setPage = "";
  if (!P && appMode === "workout") appMode = "home";
  syncWakeLock();
}
/* Keep the screen on while the workout page is open, so the phone doesn't lock between sets */
let wakeLock = null;
async function syncWakeLock() {
  const want = !!(SET.awake && P && appMode === "workout" && document.visibilityState === "visible" && navigator.wakeLock);
  try {
    if (want && !wakeLock) { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => { wakeLock = null; }); }
    else if (!want && wakeLock) { const l = wakeLock; wakeLock = null; await l.release(); }
  } catch (e) { wakeLock = null; }
}
document.addEventListener("visibilitychange", syncWakeLock);
const WORKOUT_PARTS = ["statsBtn", "weekbar", "weeks", "days", "rpe", "dayHead", "list", "dayDone", "progress", "emptyWarn", "foot"];
function renderAll() {
  applyI18n();
  if (!PROGRAMS.length) return;
  if (P && !openedOnce) { if (SET.smartOpen || !(view.week >= 1 && view.week <= STATS() && view.day < DPW(view.week))) view = currentSpot(); saveView(); openedOnce = true; }
  if (P && (view.week > STATS() || view.day >= DPW(view.week))) view = currentSpot();
  applyChrome();
  const mode = appMode;
  document.body.dataset.mode = mode;
  $("loading").hidden = true;
  [["modeHome", "home"], ["modeWorkout", "workout"], ["modeCal", "cal"], ["modeSet", "settings"]].forEach(([id, m]) => $(id).setAttribute("aria-pressed", String(mode === m)));
  WORKOUT_PARTS.forEach(id => { $(id).hidden = mode !== "workout"; });
  $("home").hidden = mode !== "home";
  $("cal").hidden = mode !== "cal";
  $("settings").hidden = mode !== "settings";
  if (mode === "home") { $("appTitle").textContent = "Lift Ledger"; $("phase").textContent = ""; renderHome(); return; }
  if (mode === "cal") { $("appTitle").textContent = t("cal.title"); $("phase").textContent = t("cal.subtitle"); if (typeof renderCal === "function") renderCal(); return; }
  if (mode === "settings") { $("appTitle").textContent = t("set.title"); renderSettings(); return; }
  $("appTitle").textContent = P.name;
  $("footProg").textContent = P.schedule || "";
  const prog = view.week === STATS();
  ["days", "rpe", "dayHead", "list", "dayDone"].forEach(id => { $(id).hidden = prog; });
  if (!SET.rpeBox) $("rpe").hidden = true;
  if (prog) $("emptyWarn").hidden = true;
  $("progress").hidden = !prog;
  renderWeeks();
  if (prog) { renderProgress(); return; }
  renderDays(); renderList(); renderHead();
}
/* The workout tab always opens the current week (there's no week picker); stats stay one tap away */
const go = m => () => { if (m === "settings") setPage = ""; if (m === "workout" && P) view = currentSpot(); appMode = m; weeksOpen = false; renderAll(); window.scrollTo({ top: 0 }); };
$("modeHome").addEventListener("click", go("home"));
$("proToggle").addEventListener("change", e => {
  SET.pro = e.target.checked; saveSettings();
  weeksOpen = false; if (P && view.week !== STATS()) view = currentSpot();
  renderAll();
});
$("modeWorkout").addEventListener("click", go("workout"));
$("modeCal").addEventListener("click", go("cal"));
$("modeSet").addEventListener("click", go("settings"));
$("calToSet").addEventListener("click", () => openSetPage("details"));
$("calSetupBtn").addEventListener("click", () => openSetPage("details"));
$("libBrowse").addEventListener("click", () => openPicker({}));

/* ---------- start ---------- */
async function loadBuiltins() {
  const idx = await fetch("programs/index.json").then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
  const raws = await Promise.all(idx.programs.map(f => fetch("programs/" + f).then(r => r.json())));
  return raws.map(r => normalizeProgram(r, true));
}
setLanguage(SET.lang);
applyTheme();
applyI18n();
/* Ask the browser to keep this app's data even when the phone is low on storage (no prompt on most browsers) */
if (navigator.storage && navigator.storage.persist) navigator.storage.persisted().then(p => p || navigator.storage.persist()).catch(() => {});
/* Mark the test version so it's never mistaken for the main app */
if (PREFIX === "llb-") {
  document.title = "Lift Ledger · " + t("beta.tag");
  const tag = document.createElement("span"); tag.className = "betatag"; tag.dataset.i18n = "beta.tag"; tag.textContent = t("beta.tag");
  $("appTitle").after(tag);
}
/* Start once every script (library, calories) has loaded */
document.addEventListener("DOMContentLoaded", async () => {
  let builtins = [];
  const libLoad = typeof loadLibrary === "function" ? loadLibrary() : Promise.resolve();
  try { builtins = await loadBuiltins(); }
  catch (e) { $("loading").textContent = t("err.loadPrograms"); }
  const customs = [];
  load(KEY.custom, []).forEach(r => { try { const p = normalizeProgram(r, false); if (!builtins.some(b => b.id === p.id)) customs.push(p); } catch (e) {} });
  PROGRAMS = builtins.concat(customs);
  if (!PROGRAMS.length) return;
  const saved = load(KEY.prog, null);
  if (saved && progById(saved)) useProgram(saved); else P = null;
  const v = load(KEY.view, null);
  if (v && v.week >= 1 && v.day >= 0) view = { week: v.week, day: v.day };
  await libLoad;
  if (!("pro" in SAVED_SET)) { SET.pro = usesProFeatures(); saveSettings(); }
  renderAll();
  if (typeof readShareHash === "function") readShareHash();
  if (typeof showInstallTip === "function") showInstallTip(false);
});
