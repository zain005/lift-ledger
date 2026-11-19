/* Lift Ledger: program builder.
   Without Pro, a program is one week of training days (1 to 7) that repeats with no end.
   In Pro, a program is Week → Days → Exercises: up to 12 weeks, each with its own 1–7 days. "Add week" copies the
   week before (same ids, so "last time" and logs line up week to week) and the coach changes what's different.
   Each exercise is a list of sets; each set is one box holding its target reps (or seconds).
   Programs are saved as program files (the same format as imports) under KEY.custom.
   Every day and exercise keeps a permanent id, so editing a program never moves logged weights. */
"use strict";

const BD = { draft: null, week: 0, day: 0, editingId: null };
const rid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
const MAX_DAYS = 7, MAX_EX = 15, MAX_SETS = 5, MAX_WEEKS = 12;
const curDays = () => BD.draft.weeks[BD.week].days;
const showWeeks = () => !!(SET.pro || BD.draft.weeks.length > 1);
const clone = o => JSON.parse(JSON.stringify(o));

function blankDay(n) { return { id: "d" + rid(), name: t("day.n", { n }), exercises: [] }; }
/* A new exercise starts with one set, using the low end of its usual rep range */
function firstReps(range) { const m = /^(\d+)/.exec(range || ""); return m ? m[1] : "10"; }
function exFromLibrary(e) {
  return { id: "x" + rid(), ref: e.id, name: e.name, setReps: [firstReps(e.reps)], rpe: "", cue: e.cue || "",
           timed: !!e.timed, perSide: !!e.perSide, primary: e.primary || "", secondary: (e.secondary || []).slice() };
}
/* Muscles for an exercise: from the library when it's there, otherwise from what the program saved */
function musclesOf(x) {
  const e = x.ref && typeof exById === "function" ? exById(x.ref) : null;
  return { primary: (e && e.primary) || x.primary || "", secondary: (e && e.secondary) || x.secondary || [] };
}
const isMine = x => x.ref && typeof CUSTOM_EX !== "undefined" && CUSTOM_EX.some(c => c.id === x.ref);

/* ---------- open / close ---------- */
function draftDays(days) {
  return (days || []).map((d, di) => {
        const dayId = sid(d.id) || "d" + (di + 1);
    return { id: dayId, name: d.name || t("day.n", { n: di + 1 }),
      exercises: (d.exercises || []).map((e, ei) => {
            const n = Math.max(1, Math.min(10, Math.floor(+e.sets) || 1));
            const setReps = Array.isArray(e.setReps) && e.setReps.length === n ? e.setReps.map(String) : Array(n).fill(String(e.reps || ""));
            return { id: sid(e.id) || dayId + "e" + (ei + 1), ref: e.ref || "", name: e.name, setReps, rpe: e.rpe || "", cue: e.cue || "",
                     timed: !!e.timed, perSide: !!e.perSide, primary: e.primary || "", secondary: e.secondary || [] };
          }) };
      });
}
function openBuilder(programId) {
  BD.editingId = programId || null; BD.week = 0; BD.day = 0;
  if (programId) {
    const raw = load(KEY.custom, []).find(r => slug(r.id || r.name) === programId);
    if (!raw) return;
    // A week-by-week program keeps one block per week; anything else is edited as one week
    const weekly = raw.weekly && Array.isArray(raw.phases) && raw.phases.length > 1;
    const weeks = weekly ? raw.phases.slice().sort((a, b) => (a.weeks[0] || 0) - (b.weeks[0] || 0)).map(ph => ({ days: draftDays(ph.days || raw.days) }))
                         : [{ days: draftDays(raw.days) }];
    BD.draft = { name: raw.name || "", weeks: weeks.slice(0, MAX_WEEKS) };
  } else {
    BD.draft = { name: "", weeks: [{ days: [blankDay(1)] }] };
  }
  $("bdTitle").textContent = t(programId ? "bd.editTitle" : "bd.newTitle");
  showMsg("bdMsg", "");
  renderBuilder();
  $("builder").hidden = false; $("builder").scrollTop = 0;
  document.body.classList.add("sheet-open");
}
function closeBuilder() { $("builder").hidden = true; if ($("picker").hidden) document.body.classList.remove("sheet-open"); }
function builderDirty() { return BD.draft && (BD.draft.name.trim() || BD.draft.weeks.some(w => w.days.some(d => d.exercises.length))); }

