/* Lift Ledger: exercise library and picker.
   The built-in library is data/exercises.json; people's own exercises are saved under PREFIX + "exercises-custom".
   openPicker({ muscle, onPick }) shows a searchable list; the program builder reuses it. */
"use strict";

const LIB_KEY = PREFIX + "exercises-custom";
let LIBRARY = { muscles: [], equipment: [], exercises: [] };
let LIB_READY = false;
let CUSTOM_EX = load(LIB_KEY, []);
if (!Array.isArray(CUSTOM_EX)) CUSTOM_EX = [];

const allExercises = () => CUSTOM_EX.concat(LIBRARY.exercises);
const exById = id => allExercises().find(e => e.id === id);
const muscleName = m => t("muscle." + m);
const equipName = q => t("equip." + q);

async function loadLibrary() {
  try {
    const d = await fetch("data/exercises.json").then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
    if (d && Array.isArray(d.exercises)) {
      // Keep the English name and tip; in another language show the translation and search both
      d.exercises.forEach(e => {
        e.nameEn = e.name; e.cueEn = e.cue;
        if (LANG !== "en") {
          if (e["name_" + LANG]) e.name = e["name_" + LANG];
          if (e["cue_" + LANG]) e.cue = e["cue_" + LANG];
          e.terms = [e.terms, e["terms_" + LANG], e.nameEn].filter(Boolean).join(" ");
        }
      });
      LIBRARY = d; LIB_READY = true;
    }
  } catch (e) { LIB_READY = false; }
}

/* Search: case-insensitive, ignores accents and punctuation; every word typed must match somewhere. */
function normText(s) {
  return normDigits(String(s || "")).toLowerCase().normalize("NFKC")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")              // Arabic diacritics and tatweel
    .replace(/[\u0622\u0623\u0625\u0671]/g, "\u0627")        // آ أ إ ٱ → ا
    .replace(/\u0629/g, "\u0647").replace(/\u0649/g, "\u064A")  // ة → ه, ى → ي
    .replace(/\u0624/g, "\u0648").replace(/\u0626/g, "\u064A")  // ؤ → و, ئ → ي
    .replace(/\u06A9/g, "\u0643").replace(/\u06CC/g, "\u064A")  // Persian ک ی typed on some keyboards
    .replace(/[^a-z0-9\u0621-\u064A]+/g, " ").trim();
}
function searchText(e) {
  const muscles = [e.primary].concat(e.secondary || []).filter(Boolean).map(muscleName).join(" ");
  return normText([e.name, e.terms || "", muscles, e.equipment ? equipName(e.equipment) : "", e.id.replace(/-/g, " ")].join(" "));
}
function searchExercises(query, muscle, equip, mineOnly) {
  const words = normText(query).split(" ").filter(Boolean);
  const out = [];
  allExercises().forEach(e => {
    if (mineOnly && !e.custom) return;
    if (muscle && e.primary !== muscle && !(e.secondary || []).includes(muscle)) return;
    if (equip && e.equipment !== equip) return;
    const hay = searchText(e), name = normText(e.name);
    if (words.some(w => !hay.includes(w))) return;
    let score = (e.primary === muscle ? 0 : 50) + (e.custom ? -5 : 0);
    if (words.length) score += name.startsWith(words[0]) ? 0 : words.every(w => name.includes(w)) ? 10 : 30;
    out.push([score, e]);
  });
  out.sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name));
  return out.map(x => x[1]);
}
function exMeta(e) {
  const bits = [];
  if (e.primary) bits.push(muscleName(e.primary));
  if (e.equipment) bits.push(equipName(e.equipment));
  if (e.timed) bits.push(t("lib.timed"));
  if (e.perSide) bits.push(t("lib.perSide"));
  return bits.join(" · ");
}

/* ---------- picker ---------- */
const PK = { muscle: "", equip: "", mine: false, onPick: null, editing: null };

function openPicker(opts) {
  opts = opts || {};
  PK.afterSave = null;
  PK.muscle = opts.muscle || ""; PK.equip = ""; PK.mine = false; PK.onPick = opts.onPick || null; PK.editing = null;
  $("pkTitle").textContent = t(PK.onPick ? "lib.pickTitle" : "lib.title");
  $("pkSearch").value = "";
  $("pkForm").hidden = true; $("pkBrowse").hidden = false;
  renderPickerFilters(); renderPickerList();
  $("picker").hidden = false;
  document.body.classList.add("sheet-open");
  revealActiveChip();
}
function closePicker() { $("picker").hidden = true; if ($("builder").hidden) document.body.classList.remove("sheet-open"); PK.onPick = null; }

