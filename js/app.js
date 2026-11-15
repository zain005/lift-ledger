/* Lift Ledger: workout log. Plain JavaScript, no dependencies.
   All data lives in localStorage under keys that start with "ll-". */
"use strict";

const $ = id => document.getElementById(id);
const range = n => Array.from({ length: n }, (_, k) => k);
const KEY = { custom: "ll-programs-custom", prog: "ll-program", view: "ll-view", set: "ll-settings", log: id => "ll-log-" + id };
function load(key, fallback) { try { const v = JSON.parse(localStorage.getItem(key)); return v === null || v === undefined ? fallback : v; } catch (e) { return fallback; } }
function store(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }

const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const PLAY_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5.5v13l10.5-6.5z"/></svg>';

/* ---------- settings ---------- */
const SET_DEFAULT = { videos: true, cues: true, last: true, rpeBox: true, smartOpen: true, calTab: true, unit: "kg" };
let SET = Object.assign({}, SET_DEFAULT, load(KEY.set, {}));
const SET_ITEMS = [
  ["setWorkout", "videos", "Demo links", "Exercise names link to the program's demo video, or a YouTube search."],
  ["setWorkout", "cues", "Exercise tips", "A short form cue under each exercise."],
  ["setWorkout", "last", "Last time", "The weights you lifted the week before."],
  ["setWorkout", "rpeBox", "RPE explainer", "The “What does RPE mean?” box above the workout."],
  ["setApp", "smartOpen", "Open on my next session", "Off: reopen on the week and day you last viewed."],
  ["setApp", "calTab", "Calories tab", "Show the calorie calculator."]
];
function saveSettings() { store(KEY.set, SET); }

/* ---------- programs ---------- */
const slug = s => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
const str = (v, max) => (typeof v === "string" || typeof v === "number") ? String(v).slice(0, max || 200) : "";

/* Turn a program file into the shape the app uses. Throws an Error with a readable message if it's invalid. */
function normalizeProgram(raw, builtin) {
  if (!raw || typeof raw !== "object") throw new Error("The file isn't a program (expected a JSON object).");
  const name = str(raw.name, 40).trim();
  if (!name) throw new Error("The program needs a \"name\".");
  const weeks = raw.weeks === undefined ? 8 : Math.floor(+raw.weeks);
  if (!(weeks >= 1 && weeks <= 12)) throw new Error("\"weeks\" must be between 1 and 12.");
  const parseDays = (days, where) => {
    if (!Array.isArray(days) || days.length < 1 || days.length > 7) throw new Error(where + ": \"days\" must be a list of 1 to 7 days.");
    return days.map((d, di) => {
      if (!d || !Array.isArray(d.exercises) || !d.exercises.length || d.exercises.length > 15)
        throw new Error(where + ", day " + (di + 1) + ": \"exercises\" must be a list of 1 to 15 exercises.");
      return {
        name: str(d.name, 30).trim() || "Day " + (di + 1),
        short: str(d.short, 8).trim(),
        exercises: d.exercises.map((e, ei) => {
          const en = e && str(e.name, 60).trim();
          if (!en) throw new Error(where + ", day " + (di + 1) + ", exercise " + (ei + 1) + ": missing \"name\".");
          const sets = Math.floor(+e.sets);
          if (!(sets >= 1 && sets <= 10)) throw new Error("\"" + en + "\": \"sets\" must be 1 to 10.");
          const video = str(e.video, 300);
          return {
            name: en, sets, reps: str(e.reps, 12) || "", type: str(e.type, 20), rpe: str(e.rpe, 16), cue: str(e.cue, 300),
            alts: Array.isArray(e.alts) ? e.alts.map(a => str(a, 60).trim()).filter(Boolean).slice(0, 8) : [],
            video: /^https:\/\//.test(video) ? video : ""
          };
        })
      };
    });
  };
  const baseDays = parseDays(raw.days, "Program");
  let phases = Array.isArray(raw.phases) && raw.phases.length ? raw.phases : [{ name: "", weeks: [1, weeks] }];
  phases = phases.map((ph, pi) => {
    const w = Array.isArray(ph.weeks) ? ph.weeks : [1, weeks];
    const from = Math.max(1, Math.floor(+w[0] || 1)), to = Math.min(weeks, Math.floor(+w[w.length - 1] || weeks));
    if (to < from) throw new Error("Phase " + (pi + 1) + " has an empty week range.");
    const days = ph.days ? parseDays(ph.days, "Phase " + (pi + 1)) : baseDays;
    if (days.length !== baseDays.length) throw new Error("Phase " + (pi + 1) + " must have the same number of days as the program.");
    const rpe = ph.rpe && typeof ph.rpe === "object" ? ph.rpe : {};
    return {
      name: str(ph.name, 30), from, to,
      days: days.map(d => d.exercises.map(e => Object.assign({}, e, { rpe: e.rpe || str(rpe[e.type], 16) })))
    };
  }).sort((a, b) => a.from - b.from);
  return {
    id: slug(raw.id) || slug(name), name, builtin: !!builtin,
    description: str(raw.description, 200), schedule: str(raw.schedule, 300), weeks,
    dayNames: baseDays.map(d => d.name), dayShort: baseDays.map(d => d.short),
    phases
  };
}