/* ---------- render ---------- */
function renderWeekTabs() {
  const W = BD.draft.weeks;
  $("bdWeekBox").hidden = !showWeeks();
  $("bdDelWeek").hidden = !showWeeks() || W.length < 2;
  if (!showWeeks()) return;
  const tabs = $("bdWeekTabs"); tabs.innerHTML = "";
  W.forEach((wk, i) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "bd-weektab"; b.setAttribute("aria-pressed", String(i === BD.week));
    b.textContent = t("week.n", { n: i + 1 });
    if (wk.days.some(d => !d.exercises.length)) b.classList.add("empty");
    b.addEventListener("click", () => { BD.week = i; BD.day = 0; renderBuilder(); });
    tabs.appendChild(b);
  });
  if (W.length < MAX_WEEKS) {
    const add = document.createElement("button"); add.type = "button"; add.className = "bd-weektab add"; add.id = "bdAddWeek";
    add.textContent = t("bd.addWeek");
    add.addEventListener("click", () => {
      W.push({ days: clone(W[W.length - 1].days) });      // a copy of the last week, same ids
      BD.week = W.length - 1; BD.day = 0; renderBuilder();
      $("bdWeeksNote").textContent = t("bd.weekCopied", { n: W.length, from: W.length - 1 });   // said where they're looking
    });
    tabs.appendChild(add);
  }
  $("bdWeeksNote").textContent = W.length > 1 ? tn("bd.weeksNote", W.length, { max: MAX_WEEKS }) : t("bd.weeksNoteOne", { max: MAX_WEEKS });
}
function renderBuilder() {
  const D = BD.draft;
  if (document.activeElement !== $("bdName")) $("bdName").value = D.name;
  if (BD.week >= D.weeks.length) BD.week = D.weeks.length - 1;
  const days = curDays();
  if (BD.day >= days.length) BD.day = days.length - 1;
  renderWeekTabs();
  const tabs = $("bdDayTabs"); tabs.innerHTML = "";
  days.forEach((d, i) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "bd-daytab"; b.setAttribute("aria-pressed", String(i === BD.day));
    b.innerHTML = "<span></span><small></small>";
    b.querySelector("span").textContent = t("day.n", { n: i + 1 });
    b.querySelector("small").textContent = tn("bd.exN", d.exercises.length);
    if (!d.exercises.length) b.classList.add("empty");
    b.addEventListener("click", () => { BD.day = i; renderBuilder(); });
    tabs.appendChild(b);
  });
  if (days.length < MAX_DAYS) {
    const add = document.createElement("button"); add.type = "button"; add.className = "bd-daytab add"; add.id = "bdAddDay";
    add.innerHTML = '<span aria-hidden="true">+</span><small></small>';
    add.querySelector("small").textContent = t("bd.addDay");
    add.addEventListener("click", () => { days.push(blankDay(days.length + 1)); BD.day = days.length - 1; renderBuilder(); });
    tabs.appendChild(add);
  }
  $("bdDaysNote").textContent = tn(showWeeks() ? "bd.daysNoteWeek" : "bd.daysNote", days.length, { max: MAX_DAYS, w: BD.week + 1 });
  renderBuilderDay();
  renderMuscleCheck();
}

