/* Lift Ledger: program builder.
   A program is one week of training days, repeated for a number of weeks.
   Programs are saved as program files (the same format as imports) under KEY.custom.
   Every day and exercise keeps a permanent id, so editing a program never moves logged weights. */
"use strict";

const BD = { draft: null, day: 0, editingId: null };
const rid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
const MAX_DAYS = 7, MAX_WEEKS = 12, MAX_EX = 15;

function blankDay(n) { return { id: "d" + rid(), name: t("day.n", { n }), exercises: [] }; }
function exFromLibrary(e) {
  return { id: "x" + rid(), ref: e.id, name: e.name, sets: 3, reps: e.reps || "8–12", rpe: "", cue: e.cue || "",
           timed: !!e.timed, perSide: !!e.perSide, primary: e.primary, secondary: (e.secondary || []).slice() };
}
/* Muscles for an exercise: from the library when it's there, otherwise from what the program saved */
function musclesOf(x) {
  const e = x.ref && typeof exById === "function" ? exById(x.ref) : null;
  return { primary: (e && e.primary) || x.primary || "", secondary: (e && e.secondary) || x.secondary || [] };
}

/* ---------- open / close ---------- */
function openBuilder(programId) {
  BD.editingId = programId || null; BD.day = 0;
  if (programId) {
    const raw = load(KEY.custom, []).find(r => slug(r.id || r.name) === programId);
    if (!raw) return;
    BD.draft = {
      name: raw.name || "", weeks: Math.min(MAX_WEEKS, Math.max(1, +raw.weeks || 8)),
      days: (raw.days || []).map((d, di) => ({ id: sid(d.id) || "d" + (di + 1), name: d.name || t("day.n", { n: di + 1 }),
        exercises: (d.exercises || []).map((e, ei) => Object.assign({ rpe: "", cue: "", secondary: [] }, e, { id: sid(e.id) || (sid(d.id) || "d" + (di + 1)) + "e" + (ei + 1) })) }))
    };
  } else {
    BD.draft = { name: "", weeks: 8, days: [blankDay(1), blankDay(2), blankDay(3)] };
  }
  $("bdTitle").textContent = t(programId ? "bd.editTitle" : "bd.newTitle");
  $("bdStart").hidden = !!programId;
  showMsg("bdMsg", "");
  renderBuilder();
  $("builder").hidden = false; $("builder").scrollTop = 0;
  document.body.classList.add("sheet-open");
}
function closeBuilder() { $("builder").hidden = true; if ($("picker").hidden) document.body.classList.remove("sheet-open"); }
function builderDirty() { return BD.draft && (BD.draft.name.trim() || BD.draft.days.some(d => d.exercises.length)); }

/* Start from a ready-made program: copy its first phase with fresh ids (it becomes a separate program) */
function copyPreset(p) {
  const ph = p.phases[0];
  BD.draft = {
    name: t("bd.copyName", { name: p.name }), weeks: p.weeks,
    days: ph.days.map((exs, di) => ({ id: "d" + rid(), name: p.dayNames[di],
      exercises: exs.map(e => Object.assign(exFromLibrary(exById(e.ref) || { id: e.ref, name: e.name, reps: e.reps, cue: e.cue }),
        { name: e.name, sets: e.sets, reps: e.reps, rpe: e.rpe || "", cue: e.cue || "" })) }))
  };
  BD.day = 0; renderBuilder();
}

/* ---------- render ---------- */
function renderBuilder() {
  const D = BD.draft;
  // start options (new programs only)
  const st = $("bdStartChips"); st.innerHTML = "";
  st.appendChild(chip(t("bd.blank"), false, () => { if (builderDirty() && !confirm(t("bd.replaceConfirm"))) return; BD.draft = { name: "", weeks: 8, days: [blankDay(1), blankDay(2), blankDay(3)] }; BD.day = 0; renderBuilder(); }));
  PROGRAMS.filter(p => p.builtin).forEach(p => st.appendChild(chip(p.name, false, () => { if (builderDirty() && !confirm(t("bd.replaceConfirm"))) return; copyPreset(p); })));
  // basics
  if (document.activeElement !== $("bdName")) $("bdName").value = D.name;
  $("bdWeeks").textContent = D.weeks;
  $("bdDays").textContent = D.days.length;
  $("bdWeeksL").textContent = tn("bd.weeksN", D.weeks);
  $("bdDaysL").textContent = tn("bd.daysN", D.days.length);
  // day tabs
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
  renderBuilderDay();
  renderMuscleCheck();
}

