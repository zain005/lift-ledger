/* Lift Ledger: sharing programs.
   The whole program travels inside the link, after the "#", so it is never sent to any server:
     https://…/lift-ledger/#p=<version>.<compressed program>.<checksum>
   - version: links made today keep working after app updates.
   - checksum: a link that was cut short is reported, never half-imported.
   Opening a link shows what's in it and asks before adding it. Sharing the same program again
   updates the trainee's copy and keeps their logged weights (programs keep their id); the trainee sees what changed
   and chooses to update or keep their current version.
   Version 2 carries weeks (each week its own days), the coach's Pro choice, and ready-made programs by name only.
   Version 1 links still open. */
"use strict";

const SHARE_VERSION = "2";

/* ---------- encode / decode ---------- */
function b64url(bytes) {
  let s = ""; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64url(str) {
  const s = atob(str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4));
  const out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out;
}
/* FNV-1a, 32-bit: enough to catch a link that was cut short or mistyped */
function checksum(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}
/* Short keys keep links small; exercise names travel too, so a link still reads right if the library changes */
function packDays(days) {
  return (days || []).map(d => ({ i: d.id, n: d.name,
    e: (d.exercises || []).map(e => {
      const sets = Math.max(1, Math.floor(+e.sets) || 1);
      const x = { i: e.id, n: e.name, s: Array.isArray(e.setReps) && e.setReps.length === sets ? e.setReps : Array(sets).fill(String(e.reps || "")) };
      const lib = e.ref && typeof exById === "function" ? exById(e.ref) : null;
      if (e.ref) x.r = e.ref;
      if (e.rpe) x.p = e.rpe;
      if (e.timed) x.t = 1;
      if (e.perSide) x.sd = 1;
      if (e.cue && !(lib && lib.cue === e.cue)) x.c = e.cue;
      if (!lib || lib.custom) { if (e.primary) x.m = e.primary; if (e.secondary && e.secondary.length) x.m2 = e.secondary; }
      return x;
    }) }));
}
function packProgram(raw, pro) {
  const c = { i: raw.id, n: raw.name, w: raw.weeks, d: packDays(raw.days) };
  if (raw.repeat) c.rp = 1;
  if (raw.weekly) c.wk = 1;
  if (pro) c.pr = 1;
  if (Array.isArray(raw.phases) && raw.phases.length) c.ph = raw.phases.map(ph => ({ f: ph.weeks[0], t: ph.weeks[ph.weeks.length - 1], n: ph.name || undefined, d: ph.days ? packDays(ph.days) : undefined }));
  return c;
}
function unpackDays(days) {
  return days.map(d => ({ id: d.i, name: d.n, exercises: (d.e || []).map(x => {
      const lib = x.r && typeof exById === "function" ? exById(x.r) : null;
      const s = (Array.isArray(x.s) ? x.s : []).map(String), same = s.every(r => r === s[0]);
      const e = { id: x.i, name: x.n || (lib && lib.name) || "", sets: s.length, reps: same ? s[0] : s.join(" / ") };
      if (!same) e.setReps = s;
      if (x.r) e.ref = x.r;
      if (x.p) e.rpe = x.p;
      if (x.t) e.timed = true;
      if (x.sd) e.perSide = true;
      const cue = x.c || (lib && lib.cue); if (cue) e.cue = cue;
      const primary = x.m || (lib && lib.primary), secondary = x.m2 || (lib && lib.secondary);
      if (primary) e.primary = primary;
      if (secondary && secondary.length) e.secondary = secondary;
      return e;
    }) }));
}
/* Returns { raw, pro } for a full program, or { builtin: id, pro } for a ready-made one */
function unpackProgram(c) {
  if (!c || typeof c !== "object") throw new Error("bad");
  if (typeof c.b === "string") return { builtin: c.b, pro: !!c.pr };
  if (!Array.isArray(c.d)) throw new Error("bad");
  const raw = {
    format: 2, id: c.i, name: c.n, weeks: c.w || 8, shared: true,
    description: c.wk ? tn("prog.nWeeks", c.w) + " · " + tn("prog.daysWeek", c.d.length) : tn("prog.daysWeek", c.d.length),
    days: unpackDays(c.d)
  };
  if (c.rp) raw.repeat = true;
  if (c.wk) raw.weekly = true;
  if (Array.isArray(c.ph)) raw.phases = c.ph.map(ph => { const o = { name: ph.n || "", weeks: [ph.f, ph.t] }; if (ph.d) o.days = unpackDays(ph.d); return o; });
  return { raw, pro: !!c.pr };
}
function encodeProgram(raw, pro) {
  const z = fflate.deflateSync(fflate.strToU8(JSON.stringify(raw.builtinRef ? { b: raw.builtinRef, pr: pro ? 1 : undefined } : packProgram(raw, pro))), { level: 9 });
  const body = b64url(z);
  return SHARE_VERSION + "." + body + "." + checksum(body);
}
/* Throws an Error whose .code says what went wrong: "version", "damaged" */
function decodeProgram(code) {
  const parts = String(code).split(".");
  if (parts[0] !== "1" && parts[0] !== SHARE_VERSION) { const e = new Error("version"); e.code = parts.length === 3 && /^\d+$/.test(parts[0]) ? "version" : "damaged"; throw e; }
  if (parts.length !== 3 || checksum(parts[1]) !== parts[2]) { const e = new Error("damaged"); e.code = "damaged"; throw e; }
  try { return unpackProgram(JSON.parse(fflate.strFromU8(fflate.inflateSync(unb64url(parts[1]))))); }
  catch (x) { const e = new Error("damaged"); e.code = "damaged"; throw e; }
}
const shareUrl = (raw, pro) => location.origin + location.pathname + "#p=" + encodeProgram(raw, pro);
/* A ready-made program travels by name only: every copy of the app already has it, so the link stays tiny */
const rawProgram = id => { const p = progById(id); return p && p.builtin ? { builtinRef: p.id, name: p.name, p } : load(KEY.custom, []).find(r => slug(r.id || r.name) === id); };