function renderBuilderDay() {
  const days = curDays(), d = days[BD.day];
  if (document.activeElement !== $("bdDayName")) $("bdDayName").value = d.name;
  $("bdDayUp").disabled = BD.day === 0; $("bdDayDown").disabled = BD.day === days.length - 1;
  $("bdDelDay").hidden = days.length < 2;
  const ul = $("bdExList"); ul.innerHTML = "";
  if (!d.exercises.length) { const li = document.createElement("li"); li.className = "none"; li.textContent = t("bd.noEx"); ul.appendChild(li); }
  d.exercises.forEach((x, i) => {
    const li = document.createElement("li"); li.className = "bd-ex"; li.dataset.id = x.id;
    const m = musclesOf(x);
    li.innerHTML =
      '<div class="bd-ex-top"><span class="num"></span><span class="bd-ex-name"><b></b><small></small></span>' +
      '<span class="bd-ex-acts"><button type="button" class="iconbtn up">↑</button><button type="button" class="iconbtn down">↓</button><button type="button" class="iconbtn del">×</button></span></div>' +
      '<div class="bd-sets-l"></div>' +
      '<div class="bd-sets"></div>' +
      '<div class="bd-ex-more"><div class="fld bd-rpe"><label></label><input class="rpe" inputmode="numeric" autocomplete="off" placeholder="–"></div></div>';
    li.querySelector(".num").textContent = i + 1;
    li.querySelector("b").textContent = x.name;
    const meta = [m.primary ? muscleName(m.primary) : "", x.timed ? t("lib.timed") : "", x.perSide ? t("lib.perSide") : ""].filter(Boolean).join(" · ");
    li.querySelector("small").textContent = meta;
    const up = li.querySelector(".up"), down = li.querySelector(".down"), del = li.querySelector(".del");
    up.setAttribute("aria-label", t("bd.moveUp", { name: x.name })); down.setAttribute("aria-label", t("bd.moveDown", { name: x.name })); del.setAttribute("aria-label", t("bd.remove", { name: x.name }));
    up.disabled = i === 0; down.disabled = i === d.exercises.length - 1;
    up.addEventListener("click", () => { moveItem(d.exercises, i, -1); renderBuilder(); });
    down.addEventListener("click", () => { moveItem(d.exercises, i, 1); renderBuilder(); });
    del.addEventListener("click", () => { d.exercises.splice(i, 1); renderBuilder(); });
    if (isMine(x)) {
      const ed = document.createElement("button"); ed.type = "button"; ed.className = "linkbtn bd-edit"; ed.textContent = t("bd.editExercise");
      ed.addEventListener("click", () => editMyExercise(x.ref, e => { applyExerciseEdit(e); renderBuilder(); }));
      li.querySelector(".bd-ex-more").appendChild(ed);
    }
    li.querySelector(".bd-sets-l").textContent = t(x.timed ? "bd.secondsPerSet" : x.perSide ? "bd.repsPerSetSide" : "bd.repsPerSet");
    renderSetBoxes(li.querySelector(".bd-sets"), x);
    li.querySelector(".bd-rpe label").textContent = t("bd.rpeOptional");
    const rpe = li.querySelector(".rpe"); rpe.value = x.rpe || "";
    rpe.addEventListener("input", () => { x.rpe = normDigits(rpe.value).replace(/[^0-9./–\- ]/g, "").slice(0, 12); });
    ul.appendChild(li);
  });
  $("bdAdd").disabled = d.exercises.length >= MAX_EX;
}

/* One box per set; + adds a set (copying the last one), − removes the last set */
function renderSetBoxes(box, x) {
  box.innerHTML = "";
  x.setReps.forEach((r, s) => {
    const w = document.createElement("label"); w.className = "bd-set";
    w.innerHTML = '<small></small><input inputmode="numeric" autocomplete="off">';
    w.querySelector("small").textContent = t("sets.n", { n: s + 1 });
    const inp = w.querySelector("input"); inp.value = r; inp.placeholder = x.timed ? "45" : "10";
    inp.setAttribute("aria-label", t("bd.setAria", { n: s + 1, name: x.name }));
    inp.addEventListener("input", () => { x.setReps[s] = inp.value; inp.classList.remove("bad"); });
    inp.addEventListener("change", () => { const c = cleanReps(inp.value); if (c) { x.setReps[s] = c; inp.value = c; } });
    box.appendChild(w);
  });
  const ctl = document.createElement("div"); ctl.className = "bd-setctl";
  if (x.setReps.length > 1) {
    const minus = document.createElement("button"); minus.type = "button"; minus.className = "setbtn minus"; minus.textContent = "−";
    minus.setAttribute("aria-label", t("bd.fewerSets"));
    minus.addEventListener("click", () => { x.setReps.pop(); renderSetBoxes(box, x); renderMuscleCheck(); });
    ctl.appendChild(minus);
  }
  if (x.setReps.length < MAX_SETS) {
    const plus = document.createElement("button"); plus.type = "button"; plus.className = "setbtn plus"; plus.textContent = "+";
    plus.setAttribute("aria-label", t("bd.moreSets"));
    plus.addEventListener("click", () => {
      x.setReps.push(x.setReps[x.setReps.length - 1] || "");
      renderSetBoxes(box, x); renderMuscleCheck();
    });
    ctl.appendChild(plus);
  }
  box.appendChild(ctl);
}
function moveItem(arr, i, dir) { const j = i + dir; if (j < 0 || j >= arr.length) return; const [x] = arr.splice(i, 1); arr.splice(j, 0, x); }