let PROGRAMS = [];          // normalized programs, built-in first
let P = null;               // current program
let LOGS = {};              // per program id: { w1: { "0-3": { s: ["", ""], alt? }, done0: true } }
let logs = {};
let view = { week: 1, day: 0 };

const progById = id => PROGRAMS.find(p => p.id === id);
const DPW = () => P.dayNames.length;
const NW = () => P.weeks;
const phaseOf = w => P.phases.find(p => w >= p.from && w <= p.to) || P.phases[P.phases.length - 1];
const phaseNum = w => P.phases.indexOf(phaseOf(w)) + 1;
const dayList = (w, d) => phaseOf(w).days[d];
const STATS = () => NW() + 1;   // the Stats "week"

function logsFor(id) { return LOGS[id] || (LOGS[id] = load(KEY.log(id), {})); }
function useProgram(id) {
  P = progById(id) || PROGRAMS[0];
  logs = logsFor(P.id);
  store(KEY.prog, P.id);
}

/* ---------- log access ---------- */
function entry(w, d, i) {
  const wk = logs["w" + w] || (logs["w" + w] = {});
  return wk[d + "-" + i] || (wk[d + "-" + i] = { s: Array(dayList(w, d)[i].sets).fill("") });
}
function peek(w, d, i) { const wk = logs["w" + w]; return wk && wk[d + "-" + i]; }
function persist() { store(KEY.log(P.id), logs); }
function saveView() { store(KEY.view, view); }