/* ---------- QR code (drawn as SVG, dark on white so any camera can read it, even in dark mode) ---------- */
function qrSvg(text) {
  let qr = null;
  for (const level of ["M", "L"]) {
    try { qr = qrcode(0, level); qr.addData(text, "Byte"); qr.make(); break; } catch (e) { qr = null; }
  }
  if (!qr) return null;
  const n = qr.getModuleCount(), q = 4, size = n + q * 2;
  let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += "M" + (c + q) + " " + (r + q) + "h1v1h-1z";
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + " " + size + '" shape-rendering="crispEdges" role="img" aria-label="' + escAttr(t("share.qrAria")) + '"><rect width="100%" height="100%" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
}

/* ---------- share sheet ---------- */
let SHARING = null;
function openShare(id) {
  const raw = rawProgram(id); if (!raw) return;
  SHARING = { raw, url: "" };
  $("shName").textContent = raw.name;
  $("shSummary").textContent = raw.p ? summaryOf(raw.p) : programSummary(raw);
  $("shProRow").hidden = !SET.pro;                 // only a coach in Pro can send a Pro program
  $("shPro").checked = false;
  $("shFile").hidden = !!raw.builtinRef;
  refreshShareLink();
  $("shNative").hidden = !navigator.share;
  showMsg("shMsg", "");
  $("share").hidden = false; $("share").scrollTop = 0;
  document.body.classList.add("sheet-open");
}
function refreshShareLink() {
  const url = shareUrl(SHARING.raw, SET.pro && $("shPro").checked);
  SHARING.url = url;
  $("shLink").value = url;
  const svg = qrSvg(url);
  $("shQr").innerHTML = svg || "";
  $("shQrBox").hidden = !svg;
  $("shQrTooBig").hidden = !!svg;
}
$("shPro").addEventListener("change", () => { if (SHARING) { refreshShareLink(); showMsg("shMsg", ""); } });
function closeShare() { $("share").hidden = true; document.body.classList.remove("sheet-open"); SHARING = null; }
function programSummary(raw) {
  try { return summaryOf(normalizeProgram(raw, false)); }
  catch (e) { const days = raw.days || []; return tn("prog.daysWeek", days.length); }
}
/* "3 days a week · 18 exercises", or "8 weeks · 3 days a week" for a program planned by week */
function summaryOf(p) {
  const ex = p.phases[0].days.reduce((a, d) => a + d.length, 0);
  return (p.weekly || (!p.repeat && p.weeks > 1 && p.builtin) ? tn("prog.nWeeks", p.weeks) + " · " : "") + tn("prog.daysWeek", p.phases[0].days.length) + " · " + tn("bd.exN", ex);
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch (e) {
    const ta = $("shLink"); ta.focus(); ta.select();
    try { return document.execCommand("copy"); } catch (x) { return false; }
  }
}
$("shNative").addEventListener("click", async () => {
  if (!SHARING) return;
  try { await navigator.share({ title: SHARING.raw.name, text: t("share.message", { name: SHARING.raw.name }), url: SHARING.url }); }
  catch (e) { /* the person closed the share sheet */ }
});
$("shCopy").addEventListener("click", async () => {
  if (!SHARING) return;
  const ok = await copyText(SHARING.url);
  showMsg("shMsg", t(ok ? "share.copied" : "share.copyFailed"), !ok);
});
$("shFile").addEventListener("click", () => {
  if (!SHARING) return;
  const name = (SHARING.raw.name || "program").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "program";
  download(name + ".json", JSON.stringify(SHARING.raw, null, 2), "application/json");
  showMsg("shMsg", t("share.fileDone"));
});
$("shClose").addEventListener("click", closeShare);