/* An edited "my exercise" updates every place this draft uses it */
function applyExerciseEdit(e) {
  BD.draft.weeks.forEach(wk => wk.days.forEach(d => d.exercises.forEach(x => {
    if (x.ref !== e.id) return;
    x.name = e.name; x.primary = e.primary || ""; x.secondary = e.secondary || [];
    x.timed = !!e.timed; x.perSide = !!e.perSide;
  })));
}

/* Weekly hard sets per muscle: each set counts fully for the main muscle and half for the others */
function renderMuscleCheck() {
  const tally = {};
  (typeof LIBRARY !== "undefined" ? LIBRARY.muscles : []).forEach(m => { tally[m] = 0; });
  $("bdMusclesTitle").textContent = showWeeks() ? t("bd.musclesTitleW", { n: BD.week + 1 }) : t("bd.musclesTitle");
  curDays().forEach(d => d.exercises.forEach(x => {
    const n = x.setReps.length, m = musclesOf(x);
    if (m.primary) tally[m.primary] = (tally[m.primary] || 0) + n;
    m.secondary.forEach(s => { tally[s] = (tally[s] || 0) + n / 2; });
  }));
  const box = $("bdMuscles"); box.innerHTML = "";
  Object.entries(tally).forEach(([m, v]) => {
    const row = document.createElement("div"); row.className = "bd-mrow" + (v === 0 ? " zero" : v < 6 ? " low" : v > 20 ? " high" : " ok");
    row.innerHTML = '<span class="mn"></span><span class="bar"><i></i></span><span class="mv"></span>';
    row.querySelector(".mn").textContent = muscleName(m);
    row.querySelector("i").style.width = Math.min(100, v / 20 * 100) + "%";
    row.querySelector(".mv").textContent = (Math.round(v * 2) / 2).toString();
    box.appendChild(row);
  });
}

/* ---------- edits ---------- */
$("bdName").addEventListener("input", e => { BD.draft.name = e.target.value.slice(0, 40); $("bdName").classList.remove("bad"); });
$("bdDayName").addEventListener("input", e => { curDays()[BD.day].name = e.target.value.slice(0, 30); });
$("bdDelWeek").addEventListener("click", () => {
  const W = BD.draft.weeks; if (W.length < 2) return;
  // Logs are kept by week number, so removing a middle week of a saved program would move every later week's
  // logged weights onto a different week's plan (and on trainees' phones after they update)
  if (BD.editingId && BD.week !== W.length - 1) { alert(t("bd.delWeekLast", { n: W.length })); return; }
  if (!confirm(t("bd.removeWeekConfirm", { n: BD.week + 1 }))) return;
  W.splice(BD.week, 1); BD.week = Math.max(0, BD.week - 1); BD.day = 0; renderBuilder();
});
$("bdDelDay").addEventListener("click", () => {
  const days = curDays(); if (days.length < 2) return;
  const d = days[BD.day];
  if (d.exercises.length && !confirm(t("bd.removeDayConfirm", { name: d.name }))) return;
  days.splice(BD.day, 1); BD.day = Math.max(0, BD.day - 1); renderBuilder();
});
$("bdDayUp").addEventListener("click", () => { moveItem(curDays(), BD.day, -1); BD.day--; renderBuilder(); });
$("bdDayDown").addEventListener("click", () => { moveItem(curDays(), BD.day, 1); BD.day++; renderBuilder(); });
$("bdAdd").addEventListener("click", () => {
  const d = curDays()[BD.day];
  openPicker({ onPick: e => { d.exercises.push(exFromLibrary(e)); renderBuilder(); requestAnimationFrame(() => { const l = $("bdExList").lastElementChild; if (l && l.scrollIntoView) l.scrollIntoView({ block: "center" }); }); } });
});
$("bdClose").addEventListener("click", () => { if (builderDirty() && !confirm(t("bd.discardConfirm"))) return; closeBuilder(); });