/* ---------- derived state ---------- */
function isDayDone(w, d) { return !!(logs["w" + w] && logs["w" + w]["done" + d]); }
function weekComplete(w) { return range(DPW()).every(d => isDayDone(w, d)); }
/* A session is missed when it isn't done but a later session (in program order) is. */
function lastDoneIndex() {
  let last = -1; const D = DPW();
  for (let w = 1; w <= NW(); w++) for (let d = 0; d < D; d++) if (isDayDone(w, d)) last = (w - 1) * D + d;
  return last;
}
function isMissed(w, d) { return !isDayDone(w, d) && (w - 1) * DPW() + d < lastDoneIndex(); }
/* A done day with any set left empty */
function dayHasGaps(w, d) {
  if (!isDayDone(w, d)) return false;
  return dayList(w, d).some((ex, i) => { const e = peek(w, d, i); return !e || !e.s || range(ex.sets).some(k => !e.s[k]); });
}
/* Which day a week opens on: first day needing attention, otherwise the next day not done, otherwise Day 1 */
function smartDay(w) {
  const D = DPW();
  for (let d = 0; d < D; d++) if (isMissed(w, d) || dayHasGaps(w, d)) return d;
  for (let d = 0; d < D; d++) if (!isDayDone(w, d)) return d;
  return 0;
}
function weekHasMissed(w) { return range(DPW()).some(d => isMissed(w, d) || dayHasGaps(w, d)); }
/* Where the app opens: earliest done day with empty sets, otherwise the session after the latest done one */
function currentSpot() {
  const D = DPW();
  for (let w = 1; w <= NW(); w++) for (let d = 0; d < D; d++) if (dayHasGaps(w, d)) return { week: w, day: d };
  const last = lastDoneIndex();
  if (last >= NW() * D - 1) return { week: STATS(), day: 0 };
  const w = Math.floor((last + 1) / D) + 1;
  return { week: w, day: smartDay(w) };
}
/* Most recent earlier week with this exercise logged: same day first, then any day */
function lastTime(w, d0, name) {
  for (let pw = w - 1; pw >= 1; pw--) {
    const days = phaseOf(pw).days;
    const order = [d0].concat(range(days.length).reverse().filter(d => d !== d0));
    for (const d of order) {
      const idx = days[d].findIndex(e => e.name === name);
      if (idx < 0) continue;
      const e = peek(pw, d, idx);
      if (e && e.s && e.s.some(v => v !== "")) return { week: pw, s: e.s.slice(0, days[d][idx].sets), actual: e.alt || name };
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
  a.setAttribute("aria-label", n + " demo");
  return a;
}

/* ---------- render: header ---------- */
function goWeek(w) { if (view.week !== w) view.day = w <= NW() ? smartDay(w) : 0; view.week = w; saveView(); renderAll(); window.scrollTo({ top: 0 }); }

function renderWeeks() {
  const el = $("weeks"); el.innerHTML = "";
  const cols = [];
  P.phases.forEach((ph, pi) => { if (pi) cols.push("6px"); cols.push("repeat(" + (ph.to - ph.from + 1) + ", minmax(0, 1fr))"); });
  cols.push("6px", "minmax(0, 1.35fr)");
  el.style.gridTemplateColumns = cols.join(" ");
  for (let w = 1; w <= NW(); w++) {
    if (P.phases.some((ph, pi) => pi && ph.from === w)) { const g = document.createElement("span"); g.className = "gap"; g.setAttribute("aria-hidden", "true"); el.appendChild(g); }
    const b = document.createElement("button");
    const wc = weekComplete(w), wm = weekHasMissed(w);
    b.type = "button"; b.className = "wk" + (wc ? " complete" : "") + (wm ? " has-missed" : "");
    b.setAttribute("aria-pressed", String(w === view.week));
    b.setAttribute("aria-label", "Week " + w + (wc ? ", done" : "") + (wm ? ", needs attention" : ""));
    b.innerHTML = "<small>WK</small>" + w;
    b.addEventListener("click", () => goWeek(w));
    el.appendChild(b);
  }
  const g2 = document.createElement("span"); g2.className = "gap"; g2.setAttribute("aria-hidden", "true"); el.appendChild(g2);
  const pb = document.createElement("button");
  pb.type = "button"; pb.className = "wk prog";
  pb.setAttribute("aria-pressed", String(view.week === STATS()));
  pb.setAttribute("aria-label", "Progress");
  pb.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 18l5-6 4 3 7-9"/></svg><small>STATS</small>';
  pb.addEventListener("click", () => goWeek(STATS()));
  el.appendChild(pb);
  if (view.week === STATS()) { $("phase").textContent = "Your progress"; return; }
  const ph = phaseOf(view.week);
  $("phase").textContent = P.phases.length > 1 ? "Phase " + phaseNum(view.week) + (ph.name ? " · " + ph.name : "") : ph.name;
}

function renderDays() {
  const el = $("days"); el.innerHTML = "";
  const D = DPW();
  el.style.gridTemplateColumns = "repeat(" + D + ", minmax(0, 1fr))";
  el.classList.toggle("many", D > 4);
  for (let d = 0; d < D; d++) {
    const done = isDayDone(view.week, d), missed = isMissed(view.week, d), gaps = dayHasGaps(view.week, d);
    const b = document.createElement("button");
    b.type = "button"; b.className = "day" + (done ? " complete" : missed ? " missed" : "") + (gaps ? " has-gaps" : "");
    if (gaps) b.title = "Some sets have no weight logged";
    b.setAttribute("aria-pressed", String(d === view.day));
    const status = done ? "Done" : missed ? "Missed" : "To do";
    b.setAttribute("aria-label", "Day " + (d + 1) + ", " + P.dayNames[d] + ", " + status);
    const sh = P.dayShort[d];
    const sub = sh ? (done ? "✓ " : "") + sh : (done ? "✓ Done" : status);
    b.innerHTML = (D > 4 ? "D" : "Day ") + (d + 1) + "<small></small>";
    b.querySelector("small").textContent = sub;
    b.addEventListener("click", () => { view.day = d; saveView(); renderAll(); window.scrollTo({ top: 0 }); });
    el.appendChild(b);
  }
}

function renderHead() {
  const done = isDayDone(view.week, view.day), missed = isMissed(view.week, view.day);
  $("dayTitle").textContent = "Wk " + view.week + " · " + P.dayNames[view.day];
  const st = $("dayStatus");
  st.hidden = !(done || missed);
  st.className = "status " + (done ? "done" : "missed");
  st.textContent = done ? "✓ Done" : "Missed";
  const btn = $("dayDone");
  btn.setAttribute("aria-pressed", String(done));
  btn.innerHTML = done
    ? CHECK_SVG + "Day " + (view.day + 1) + " done <small>· tap to undo</small>"
    : CHECK_SVG + "Mark day " + (view.day + 1) + " done";
  $("list").classList.toggle("is-done", done);
  updateEmptyWarn();
}
function updateEmptyWarn() {
  const el = $("emptyWarn");
  if (!isDayDone(view.week, view.day) || view.week === STATS()) { el.hidden = true; return; }
  const n = $("list").querySelectorAll(".set input.empty").length;
  el.hidden = n === 0;
  el.textContent = n + (n === 1 ? " set has" : " sets have") + " no weight logged. Fill in the red boxes (enter 0 for bodyweight).";
}
$("dayDone").addEventListener("click", () => {
  const w = view.week, key = "done" + view.day;
  const wk = logs["w" + w] || (logs["w" + w] = {});
  if (wk[key]) delete wk[key]; else wk[key] = true;
  persist(); renderWeeks(); renderDays(); renderHead();
});

/* ---------- render: workout ---------- */
const fmt = v => v === "" || v === undefined ? "–" : v;

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
      sw.append("Instead of "); const b = document.createElement("b"); b.textContent = name; sw.append(b);
      nm.append(sw);
    }
    const pr = document.createElement("div"); pr.className = "presc";
    pr.innerHTML = '<span class="sr"></span>' + (rpe ? '<span class="pill"></span>' : '') + (e.alt ? '<span class="tag">Swapped</span>' : '');
    pr.querySelector(".sr").innerHTML = sets + "<i>×</i>";
    pr.querySelector(".sr").append(reps);
    if (rpe) pr.querySelector(".pill").textContent = "RPE " + rpe;
    nm.append(pr);
    top.append(num, nm);
    card.append(top);

    if (SET.cues && cue && !e.alt) { const c = document.createElement("p"); c.className = "cue"; c.textContent = cue; card.append(c); }

    const setsEl = document.createElement("div"); setsEl.className = "sets";
    for (let s = 0; s < sets; s++) {
      const id = "w" + w + "d" + d + "e" + i + "s" + s;
      const wrap = document.createElement("div"); wrap.className = "set";
      wrap.innerHTML = '<label for="' + id + '">Set ' + (s + 1) + '</label><div class="field"><input id="' + id + '" type="text" inputmode="decimal" autocomplete="off" placeholder="0"><span class="unit">' + (SET.unit === "lb" ? "lb" : "kg") + '</span></div>';
      const inp = wrap.querySelector("input");
      inp.value = (e.s && e.s[s]) || "";
      inp.classList.toggle("empty", !inp.value);
      inp.addEventListener("input", () => {
        const clean = inp.value.replace(",", ".").replace(/[^0-9.]/g, "").slice(0, 6);
        if (clean !== inp.value) inp.value = clean;
        entry(w, d, i).s[s] = clean; persist();
        inp.classList.toggle("empty", !clean); updateEmptyWarn();
        if (isDayDone(w, d)) { renderWeeks(); renderDays(); }
      });
      setsEl.appendChild(wrap);
    }
    card.append(setsEl);

    const lt = SET.last ? lastTime(w, d, name) : null;
    if (lt) {
      const p = document.createElement("p"); p.className = "last";
      p.append("Last time (week " + lt.week + (lt.actual !== shown ? ", " + lt.actual : "") + "): ");
      const b = document.createElement("b"); b.textContent = lt.s.map(fmt).join(" · "); p.append(b, " " + SET.unit);
      card.appendChild(p);
    }

    if (alts.length) {
      const det = document.createElement("details"); det.className = "alts";
      const sum = document.createElement("summary"); sum.textContent = e.alt ? "Change exercise" : "Swap exercise";
      const ul = document.createElement("ul");
      [name].concat(alts).filter(s => s !== shown).forEach(s => {
        const li = document.createElement("li");
        const btn = document.createElement("button"); btn.type = "button";
        if (s === name) btn.className = "orig";
        const lbl = document.createElement("span"); lbl.textContent = s + (s === name ? " (planned)" : "");
        btn.appendChild(lbl);
        btn.addEventListener("click", () => { const en = entry(w, d, i); if (s === name) delete en.alt; else en.alt = s; persist(); renderList(); });
        li.appendChild(btn);
        const vu = demoUrl(s, s === name ? ex.video : "");
        if (vu) {
          const va = document.createElement("a"); va.href = vu; va.target = "_blank"; va.rel = "noopener";
          va.className = "vbtn"; va.innerHTML = PLAY_SVG; va.setAttribute("aria-label", s + " demo");
          li.appendChild(va);
        }
        ul.appendChild(li);
      });
      const note = document.createElement("p"); note.textContent = "The swap applies to this week only. Keep the same sets, reps and RPE.";
      det.append(sum, ul, note);
      card.appendChild(det);
    }
    list.appendChild(card);
  });
}