function chip(label, on, onClick) {
  const b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.textContent = label;
  b.setAttribute("aria-pressed", String(!!on)); b.addEventListener("click", onClick); return b;
}
function renderPickerFilters() {
  const box = $("pkMuscles"); box.innerHTML = "";
  box.appendChild(chip(t("lib.all"), !PK.muscle && !PK.mine, () => { PK.muscle = ""; PK.mine = false; renderPickerFilters(); renderPickerList(); }));
  if (CUSTOM_EX.length) box.appendChild(chip(t("lib.mine"), PK.mine, () => { PK.mine = !PK.mine; renderPickerFilters(); renderPickerList(); }));
  LIBRARY.muscles.forEach(m => box.appendChild(chip(muscleName(m), PK.muscle === m, () => { PK.muscle = PK.muscle === m ? "" : m; renderPickerFilters(); renderPickerList(); })));
  const sel = $("pkEquip"); sel.innerHTML = "";
  const o0 = document.createElement("option"); o0.value = ""; o0.textContent = t("lib.allEquip"); sel.appendChild(o0);
  LIBRARY.equipment.forEach(q => { const o = document.createElement("option"); o.value = q; o.textContent = equipName(q); sel.appendChild(o); });
  sel.value = PK.equip;
  revealActiveChip();
}
/* Keep the selected muscle in view in the sideways-scrolling row */
function revealActiveChip() {
  const box = $("pkMuscles"), a = box.querySelector('[aria-pressed="true"]');
  if (!a || $("picker").hidden) return;
  const bx = box.getBoundingClientRect(), ax = a.getBoundingClientRect();
  box.scrollLeft += (ax.left + ax.width / 2) - (bx.left + bx.width / 2);
}
function renderPickerList() {
  const ul = $("pkList"); ul.innerHTML = "";
  if (!LIB_READY && !CUSTOM_EX.length) { $("pkCount").textContent = t("lib.loadFail"); return; }
  const res = searchExercises($("pkSearch").value, PK.muscle, PK.equip, PK.mine);
  $("pkCount").textContent = tn("lib.count", res.length);
  res.slice(0, 200).forEach(e => {
    const li = document.createElement("li");
    const b = document.createElement("button"); b.type = "button"; b.className = "pk-item";
    b.innerHTML = '<span class="pk-name"></span><span class="pk-meta"></span>';
    b.querySelector(".pk-name").textContent = e.name;
    b.querySelector(".pk-meta").textContent = exMeta(e);
    if (LANG !== "en" && e.nameEn && e.nameEn !== e.name) {      // the English gym name, underneath
      const en = document.createElement("span"); en.className = "pk-en"; en.lang = "en"; en.dir = "ltr"; en.textContent = e.nameEn;
      b.querySelector(".pk-name").after(en);
    }
    if (e.custom) { const tg = document.createElement("span"); tg.className = "tag"; tg.textContent = t("lib.mineTag"); b.querySelector(".pk-name").append(" ", tg); }
    b.addEventListener("click", () => {
      if (PK.onPick) { const cb = PK.onPick; closePicker(); cb(e); }
      else if (e.custom) openForm(e);
    });
    li.appendChild(b);
    if (e.custom && PK.onPick) {
      const ed = document.createElement("button"); ed.type = "button"; ed.className = "linkbtn pk-edit"; ed.textContent = t("lib.edit");
      ed.addEventListener("click", () => openForm(e)); li.appendChild(ed);
    }
    ul.appendChild(li);
  });
  if (!res.length) { const li = document.createElement("li"); li.className = "none"; li.textContent = t("lib.noResults"); ul.appendChild(li); }
}

/* Open just the edit form for one of my exercises (used by the builder). onSaved gets the updated exercise. */
function editMyExercise(id, onSaved) {
  const ex = CUSTOM_EX.find(x => x.id === id); if (!ex) return false;
  PK.onPick = null; PK.afterSave = onSaved;
  $("pkTitle").textContent = t("lib.editTitle");
  $("picker").hidden = false; document.body.classList.add("sheet-open");
  openForm(ex);
  return true;
}

