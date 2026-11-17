/* Lift Ledger: program builder.
   A program is one week of training days (1 to 7), repeated week after week.
   Each exercise is a list of sets; each set is one box holding its target reps (or seconds).
   Programs are saved as program files (the same format as imports) under KEY.custom.
   Every day and exercise keeps a permanent id, so editing a program never moves logged weights. */
"use strict";

const BD = { draft: null, day: 0, editingId: null };
const rid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
const MAX_DAYS = 7, MAX_EX = 15, MAX_SETS = 10, DEFAULT_WEEKS = 8;

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
function openBuilder(programId) {
  BD.editingId = programId || null; BD.day = 0;
  if (programId) {
    const raw = load(KEY.custom, []).find(r => slug(r.id || r.name) === programId);
    if (!raw) return;
    BD.draft = {
      name: raw.name || "", weeks: Math.min(12, Math.max(1, +raw.weeks || DEFAULT_WEEKS)),
      days: (raw.days || []).map((d, di) => {
        const dayId = sid(d.id) || "d" + (di + 1);
        return { id: dayId, name: d.name || t("day.n", { n: di + 1 }),
          exercises: (d.exercises || []).map((e, ei) => {
            const n = Math.max(1, Math.min(MAX_SETS, Math.floor(+e.sets) || 1));
            const setReps = Array.isArray(e.setReps) && e.setReps.length === n ? e.setReps.map(String) : Array(n).fill(String(e.reps || ""));
            return { id: sid(e.id) || dayId + "e" + (ei + 1), ref: e.ref || "", name: e.name, setReps, rpe: e.rpe || "", cue: e.cue || "",
                     timed: !!e.timed, perSide: !!e.perSide, primary: e.primary || "", secondary: e.secondary || [] };
          }) };
      })
    };
  } else {
    BD.draft = { name: "", weeks: DEFAULT_WEEKS, days: [blankDay(1)] };
  }
  $("bdTitle").textContent = t(programId ? "bd.editTitle" : "bd.newTitle");
  showMsg("bdMsg", "");
  renderBuilder();
  $("builder").hidden = false; $("builder").scrollTop = 0;
  document.body.classList.add("sheet-open");
}
function closeBuilder() { $("builder").hidden = true; if ($("picker").hidden) document.body.classList.remove("sheet-open"); }
function builderDirty() { return BD.draft && (BD.draft.name.trim() || BD.draft.days.some(d => d.exercises.length)); }

/* ---------- render ---------- */
function renderBuilder() {
  const D = BD.draft;
  if (document.activeElement !== $("bdName")) $("bdName").value = D.name;
  if (BD.day >= D.days.length) BD.day = D.days.length - 1;
  const tabs = $("bdDayTabs"); tabs.innerHTML = "";
  D.days.forEach((d, i) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "bd-daytab"; b.setAttribute("aria-pressed", String(i === BD.day));
    b.innerHTML = "<span></span><small></small>";
    b.querySelector("span").textContent = t("day.n", { n: i + 1 });
    b.querySelector("small").textContent = tn("bd.exN", d.exercises.length);
    if (!d.exercises.length) b.classList.add("empty");
    b.addEventListener("click", () => { BD.day = i; renderBuilder(); });
    tabs.appendChild(b);
  });
  if (D.days.length < MAX_DAYS) {
    const add = document.createElement("button"); add.type = "button"; add.className = "bd-daytab add"; add.id = "bdAddDay";
    add.innerHTML = '<span aria-hidden="true">+</span><small></small>';
    add.querySelector("small").textContent = t("bd.addDay");
    add.addEventListener("click", () => { D.days.push(blankDay(D.days.length + 1)); BD.day = D.days.length - 1; renderBuilder(); });
    tabs.appendChild(add);
  }
  $("bdDaysNote").textContent = tn("bd.daysNote", D.days.length, { max: MAX_DAYS });
  renderBuilderDay();
  renderMuscleCheck();
}