/* ---------- render: progress ---------- */
const num = v => { const n = parseFloat(v); return isFinite(n) && n > 0 ? n : 0; };
const fmtKg = n => n >= 10000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : Math.round(n).toLocaleString("en-US");
const fmtW = n => (Math.round(n * 10) / 10).toString();

function computeStats() {
  let done = 0, missed = 0;
  const weekVol = [], lifts = {}, D = DPW();
  for (let w = 1; w <= NW(); w++) {
    let vol = 0;
    for (let d = 0; d < D; d++) {
      if (isDayDone(w, d)) done++; else if (isMissed(w, d)) missed++;
      dayList(w, d).forEach((ex, i) => {
        const e = peek(w, d, i); if (!e || !e.s) return;
        const ws = e.s.slice(0, ex.sets).map(num).filter(Boolean); if (!ws.length) return;
        vol += ws.reduce((a, b) => a + b, 0) * (parseInt(ex.reps, 10) || 0);
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
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Weekly training volume">';
  for (let k = 0; k <= 3; k++) {
    const v = nice * k, yy = y(v).toFixed(1);
    s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '" stroke="var(--line)" stroke-width="1"' + (k ? ' stroke-dasharray="2 3"' : '') + '/>';
    s += '<text x="' + (L - 6) + '" y="' + yy + '" dy="0.32em" text-anchor="end" font-size="10.5" fill="var(--muted)">' + fmtKg(v) + '</text>';
  }
  weekVol.forEach((v, i) => {
    const x0 = L + i * bw + gap / 2, w = bw - gap, x1 = x0 + w, yb = y(0), yt = y(v), r = Math.min(4, (yb - yt) / 2, w / 2);
    if (v > 0) s += '<path d="M' + x0 + ',' + yb + 'V' + (yt + r) + 'Q' + x0 + ',' + yt + ' ' + (x0 + r) + ',' + yt + 'H' + (x1 - r) + 'Q' + x1 + ',' + yt + ' ' + x1 + ',' + (yt + r) + 'V' + yb + 'Z" fill="var(--accent)"/>';
    s += '<rect class="hit" data-i="' + i + '" x="' + (L + i * bw) + '" y="' + T + '" width="' + bw + '" height="' + (H - T - B) + '" fill="transparent" style="cursor:pointer"/>';
    s += '<text x="' + (x0 + w / 2) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="10.5" fill="var(--muted)">W' + (i + 1) + '</text>';
  });
  return s + '</svg>';
}

function renderProgress() {
  const st = computeStats(), el = $("progress"), D = DPW(), total = NW() * D, U = SET.unit;
  const pct = Math.round(st.done / total * 100);
  const best = st.weekVol.map((v, i) => [v, i]).filter(([v]) => v > 0).reduce((b, c) => (c[0] > (b ? b[0] : -1) ? c : b), null);
  const gains = st.liftList.filter(l => l.weeks.length > 1);
  const ups = gains.filter(l => l.diff > 0).length;

  let h = '<h2 id="progTitle"></h2><div class="tiles">' +
    '<div class="tile"><div class="k">Sessions done</div><div class="v">' + st.done + '<small> / ' + total + '</small></div><div class="meter"><i style="width:' + pct + '%"></i></div><div class="s">' + pct + '% of the program</div></div>' +
    '<div class="tile"><div class="k">Missed</div><div class="v">' + st.missed + '</div><div class="s">' + (st.missed ? 'Skipped before a later session' : 'None so far') + '</div></div>' +
    '<div class="tile"><div class="k">Total volume</div><div class="v">' + fmtKg(st.totalVol) + '<small> ' + U + '</small></div><div class="s">Weight × reps, all logged sets</div></div>' +
    '<div class="tile"><div class="k">Lifts going up</div><div class="v">' + ups + '<small> / ' + gains.length + '</small></div><div class="s">' + (gains.length ? 'Heavier than the first time' : 'Log 2+ weeks to compare') + '</div></div>' +
    '</div>';

  const cols = ["22px"];
  P.phases.forEach((ph, pi) => { if (pi) cols.push("4px"); cols.push("repeat(" + (ph.to - ph.from + 1) + ", minmax(0, 1fr))"); });
  const isBreak = w => P.phases.some((ph, pi) => pi && ph.from === w);
  h += '<div class="panel"><h3>Sessions by week</h3><div class="sessgrid" style="grid-template-columns:' + cols.join(" ") + '"><span></span>';
  for (let w = 1; w <= NW(); w++) { if (isBreak(w)) h += '<span></span>'; h += '<span class="lbl">W' + w + '</span>'; }
  for (let d = 0; d < D; d++) {
    h += '<span class="lbl">D' + (d + 1) + '</span>';
    for (let w = 1; w <= NW(); w++) {
      if (isBreak(w)) h += '<span></span>';
      const dn = isDayDone(w, d), ms = isMissed(w, d);
      h += '<span class="cell' + (dn ? ' done' : ms ? ' missed' : '') + '" title="Week ' + w + ' Day ' + (d + 1) + (dn ? ': done' : ms ? ': missed' : ': to do') + '">' + (dn ? '✓' : ms ? '✕' : '') + '</span>';
    }
  }
  h += '</div><div class="legend"><span><i class="done"></i>Done</span><span><i class="missed"></i>Missed</span><span><i></i>To do</span></div></div>';

  h += '<div class="panel chart"><h3>Weekly volume (' + U + ')</h3><p class="sub">Total weight moved each week, assuming the bottom of each rep range.</p>' +
    volumeChart(st.weekVol) + '<div class="readout" id="volReadout"></div></div>';

  h += '<div class="panel"><h3>Strength by exercise</h3><p class="sub">Heaviest set each week, first logged vs latest.</p><div class="lifts">';
  if (!st.liftList.length) h += '<p class="empty">Log weights on any workout and your lifts will show up here.</p>';
  st.liftList.forEach(l => {
    const cls = l.weeks.length < 2 ? '' : l.diff > 0 ? ' up' : l.diff < 0 ? ' down' : '';
    const delta = l.weeks.length < 2 ? '<span style="color:var(--muted)">–</span><small>1 week logged</small>'
      : (l.diff > 0 ? '+' : l.diff < 0 ? '−' : '±') + fmtW(Math.abs(l.diff)) + ' ' + U + '<small>' + (l.diff >= 0 ? '+' : '−') + Math.abs(Math.round(l.pct)) + '%</small>';
    h += '<div class="lift"><div><div class="n"></div><div class="r">' +
      (l.weeks.length < 2 ? 'W' + l.firstW + ': ' + fmtW(l.first) + ' ' + U : 'W' + l.firstW + ' ' + fmtW(l.first) + ' → W' + l.lastW + ' ' + fmtW(l.last) + ' ' + U) +
      '</div></div>' + sparkline(l) + '<div class="d' + cls + '">' + delta + '</div></div>';
  });
  h += '</div></div>';
  el.innerHTML = h;
  $("progTitle").textContent = "Your progress · " + P.name;
  el.querySelectorAll(".lift .n").forEach((n, i) => { n.textContent = st.liftList[i].name; });

  const ro = $("volReadout");
  const show = i => { ro.innerHTML = 'Week ' + (i + 1) + ': <b>' + Math.round(st.weekVol[i]).toLocaleString("en-US") + ' ' + U + '</b>' + (st.weekVol[i] ? '' : ' (nothing logged)'); };
  if (best) ro.innerHTML = 'Best week: <b>Week ' + (best[1] + 1) + ', ' + Math.round(best[0]).toLocaleString("en-US") + ' ' + U + '</b>. Tap a bar for details.';
  else ro.textContent = 'Log weights to see your weekly volume.';
  el.querySelectorAll(".hit").forEach(r => { const i = +r.dataset.i; r.addEventListener("click", () => show(i)); r.addEventListener("mouseenter", () => show(i)); });
}

/* ---------- settings page ---------- */
function doneCount(p) {
  const L = logsFor(p.id), D = p.dayNames.length; let n = 0;
  for (let w = 1; w <= p.weeks; w++) for (let d = 0; d < D; d++) if (L["w" + w] && L["w" + w]["done" + d]) n++;
  return [n, p.weeks * D];
}
function showMsg(id, text, err) { const m = $(id); m.hidden = !text; m.textContent = text || ""; m.classList.toggle("err", !!err); }
function setProgram(id) { useProgram(id); view = currentSpot(); saveView(); }

function renderSettings() {
  const pg = $("setProgs"); pg.innerHTML = "";
  PROGRAMS.forEach(p => {
    const [n, t] = doneCount(p);
    const wrap = document.createElement("div"); wrap.className = "pcard-wrap";
    const b = document.createElement("button"); b.type = "button"; b.className = "pcard";
    b.setAttribute("aria-pressed", String(p.id === P.id));
    b.innerHTML = '<span class="dot" aria-hidden="true"></span><span><b></b><small></small><small></small><span class="meter"><i style="width:' + Math.round(n / t * 100) + '%"></i></span></span>';
    const sm = b.querySelectorAll("small");
    b.querySelector("b").textContent = p.name;
    sm[0].textContent = (p.description || p.dayNames.length + " days a week") + (p.builtin ? "" : " · imported");
    sm[1].textContent = n + " of " + t + " sessions done" + (p.id === P.id ? " · current" : "");
    b.addEventListener("click", () => { if (p.id !== P.id) { setProgram(p.id); renderSettings(); } });
    wrap.appendChild(b);
    if (!p.builtin) {
      const acts = document.createElement("div"); acts.className = "pcard-acts";
      const rm = document.createElement("button"); rm.type = "button"; rm.className = "linkbtn"; rm.textContent = "Remove program";
      rm.addEventListener("click", () => {
        if (!confirm("Remove \"" + p.name + "\"? Its logged weights stay saved and come back if you import it again.")) return;
        store(KEY.custom, load(KEY.custom, []).filter(r => slug(r.id || r.name) !== p.id));
        PROGRAMS = PROGRAMS.filter(x => x !== p);
        if (P === p) setProgram(PROGRAMS[0].id);
        renderSettings();
      });
      acts.appendChild(rm); wrap.appendChild(acts);
    }
    pg.appendChild(wrap);
  });
  ["setWorkout", "setApp"].forEach(id => { $(id).innerHTML = ""; });
  SET_ITEMS.forEach(([box, k, title, desc]) => {
    const lab = document.createElement("label"); lab.className = "tog";
    lab.innerHTML = '<span><b></b><small></small></span><input type="checkbox" role="switch">';
    lab.querySelector("b").textContent = title; lab.querySelector("small").textContent = desc;
    const inp = lab.querySelector("input"); inp.checked = !!SET[k];
    inp.addEventListener("change", () => { SET[k] = inp.checked; saveSettings(); applyChrome(); });
    $(box).appendChild(lab);
  });
  document.querySelectorAll("#unitSeg button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.u === SET.unit)));
  if (typeof renderCal === "function") renderCal();
}
document.querySelectorAll("#unitSeg button").forEach(b => b.addEventListener("click", () => { SET.unit = b.dataset.u; saveSettings(); renderSettings(); }));

function readFile(input, cb) {
  const f = input.files && input.files[0]; input.value = "";
  if (!f) return;
  if (f.size > 2e6) { cb(new Error("That file is too large.")); return; }
  const r = new FileReader();
  r.onload = () => { try { cb(null, JSON.parse(r.result)); } catch (e) { cb(new Error("That file isn't valid JSON.")); } };
  r.onerror = () => cb(new Error("Couldn't read the file."));
  r.readAsText(f);
}
$("progFile").addEventListener("change", e => readFile(e.target, (err, raw) => {
  if (err) { showMsg("progMsg", err.message, true); return; }
  let p;
  try { p = normalizeProgram(raw, false); } catch (x) { showMsg("progMsg", x.message, true); return; }
  if (PROGRAMS.some(q => q.builtin && q.id === p.id)) { p.id = p.id + "-custom"; raw = Object.assign({}, raw, { id: p.id }); }
  const existing = progById(p.id);
  if (existing && !confirm("Replace your imported program \"" + existing.name + "\" with this file? Logged weights are kept.")) return;
  store(KEY.custom, load(KEY.custom, []).filter(r => slug(r.id || r.name) !== p.id).concat([Object.assign({}, raw, { id: p.id })]));
  PROGRAMS = PROGRAMS.filter(q => q.id !== p.id).concat([p]);
  setProgram(p.id);
  showMsg("progMsg", "Imported \"" + p.name + "\" and switched to it.");
  renderSettings();
}));

/* ---------- export / import ---------- */
function download(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
const stamp = () => new Date().toISOString().slice(0, 10);
function allKeys() { const out = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith("ll-")) out.push(k); } return out; }

$("expJson").addEventListener("click", () => {
  const data = {}; allKeys().forEach(k => { data[k] = load(k, null); });
  download("lift-ledger-backup-" + stamp() + ".json", JSON.stringify({ app: "lift-ledger", format: 1, exported: new Date().toISOString(), data }, null, 2), "application/json");
  showMsg("dataMsg", "Backup downloaded.");
});
$("expCsv").addEventListener("click", () => {
  const q = v => /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v);
  const rows = [["program", "week", "phase", "day", "session", "exercise_no", "planned_exercise", "exercise", "set", "weight", "unit", "target_reps", "target_rpe", "day_done"]];
  PROGRAMS.forEach(p => {
    const L = logsFor(p.id);
    for (let w = 1; w <= p.weeks; w++) {
      const ph = p.phases.find(x => w >= x.from && w <= x.to) || p.phases[p.phases.length - 1];
      ph.days.forEach((day, d) => day.forEach((ex, i) => {
        const e = L["w" + w] && L["w" + w][d + "-" + i]; if (!e || !e.s) return;
        e.s.slice(0, ex.sets).forEach((v, s) => {
          if (v === "" || v === undefined) return;
          rows.push([p.name, w, ph.name, d + 1, p.dayNames[d], i + 1, ex.name, e.alt || ex.name, s + 1, v, SET.unit, ex.reps, ex.rpe, L["w" + w]["done" + d] ? "yes" : "no"]);
        });
      }));
    }
  });
  download("lift-ledger-sets-" + stamp() + ".csv", rows.map(r => r.map(q).join(",")).join("\n") + "\n", "text/csv");
  showMsg("dataMsg", rows.length > 1 ? "Exported " + (rows.length - 1) + " logged sets." : "No logged sets yet, so the CSV only has headers.");
});
$("impFile").addEventListener("change", e => readFile(e.target, (err, raw) => {
  if (err) { showMsg("dataMsg", err.message, true); return; }
  if (!raw || raw.app !== "lift-ledger" || !raw.data || typeof raw.data !== "object") { showMsg("dataMsg", "That isn't a Lift Ledger backup file.", true); return; }
  if (!confirm("Replace all data on this device with this backup? Anything not in the backup will be lost.")) return;
  allKeys().forEach(k => localStorage.removeItem(k));
  Object.entries(raw.data).forEach(([k, v]) => { if (k.startsWith("ll-")) store(k, v); });
  location.reload();
}));
$("setReset").addEventListener("click", () => { SET = Object.assign({}, SET_DEFAULT); saveSettings(); renderAll(); showMsg("dataMsg", "Screen settings reset. Your data wasn't touched."); });
$("eraseAll").addEventListener("click", () => {
  if (!confirm("Erase all workouts, programs, calorie details and settings on this device?")) return;
  if (!confirm("This can't be undone. Erase everything?")) return;
  allKeys().forEach(k => localStorage.removeItem(k));
  location.reload();
});

/* ---------- frame ---------- */
let appMode = "workout", openedOnce = false;
function applyChrome() {
  $("modeCal").hidden = !SET.calTab;
  if (!SET.calTab && appMode === "cal") appMode = "workout";
}
function renderAll() {
  if (!P) return;
  if (!openedOnce) { if (SET.smartOpen || !(view.week >= 1 && view.week <= STATS() && view.day < DPW())) view = currentSpot(); saveView(); }
  openedOnce = true;
  if (view.week > STATS() || view.day >= DPW()) view = currentSpot();
  applyChrome();
  const mode = appMode;
  $("loading").hidden = true;
  $("modeWorkout").setAttribute("aria-pressed", String(mode === "workout"));
  $("modeCal").setAttribute("aria-pressed", String(mode === "cal"));
  $("modeSet").setAttribute("aria-pressed", String(mode === "settings"));
  ["weeks", "days", "rpe", "dayHead", "list", "dayDone", "progress", "emptyWarn", "foot"].forEach(id => { $(id).hidden = mode !== "workout"; });
  $("cal").hidden = mode !== "cal";
  $("settings").hidden = mode !== "settings";
  if (mode === "cal") { $("appTitle").textContent = "Calories"; $("phase").textContent = "Calorie calculator"; if (typeof renderCal === "function") renderCal(); return; }
  if (mode === "settings") { $("appTitle").textContent = "Settings"; $("phase").textContent = "Your preferences"; renderSettings(); return; }
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
const go = m => () => { appMode = m; renderAll(); window.scrollTo({ top: 0 }); };
$("modeWorkout").addEventListener("click", go("workout"));
$("modeCal").addEventListener("click", go("cal"));
$("modeSet").addEventListener("click", go("settings"));
$("calToSet").addEventListener("click", go("settings"));

/* ---------- start ---------- */
async function loadBuiltins() {
  const idx = await fetch("programs/index.json").then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
  const raws = await Promise.all(idx.programs.map(f => fetch("programs/" + f).then(r => r.json())));
  return raws.map(r => normalizeProgram(r, true));
}
(async () => {
  let builtins = [];
  try { builtins = await loadBuiltins(); }
  catch (e) { $("loading").textContent = "Couldn't load the built-in programs. If you opened index.html straight from your files, serve the folder with a local web server instead (see the README)."; }
  const customs = [];
  load(KEY.custom, []).forEach(r => { try { const p = normalizeProgram(r, false); if (!builtins.some(b => b.id === p.id)) customs.push(p); } catch (e) {} });
  PROGRAMS = builtins.concat(customs);
  if (!PROGRAMS.length) return;
  useProgram(load(KEY.prog, PROGRAMS[0].id));
  const v = load(KEY.view, null);
  if (v && v.week >= 1 && v.day >= 0) view = { week: v.week, day: v.day };
  renderAll();
})();