/* ---------- save ---------- */
function builderError(key, vars, dayIndex, selector, weekIndex) {
  showMsg("bdMsg", t(key, vars), true);
  if (weekIndex !== undefined && weekIndex !== BD.week) { BD.week = weekIndex; BD.day = dayIndex || 0; renderBuilder(); }
  if (dayIndex !== undefined && dayIndex !== BD.day) { BD.day = dayIndex; renderBuilder(); }
  if (dayIndex !== undefined && !selector) $("bdDayTabs").scrollIntoView({ block: "start" });
  if (selector) { const el = document.querySelector(selector); if (el) { el.classList.add("bad"); el.focus({ preventScroll: true }); el.scrollIntoView({ block: "center" }); } }
  return false;
}
function validateDraft() {
  const D = BD.draft;
  if (!D.name.trim()) return builderError("bd.errName", null, undefined, "#bdName");
  const many = D.weeks.length > 1;
  for (let w = 0; w < D.weeks.length; w++) {
    const days = D.weeks[w].days;
    for (let i = 0; i < days.length; i++) {
      const d = days[i];
      if (!d.exercises.length) return builderError(many ? "bd.errEmptyDayW" : "bd.errEmptyDay", { n: i + 1, w: w + 1 }, i, undefined, w);
      for (const x of d.exercises) {
        for (let s = 0; s < x.setReps.length; s++) {
          const r = cleanReps(x.setReps[s]);
          if (!r) return builderError(x.timed ? "bd.errSeconds" : "bd.errReps", { name: x.name, n: i + 1, set: s + 1 }, i,
            '.bd-ex[data-id="' + x.id + '"] .bd-set:nth-child(' + (s + 1) + ') input', w);
          x.setReps[s] = r;
        }
      }
    }
  }
  return true;
}
$("bdSave").addEventListener("click", () => {
  if (!validateDraft()) return;
  const D = BD.draft;
  const id = BD.editingId || "my-" + rid();
  const dayFile = days => days.map((d, i) => ({ id: d.id, name: d.name.trim() || t("day.n", { n: i + 1 }),
      exercises: d.exercises.map(x => {
        const m = musclesOf(x), same = x.setReps.every(r => r === x.setReps[0]);
        const e = { id: x.id, name: x.name, sets: x.setReps.length, reps: same ? x.setReps[0] : x.setReps.join(" / ") };
        if (!same) e.setReps = x.setReps.slice();
        if (x.ref) e.ref = x.ref;
        if (x.rpe) e.rpe = x.rpe;
        if (x.cue) e.cue = x.cue;
        if (x.timed) e.timed = true;
        if (x.perSide) e.perSide = true;
        if (m.primary) e.primary = m.primary;
        if (m.secondary.length) e.secondary = m.secondary;
        return e;
      }) }));
  // One week repeats with no end; two or more weeks are a fixed plan that ends with "Program complete"
  const nw = D.weeks.length, first = dayFile(D.weeks[0].days);
  const raw = nw > 1
    ? { format: 2, id, name: D.name.trim(), weeks: nw, weekly: true, builder: true,
        description: tn("prog.nWeeks", nw) + " · " + tn("prog.daysWeek", D.weeks[0].days.length),
        days: first, phases: D.weeks.map((wk, i) => ({ name: "", weeks: [i + 1, i + 1], days: i ? dayFile(wk.days) : first })) }
    : { format: 2, id, name: D.name.trim(), weeks: 1, repeat: true, builder: true,
        description: tn("prog.daysWeek", D.weeks[0].days.length), days: first };
  let p;
  try { p = normalizeProgram(raw, false); } catch (err) { showMsg("bdMsg", err.message, true); return; }
  store(KEY.custom, load(KEY.custom, []).filter(r => slug(r.id || r.name) !== id).concat([raw]));
  PROGRAMS = PROGRAMS.filter(q => q.id !== id).concat([p]);
  const wasCurrent = P && P.id === id;
  delete LOGS[id];
  closeBuilder();
  if (!BD.editingId || wasCurrent) setProgram(id);
  appMode = "home"; renderAll(); window.scrollTo({ top: 0 });
  showMsg("progMsg", t(BD.editingId ? "bd.savedEdit" : "bd.saved", { name: p.name }));
});