function renderBuilderDay() {
  const d = BD.draft.days[BD.day];
  if (document.activeElement !== $("bdDayName")) $("bdDayName").value = d.name;
  $("bdDayUp").disabled = BD.day === 0; $("bdDayDown").disabled = BD.day === BD.draft.days.length - 1;
  const ul = $("bdExList"); ul.innerHTML = "";
  if (!d.exercises.length) { const li = document.createElement("li"); li.className = "none"; li.textContent = t("bd.noEx"); ul.appendChild(li); }
  d.exercises.forEach((x, i) => {
    const li = document.createElement("li"); li.className = "bd-ex"; li.dataset.id = x.id;
    const m = musclesOf(x);
    li.innerHTML =
      '<div class="bd-ex-top"><span class="num"></span><span class="bd-ex-name"><b></b><small></small></span>' +
      '<span class="bd-ex-acts"><button type="button" class="iconbtn up"></button><button type="button" class="iconbtn down"></button><button type="button" class="iconbtn del"></button></span></div>' +
      '<div class="bd-ex-fields">' +
        '<div class="fld"><label></label><div class="stepper"><button type="button" class="dec">−</button><input class="sets" inputmode="numeric"><button type="button" class="inc">+</button></div></div>' +
        '<div class="fld"><label class="repsL"></label><input class="reps" inputmode="numeric" autocomplete="off" placeholder="8–12"></div>' +
        '<div class="fld"><label class="rpeL"></label><input class="rpe" inputmode="numeric" autocomplete="off"></div>' +
      '</div>';
    li.querySelector(".num").textContent = i + 1;
    li.querySelector("b").textContent = x.name;
    li.querySelector("small").textContent = (m.primary ? muscleName(m.primary) : "") + (x.timed ? " · " + t("lib.timed") : "") + (x.perSide ? " · " + t("lib.perSide") : "");
    const up = li.querySelector(".up"), down = li.querySelector(".down"), del = li.querySelector(".del");
    up.textContent = "↑"; down.textContent = "↓"; del.textContent = "×";
    up.setAttribute("aria-label", t("bd.moveUp", { name: x.name })); down.setAttribute("aria-label", t("bd.moveDown", { name: x.name })); del.setAttribute("aria-label", t("bd.remove", { name: x.name }));
    up.disabled = i === 0; down.disabled = i === d.exercises.length - 1;
    up.addEventListener("click", () => { moveItem(d.exercises, i, -1); renderBuilder(); });
    down.addEventListener("click", () => { moveItem(d.exercises, i, 1); renderBuilder(); });
    del.addEventListener("click", () => { d.exercises.splice(i, 1); renderBuilder(); });
    const labels = li.querySelectorAll(".fld label");
    labels[0].textContent = t("bd.sets");
    labels[1].textContent = t(x.timed ? "bd.seconds" : x.perSide ? "bd.repsSide" : "bd.reps");
    labels[2].textContent = t("bd.rpe");
    const sets = li.querySelector(".sets"), reps = li.querySelector(".reps"), rpe = li.querySelector(".rpe");
    sets.value = x.sets; reps.value = x.reps; rpe.value = x.rpe || ""; rpe.placeholder = "–"; rpe.setAttribute("aria-label", t("bd.rpe") + " (" + t("bd.optional") + ")");
    const setSets = v => { x.sets = Math.min(10, Math.max(1, v)); sets.value = x.sets; sets.classList.remove("bad"); renderMuscleCheck(); };
    li.querySelector(".dec").addEventListener("click", () => setSets((+x.sets || 1) - 1));
    li.querySelector(".inc").addEventListener("click", () => setSets((+x.sets || 0) + 1));
    li.querySelector(".dec").setAttribute("aria-label", t("bd.fewerSets")); li.querySelector(".inc").setAttribute("aria-label", t("bd.moreSets"));
    sets.addEventListener("input", () => { const v = cleanNumber(sets.value, 2).replace(".", ""); sets.value = v; x.sets = v === "" ? "" : +v; sets.classList.remove("bad"); renderMuscleCheck(); });
    reps.addEventListener("input", () => { x.reps = reps.value; reps.classList.remove("bad"); });
    reps.addEventListener("change", () => { const c = cleanReps(reps.value); if (c) { x.reps = c; reps.value = c; } });
    rpe.addEventListener("input", () => { x.rpe = normDigits(rpe.value).replace(/[^0-9./–\- ]/g, "").slice(0, 12); });
    ul.appendChild(li);
  });
  $("bdAdd").disabled = d.exercises.length >= MAX_EX;
}
function moveItem(arr, i, dir) { const j = i + dir; if (j < 0 || j >= arr.length) return; const [x] = arr.splice(i, 1); arr.splice(j, 0, x); }

/* Weekly hard sets per muscle: each set counts fully for the main muscle and half for the others */
function renderMuscleCheck() {
  const tally = {};
  (typeof LIBRARY !== "undefined" ? LIBRARY.muscles : []).forEach(m => { tally[m] = 0; });
  BD.draft.days.forEach(d => d.exercises.forEach(x => {
    const n = +x.sets || 0, m = musclesOf(x);
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
$("bdWeeksDec").addEventListener("click", () => { BD.draft.weeks = Math.max(1, BD.draft.weeks - 1); renderBuilder(); });
$("bdWeeksInc").addEventListener("click", () => { BD.draft.weeks = Math.min(MAX_WEEKS, BD.draft.weeks + 1); renderBuilder(); });
$("bdDaysInc").addEventListener("click", () => {
  if (BD.draft.days.length >= MAX_DAYS) return;
  BD.draft.days.push(blankDay(BD.draft.days.length + 1)); BD.day = BD.draft.days.length - 1; renderBuilder();
});
$("bdDaysDec").addEventListener("click", () => {
  const days = BD.draft.days; if (days.length <= 1) return;
  const last = days[days.length - 1];
  if (last.exercises.length && !confirm(t("bd.removeDayConfirm", { name: last.name }))) return;
  days.pop(); renderBuilder();
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
      if (!(Number.isInteger(+x.sets) && +x.sets >= 1 && +x.sets <= 10)) return builderError("bd.errSets", { name: x.name, n: i + 1 }, i, '.bd-ex[data-id="' + x.id + '"] .sets');
      const r = cleanReps(x.reps);
      if (!r) return builderError(x.timed ? "bd.errSeconds" : "bd.errReps", { name: x.name, n: i + 1 }, i, '.bd-ex[data-id="' + x.id + '"] .reps');
      x.reps = r;
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
        const m = musclesOf(x), e = { id: x.id, name: x.name, sets: +x.sets, reps: x.reps };
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