/* ---------- my exercises ---------- */
function openForm(ex) {
  PK.editing = ex || null;
  $("pkBrowse").hidden = true; $("pkForm").hidden = false;
  $("pkFormTitle").textContent = t(ex ? "lib.editTitle" : "lib.addTitle");
  $("fxName").value = ex ? ex.name : ($("pkSearch").value || "");
  const pm = $("fxPrimary"); pm.innerHTML = "";
  const o0 = document.createElement("option"); o0.value = ""; o0.textContent = t("lib.notSet"); pm.appendChild(o0);
  LIBRARY.muscles.forEach(m => { const o = document.createElement("option"); o.value = m; o.textContent = muscleName(m); pm.appendChild(o); });
  pm.value = ex ? ex.primary : (PK.muscle || "");
  const sec = new Set(ex ? ex.secondary || [] : []);
  const sb = $("fxSecondary"); sb.innerHTML = "";
  LIBRARY.muscles.forEach(m => {
    const c = chip(muscleName(m), sec.has(m), () => c.setAttribute("aria-pressed", String(c.getAttribute("aria-pressed") !== "true")));
    c.dataset.m = m; sb.appendChild(c);
  });
  syncSecondary();
  const eq = $("fxEquip"); eq.innerHTML = "";
  const e0 = document.createElement("option"); e0.value = ""; e0.textContent = t("lib.notSet"); eq.appendChild(e0);
  LIBRARY.equipment.forEach(q => { const o = document.createElement("option"); o.value = q; o.textContent = equipName(q); eq.appendChild(o); });
  eq.value = ex ? (ex.equipment || "") : (PK.equip || "");
  $("fxTimed").checked = !!(ex && ex.timed);
  $("fxSide").checked = !!(ex && ex.perSide);
  $("fxBw").checked = !!(ex && ex.bodyweight);
  $("fxReps").value = ex ? ex.reps : "";
  syncFormReps();
  $("fxDelete").hidden = !ex;
  showMsg("fxMsg", "");
}
/* The main muscle isn't offered again as an "other" muscle */
function syncSecondary() {
  const pm = $("fxPrimary").value;
  $("fxSecondary").querySelectorAll(".chip").forEach(c => { c.hidden = c.dataset.m === pm; if (c.hidden) c.setAttribute("aria-pressed", "false"); });
}
function syncFormReps() { $("fxRepsL").textContent = t($("fxTimed").checked ? "lib.seconds" : "lib.reps"); }
function closeForm() { if (PK.afterSave) { PK.afterSave = null; closePicker(); return; } $("pkForm").hidden = true; $("pkBrowse").hidden = false; PK.editing = null; renderPickerFilters(); renderPickerList(); }
function saveCustom() { store(LIB_KEY, CUSTOM_EX); }

$("fxTimed").addEventListener("change", syncFormReps);
$("fxPrimary").addEventListener("change", syncSecondary);
$("fxCancel").addEventListener("click", closeForm);
$("fxSave").addEventListener("click", () => {
  const name = $("fxName").value.trim().slice(0, 60);
  const primary = $("fxPrimary").value;
  const reps = cleanReps($("fxReps").value);
  if (!name) { showMsg("fxMsg", t("lib.errName"), true); $("fxName").focus(); return; }
  if (!reps) { showMsg("fxMsg", t($("fxTimed").checked ? "lib.errSeconds" : "lib.errReps"), true); $("fxReps").focus(); return; }
  const secondary = [...$("fxSecondary").querySelectorAll('.chip[aria-pressed="true"]')].map(c => c.dataset.m).filter(m => m !== primary);
  const ex = {
    id: PK.editing ? PK.editing.id : "my-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name, primary, secondary, equipment: $("fxEquip").value, kind: secondary.length ? "compound" : "isolation",
    timed: $("fxTimed").checked, perSide: $("fxSide").checked, bodyweight: $("fxBw").checked, reps, cue: "", custom: true
  };
  if (PK.editing) CUSTOM_EX = CUSTOM_EX.map(x => x.id === ex.id ? ex : x); else CUSTOM_EX.unshift(ex);
  saveCustom();
  if (PK.afterSave) { const cb = PK.afterSave; PK.afterSave = null; closePicker(); cb(ex); return; }
  if (PK.onPick && !PK.editing) { const cb = PK.onPick; closePicker(); cb(ex); return; }
  closeForm();
});
$("fxDelete").addEventListener("click", () => {
  if (!PK.editing || !confirm(t("lib.deleteConfirm", { name: PK.editing.name }))) return;
  CUSTOM_EX = CUSTOM_EX.filter(x => x.id !== PK.editing.id); saveCustom(); closeForm();
});
/* Reps: a number or a range such as 8–12 (typed with any dash) */
function cleanReps(s) {
  const v = normDigits(s).replace(/\s+/g, "").replace(/[-‒–—]/g, "–").replace(/[^0-9–]/g, "");
  const m = /^(\d{1,3})(?:–(\d{1,3}))?$/.exec(v);
  if (!m || +m[1] < 1) return "";
  return m[2] && +m[2] > +m[1] ? m[1] + "–" + m[2] : m[1];
}

$("pkSearch").addEventListener("input", renderPickerList);
$("pkEquip").addEventListener("change", e => { PK.equip = e.target.value; renderPickerList(); });
$("pkClose").addEventListener("click", closePicker);
$("pkAddOwn").addEventListener("click", () => openForm(null));
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("picker").hidden) closePicker(); });
