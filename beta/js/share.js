/* Lift Ledger: sharing programs.
   The whole program travels inside the link, after the "#", so it is never sent to any server:
     https://…/lift-ledger/#p=<version>.<compressed program>.<checksum>
   - version: links made today keep working after app updates.
   - checksum: a link that was cut short is reported, never half-imported.
   Opening a link shows what's in it and asks before adding it. Sharing the same program again
   updates the trainee's copy and keeps their logged weights (programs keep their id). */
"use strict";

const SHARE_VERSION = "1";

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
function packProgram(raw) {
  return { i: raw.id, n: raw.name, w: raw.weeks, d: (raw.days || []).map(d => ({ i: d.id, n: d.name,
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
    }) })) };
}
function unpackProgram(c) {
  if (!c || typeof c !== "object" || !Array.isArray(c.d)) throw new Error("bad");
  return {
    format: 2, id: c.i, name: c.n, weeks: c.w || 8, shared: true,
    description: tn("prog.daysWeek", c.d.length),
    days: c.d.map(d => ({ id: d.i, name: d.n, exercises: (d.e || []).map(x => {
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
    }) }))
  };
}
function encodeProgram(raw) {
  const z = fflate.deflateSync(fflate.strToU8(JSON.stringify(packProgram(raw))), { level: 9 });
  const body = b64url(z);
  return SHARE_VERSION + "." + body + "." + checksum(body);
}
/* Throws an Error whose .code says what went wrong: "version", "damaged" */
function decodeProgram(code) {
  const parts = String(code).split(".");
  if (parts[0] !== SHARE_VERSION) { const e = new Error("version"); e.code = parts.length === 3 && /^\d+$/.test(parts[0]) ? "version" : "damaged"; throw e; }
  if (parts.length !== 3 || checksum(parts[1]) !== parts[2]) { const e = new Error("damaged"); e.code = "damaged"; throw e; }
  try { return unpackProgram(JSON.parse(fflate.strFromU8(fflate.inflateSync(unb64url(parts[1]))))); }
  catch (x) { const e = new Error("damaged"); e.code = "damaged"; throw e; }
}
const shareUrl = raw => location.origin + location.pathname + "#p=" + encodeProgram(raw);
const rawProgram = id => load(KEY.custom, []).find(r => slug(r.id || r.name) === id);

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
  const url = shareUrl(raw);
  SHARING = { raw, url };
  $("shName").textContent = raw.name;
  $("shSummary").textContent = programSummary(raw);
  $("shLink").value = url;
  const svg = qrSvg(url);
  $("shQr").innerHTML = svg || "";
  $("shQrBox").hidden = !svg;
  $("shQrTooBig").hidden = !!svg;
  $("shNative").hidden = !navigator.share;
  showMsg("shMsg", "");
  $("share").hidden = false; $("share").scrollTop = 0;
  document.body.classList.add("sheet-open");
}
function closeShare() { $("share").hidden = true; document.body.classList.remove("sheet-open"); SHARING = null; }
function programSummary(raw) {
  const days = raw.days || [], ex = days.reduce((a, d) => a + (d.exercises || []).length, 0);
  return tn("prog.daysWeek", days.length) + " · " + tn("bd.exN", ex);
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
function readShareHash() {
  const m = /^#p=(.+)$/.exec(location.hash || "");
  if (!m) return false;
  history.replaceState(null, "", location.pathname + location.search);     // don't import twice on reload
  INCOMING = null;
  let raw = null, err = null;
  try { raw = decodeProgram(decodeURIComponent(m[1])); normalizeProgram(raw, false); }
  catch (e) { err = e.code === "version" ? "share.errVersion" : "share.errDamaged"; raw = null; }
  $("imOk").hidden = !raw; $("imErr").hidden = !!raw;
  if (raw) {
    INCOMING = raw;
    const existing = progById(slug(raw.id));
    $("imName").textContent = raw.name;
    $("imSummary").textContent = programSummary(raw);
    const ul = $("imDays"); ul.innerHTML = "";
    raw.days.forEach(d => {
      const li = document.createElement("li");
      const b = document.createElement("b"); b.textContent = d.name;
      const sm = document.createElement("small"); sm.textContent = d.exercises.map(e => e.name).join(", ");
      li.append(b, sm); ul.appendChild(li);
    });
    $("imUpdateNote").hidden = !existing;
    $("imAdd").textContent = t(existing ? "share.update" : "share.add");
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
  const raw = INCOMING, p = normalizeProgram(raw, false), updating = !!progById(p.id);
  store(KEY.custom, load(KEY.custom, []).filter(r => slug(r.id || r.name) !== p.id).concat([raw]));
  PROGRAMS = PROGRAMS.filter(q => q.id !== p.id).concat([p]);
  delete LOGS[p.id];
  closeImport();
  setProgram(p.id);
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