function renderBuilderDay() {
  const D = BD.draft, d = D.days[BD.day];
  if (document.activeElement !== $("bdDayName")) $("bdDayName").value = d.name;
  $("bdDayUp").disabled = BD.day === 0; $("bdDayDown").disabled = BD.day === D.days.length - 1;
  $("bdDelDay").hidden = D.days.length < 2;
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
  BD.draft.days.forEach(d => d.exercises.forEach(x => {
    if (x.ref !== e.id) return;
    x.name = e.name; x.primary = e.primary || ""; x.secondary = e.secondary || [];
    x.timed = !!e.timed; x.perSide = !!e.perSide;
  }));
}

/* Weekly hard sets per muscle: each set counts fully for the main muscle and half for the others */
function renderMuscleCheck() {
  const tally = {};
  (typeof LIBRARY !== "undefined" ? LIBRARY.muscles : []).forEach(m => { tally[m] = 0; });
  BD.draft.days.forEach(d => d.exercises.forEach(x => {
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
$("bdDayName").addEventListener("input", e => { BD.draft.days[BD.day].name = e.target.value.slice(0, 30); });
$("bdDelDay").addEventListener("click", () => {
  const days = BD.draft.days; if (days.length < 2) return;
  const d = days[BD.day];
  if (d.exercises.length && !confirm(t("bd.removeDayConfirm", { name: d.name }))) return;
  days.splice(BD.day, 1); BD.day = Math.max(0, BD.day - 1); renderBuilder();
});
$("bdDayUp").addEventListener("click", () => { moveItem(BD.draft.days, BD.day, -1); BD.day--; renderBuilder(); });
$("bdDayDown").addEventListener("click", () => { moveItem(BD.draft.days, BD.day, 1); BD.day++; renderBuilder(); });
$("bdAdd").addEventListener("click", () => {
  const d = BD.draft.days[BD.day];
  openPicker({ onPick: e => { d.exercises.push(exFromLibrary(e)); renderBuilder(); requestAnimationFrame(() => { const l = $("bdExList").lastElementChild; if (l && l.scrollIntoView) l.scrollIntoView({ block: "center" }); }); } });
});
$("bdClose").addEventListener("click", () => { if (builderDirty() && !confirm(t("bd.discardConfirm"))) return; closeBuilder(); });

/* ---------- save ---------- */
function builderError(key, vars, dayIndex, selector) {
  showMsg("bdMsg", t(key, vars), true);
  if (dayIndex !== undefined && dayIndex !== BD.day) { BD.day = dayIndex; renderBuilder(); }
  if (dayIndex !== undefined && !selector) $("bdDayTabs").scrollIntoView({ block: "start" });
  if (selector) { const el = document.querySelector(selector); if (el) { el.classList.add("bad"); el.focus({ preventScroll: true }); el.scrollIntoView({ block: "center" }); } }
  return false;
}
function validateDraft() {
  const D = BD.draft;
  if (!D.name.trim()) return builderError("bd.errName", null, undefined, "#bdName");
  for (let i = 0; i < D.days.length; i++) {
    const d = D.days[i];
    if (!d.exercises.length) return builderError("bd.errEmptyDay", { n: i + 1 }, i);
    for (const x of d.exercises) {
      for (let s = 0; s < x.setReps.length; s++) {
        const r = cleanReps(x.setReps[s]);
        if (!r) return builderError(x.timed ? "bd.errSeconds" : "bd.errReps", { name: x.name, n: i + 1, set: s + 1 }, i,
          '.bd-ex[data-id="' + x.id + '"] .bd-set:nth-child(' + (s + 1) + ') input');
        x.setReps[s] = r;
      }
    }
  }
  return true;
}
$("bdSave").addEventListener("click", () => {
  if (!validateDraft()) return;
  const D = BD.draft;
  const id = BD.editingId || "my-" + rid();
  const raw = {
    format: 2, id, name: D.name.trim(), weeks: D.weeks, builder: true,
    description: tn("prog.daysWeek", D.days.length),
    days: D.days.map((d, i) => ({ id: d.id, name: d.name.trim() || t("day.n", { n: i + 1 }),
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
      }) }))
  };
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