/* ---------- opening a shared link ---------- */
let INCOMING = null;
const prescr = e => e.sets + "×" + (e.setReps ? e.setReps.join("/") : e.reps);
/* What's different between the trainee's copy and the coach's new version, in a few readable lines */
function changeList(oldP, newP) {
  const out = [], seen = new Map();
  const add = (key, text, w) => { if (!seen.has(key)) { seen.set(key, { text, weeks: [] }); out.push(key); } seen.get(key).weeks.push(w); };
  if (oldP.weeks !== newP.weeks && (newP.weekly || oldP.weekly)) add("w", t("share.chgWeeks", { from: oldP.weeks, to: newP.weeks }), 0);
  const nw = Math.max(oldP.repeat ? 1 : oldP.weeks, newP.repeat ? 1 : newP.weeks);
  for (let w = 1; w <= nw; w++) {
    const o = new Map(), n = new Map();
    if (w <= (oldP.repeat ? 1 : oldP.weeks)) phaseFor(oldP, w).days.forEach(d => d.forEach(e => o.set(e.id, e)));
    if (w <= (newP.repeat ? 1 : newP.weeks)) phaseFor(newP, w).days.forEach(d => d.forEach(e => n.set(e.id, e)));
    if (phaseFor(oldP, w).days.length !== phaseFor(newP, w).days.length && w <= newP.weeks) add("d" + phaseFor(newP, w).days.length, t("share.chgDays", { from: phaseFor(oldP, w).days.length, to: phaseFor(newP, w).days.length }), w);
    n.forEach((e, id) => {
      const was = o.get(id);
      if (!was) add("+" + e.name, t("share.chgAdded", { name: e.name }), w);
      else if (prescr(was) !== prescr(e) || was.name !== e.name) add("~" + e.name + prescr(was) + prescr(e), t("share.chgSets", { name: e.name, from: prescr(was), to: prescr(e) }), w);
    });
    o.forEach((e, id) => { if (!n.has(id)) add("-" + e.name, t("share.chgRemoved", { name: e.name }), w); });
  }
  const multi = newP.weekly || oldP.weekly;
  return out.map(k => { const c = seen.get(k), ws = c.weeks.filter(Boolean);
    return c.text + (multi && ws.length && ws.length < nw ? " (" + tn("share.chgInWeeks", ws.length, { list: ws.join(", ") }) + ")" : ""); });
}
function readShareHash() {
  const m = /^#p=(.+)$/.exec(location.hash || "");
  if (!m) return false;
  history.replaceState(null, "", location.pathname + location.search);     // don't import twice on reload
  INCOMING = null;
  let got = null, p = null, err = null;
  try {
    got = decodeProgram(decodeURIComponent(m[1]));
    if (got.builtin) { p = progById(got.builtin); if (!p || !p.builtin) throw Object.assign(new Error("damaged"), { code: "damaged" }); }
    else p = normalizeProgram(got.raw, false);
  }
  catch (e) { err = e.code === "version" ? "share.errVersion" : "share.errDamaged"; got = null; }
  $("imOk").hidden = !got; $("imErr").hidden = !!got;
  if (got) {
    INCOMING = Object.assign({ p }, got);
    const existing = got.builtin ? null : progById(p.id);
    $("imName").textContent = p.name;
    $("imSummary").textContent = summaryOf(p);
    $("imPro").hidden = !got.pro;
    const ul = $("imDays"); ul.innerHTML = "";
    p.phases[0].days.forEach((day, i) => {
      const li = document.createElement("li");
      const b = document.createElement("b"); b.textContent = p.phases[0].dayNames[i];
      const sm = document.createElement("small"); sm.textContent = day.map(e => e.name).join(", ");
      li.append(b, sm); ul.appendChild(li);
    });
    if (p.weekly) { const li = document.createElement("li"); li.className = "more"; li.textContent = t("share.moreWeeks", { n: p.weeks }); ul.appendChild(li); }
    $("imUpdateNote").hidden = !existing;
    const chg = existing ? changeList(existing, p) : [];
    $("imChanges").hidden = !existing;
    const cl = $("imChangeList"); cl.innerHTML = "";
    (chg.length ? chg.slice(0, 8) : [t("share.chgNone")]).forEach(x => { const li = document.createElement("li"); li.textContent = x; cl.appendChild(li); });
    if (chg.length > 8) { const li = document.createElement("li"); li.textContent = tn("share.chgMore", chg.length - 8); cl.appendChild(li); }
    $("imAdd").textContent = t(existing ? "share.update" : "share.add");
    $("imCancel").textContent = t(existing ? "share.keep" : "lib.cancel");
  } else {
    $("imErrText").textContent = t(err);
  }
  $("importSheet").hidden = false; $("importSheet").scrollTop = 0;
  document.body.classList.add("sheet-open");
  return true;
}
function closeImport() { $("importSheet").hidden = true; document.body.classList.remove("sheet-open"); INCOMING = null; }
$("imCancel").addEventListener("click", closeImport);
$("imErrClose").addEventListener("click", closeImport);
$("imAdd").addEventListener("click", () => {
  if (!INCOMING) return;
  const got = INCOMING, p = got.p, updating = !got.builtin && !!progById(p.id);
  if (!got.builtin) {
    store(KEY.custom, load(KEY.custom, []).filter(r => slug(r.id || r.name) !== p.id).concat([got.raw]));
    PROGRAMS = PROGRAMS.filter(q => q.id !== p.id).concat([p]);
    delete LOGS[p.id];
  }
  closeImport();
  setProgram(p.id);
  // The trainee now follows this program. A Pro program switches Pro on; a normal one never switches it off.
  SET.follow = p.id;
  if (got.pro) SET.pro = true;
  saveSettings();
  appMode = "home"; renderAll(); window.scrollTo({ top: 0 });
  showMsg("progMsg", t(updating ? "share.updatedMsg" : "share.addedMsg", { name: p.name }));
  showInstallTip(true);
});
window.addEventListener("hashchange", () => { if (PROGRAMS.length) readShareHash(); });

/* ---------- "add to home screen" tip, so the program is always one tap away ---------- */
const TIP_KEY = PREFIX + "tip-install";
const isInstalled = () => (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
function showInstallTip(force) {
  const dismissed = load(TIP_KEY, false);
  const show = !isInstalled() && (force || !dismissed) && !!P;
  $("installTip").hidden = !show;
  if (!show) return;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  $("tipSteps").textContent = t(ios ? "tip.ios" : "tip.android");
}
$("tipClose").addEventListener("click", () => { store(TIP_KEY, true); $("installTip").hidden = true; });
