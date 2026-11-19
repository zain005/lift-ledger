/* Lift Ledger: 3D muscle map.
   A turnable figure whose muscle groups are painted by sets per week, in the same bands as the list beside it:
   not trained, low (under 6), in range (6–20), high (over 20). Colour always comes with a word (legend and readout),
   and the list stays as the text version, so nothing depends on seeing colour or on WebGL.
   three.js (MIT, beta/vendor) loads only the first time a muscle panel is shown; the offline worker keeps a copy
   after that. If WebGL or the file isn't available, the panel simply shows the list.
   The regions are approximate surface areas for training purposes, not an anatomy reference. */
"use strict";

const M3D = (() => {
  const band = v => v <= 0 ? "zero" : v < 6 ? "low" : v > 20 ? "high" : "ok";
  const BAND_VAR = { low: "--gold", ok: "--done", high: "--miss" };
  const reduceMotion = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const views = {};
  let THREE = null, loading = null, glOk = null;

  function webgl() {
    if (glOk !== null) return glOk;
    try { const c = document.createElement("canvas"); glOk = !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl"))); }
    catch (e) { glOk = false; }
    return glOk;
  }
  function loadThree() {
    if (!loading) loading = import(new URL("vendor/three.module.min.js", document.baseURI).href).then(m => { THREE = m; return m; });
    return loading;
  }

  /* ---------- the figure ----------
     Units are metres; the figure is about 1.8 m tall, faces +z, and its left side is +x.
     The torso and limbs are lathe shapes (a smooth profile turned around an axis). Each vertex is given a muscle
     region from its height and its angle around the part: 0° = front, 90° = outer side, 180° = back, −90° = inner side. */
  const JOINTS = {
    shoulder: [0.205, 1.43], elbow: [0.275, 1.145], wrist: [0.325, 0.885],
    hip: [0.092, 0.905], knee: [0.106, 0.505], ankle: [0.112, 0.095]
  };
  const TORSO_DEPTH = 0.6;           // the torso is an ellipse, 60% as deep as it is wide
  const TORSO = [[0.001, 0.80], [0.10, 0.812], [0.152, 0.85], [0.171, 0.91], [0.167, 0.98], [0.15, 1.06], [0.147, 1.12], [0.159, 1.2],
    [0.18, 1.29], [0.197, 1.37], [0.203, 1.42], [0.184, 1.47], [0.12, 1.5], [0.06, 1.515], [0.001, 1.522]];
  const LIMBS = {   // [from joint, to joint, [fraction along, radius]...]
    upperArm: ["shoulder", "elbow", [[0, 0.056], [0.12, 0.06], [0.45, 0.05], [0.85, 0.042], [1, 0.037]]],
    forearm: ["elbow", "wrist", [[0, 0.038], [0.22, 0.044], [0.6, 0.035], [1, 0.026]]],
    thigh: ["hip", "knee", [[0, 0.086], [0.2, 0.082], [0.6, 0.066], [1, 0.05]]],
    shin: ["knee", "ankle", [[0, 0.05], [0.25, 0.054], [0.62, 0.039], [1, 0.028]]]
  };
  const between = (a, lo, hi) => a >= lo && a <= hi;
  /* Which muscle a point belongs to. y: height (torso) or fraction along the limb from its top joint; a: angle in degrees */
  const REGION = {
    /* The torso regions meet edge to edge, as on a body: traps (a diamond from the neck to mid-back), lats (wrapping
       round under the arms), lower back, glutes, chest and the abs with the sides of the waist */
    torso(y, a) {
      const A = Math.abs(a);
      if (y >= 1.5) return "";
      if ((y > 1.405 && A > 75) || (y > 1.3 && A >= 150)) return "traps";
      if (y > 1.24 && y <= 1.43 && A < 70) return "chest";
      if (y > 1.1 && y <= 1.405 && A >= 70) return y > 1.36 && A < 100 ? "" : "back";
      if (y > 0.975 && y <= 1.1 && A >= 100) return "lower_back";
      if (y > 0.96 && y <= 1.24 && A < 100) return "abs";
      if (y > 0.815 && y <= 0.975 && A > 115) return "glutes";
      return "";
    },
    upperArm(t, a) {
      if (t < 0.3) return between(a, -38, 52) ? "front_delts" : between(a, 52, 122) ? "side_delts" : (a > 122 || a < -150) ? "rear_delts" : "";
      if (t < 0.93) return between(a, -72, 72) ? "biceps" : (a > 108 || a < -108) ? "triceps" : "";
      return "";
    },
    forearm(t, a) { return t > 0.03 && t < 0.86 && a > -120 ? "forearms" : ""; },
    thigh(t, a) {
      if (t < 0.04 || t > 0.93) return "";
      if (between(a, -42, 118)) return t > 0.1 ? "quads" : "";
      if (between(a, -150, -42)) return t < 0.72 ? "adductors" : "";
      return t > 0.08 ? "hamstrings" : "";
    },
    shin(t, a) { return t > 0.04 && t < 0.62 && (a > 98 || a < -112) ? "calves" : ""; }
  };
  /* A few lines inside regions, so the torso reads as muscle rather than a painted suit:
     the line between the pecs, the line down the abs with two crossing lines, the side of the abs, and the spine */
  function torsoLine(y, a) {
    const A = Math.abs(a);
    if (A < 2 && y > 0.98 && y < 1.42) return true;
    if (A > 178 && y > 0.98 && y < 1.44) return true;
    if (A < 30 && y > 1.0 && y < 1.22 && (Math.abs(y - 1.075) < 0.0035 || Math.abs(y - 1.15) < 0.0035)) return true;
    return y > 0.98 && y < 1.22 && Math.abs(A - 33) < 1.6;
  }

  /* A smooth lathe: the profile is passed through a spline first, so the silhouette has no facets */
  function lathe(profile, rings) {
    const spline = new THREE.SplineCurve(profile.map(([r, y]) => new THREE.Vector2(r, y)));
    const pts = spline.getSpacedPoints(rings).map(p => new THREE.Vector2(Math.max(p.x, 0.0005), p.y));
    pts[0].x = 0.0005; pts[pts.length - 1].x = 0.0005;
    const g = new THREE.LatheGeometry(pts, 96, Math.PI);       // fine enough that region borders read as thin lines
    g.userData.rows = pts.length;
    return g;
  }
  function limbGeometry(radii, len) {    // along local −y, from 0 at the top joint to −len, with rounded ends
    const first = radii[0][1], last = radii[radii.length - 1][1];
    const prof = [[0, -len - last * 0.62], [last * 0.8, -len - last * 0.32]]
      .concat(radii.slice().reverse().map(([f, r]) => [r, -f * len]))
      .concat([[first * 0.8, first * 0.32], [0, first * 0.62]]);
    return lathe(prof, 72);
  }
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  function buildFigure(v) {
    const fig = new THREE.Group();
    v.bodyMat = new THREE.MeshStandardMaterial({ roughness: 0.86, metalness: 0 });
    v.paintMat = new THREE.MeshStandardMaterial({ roughness: 0.74, metalness: 0, vertexColors: true });
    v.painted = [];
    const plain = (geo, pos, quat) => { const m = new THREE.Mesh(geo, v.bodyMat); if (pos) m.position.copy(pos); if (quat) m.quaternion.copy(quat); fig.add(m); return m; };
    /* Give every vertex its region, and mark vertices on a border between regions so muscles show an outline */
    const paint = (geo, regionAt, pos, quat, lineAt) => {
      const p = geo.attributes.position, n = p.count, rows = geo.userData.rows, regions = new Array(n);
      for (let i = 0; i < n; i++) regions[i] = regionAt(p.getX(i), p.getY(i), p.getZ(i));
      const edge = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        if (lineAt && regions[i] && lineAt(p.getX(i), p.getY(i), p.getZ(i))) { edge[i] = 1; continue; }
        const col = Math.floor(i / rows), row = i % rows, cols = n / rows;
        const nb = [[col, row - 1], [col, row + 1], [(col + 1) % cols, row], [(col - 1 + cols) % cols, row]];
        if (nb.some(([c, r]) => r >= 0 && r < rows && regions[c * rows + r] !== regions[i] && (regions[i] || regions[c * rows + r]))) edge[i] = 1;
      }
      geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      const m = new THREE.Mesh(geo, v.paintMat);
      if (pos) m.position.copy(pos);
      if (quat) m.quaternion.copy(quat);
      m.userData = { regions, edge };
      fig.add(m); v.painted.push(m);
      return m;
    };
    const ang = (lat, z) => Math.atan2(lat, z) * 180 / Math.PI;

    const torso = lathe(TORSO, 150); torso.scale(1, 1, TORSO_DEPTH);
    paint(torso, (x, y, z) => REGION.torso(y, ang(Math.abs(x), z / TORSO_DEPTH)), null, null,
      (x, y, z) => torsoLine(y, ang(Math.abs(x), z / TORSO_DEPTH)));
    plain(limbGeometry([[0, 0.05], [1, 0.054]], 0.12), V(0, 1.585, -0.008));
    const head = new THREE.SphereGeometry(1, 40, 28); head.scale(0.088, 0.112, 0.1);
    plain(head, V(0, 1.672, 0.004));
    [1, -1].forEach(s => {
      Object.entries(LIMBS).forEach(([name, [j0, j1, radii]]) => {
        const a = V(s * JOINTS[j0][0], JOINTS[j0][1], 0), b = V(s * JOINTS[j1][0], JOINTS[j1][1], 0);
        const dir = b.clone().sub(a), len = dir.length();
        const q = new THREE.Quaternion().setFromUnitVectors(V(0, -1, 0), dir.normalize());
        // in the limb's own frame +z stays the front and +x the figure's left, so the outer side is s·x
        paint(limbGeometry(radii, len), (x, y, z) => REGION[name](-y / len, ang(s * x, z)), a, q);
      });
      const hand = new THREE.SphereGeometry(1, 24, 16); hand.scale(0.03, 0.068, 0.018);
      const w = V(s * JOINTS.wrist[0], JOINTS.wrist[1], 0), hd = w.clone().sub(V(s * JOINTS.elbow[0], JOINTS.elbow[1], 0)).normalize();
      plain(hand, w.clone().addScaledVector(hd, 0.07), new THREE.Quaternion().setFromUnitVectors(V(0, -1, 0), hd));
      const foot = new THREE.SphereGeometry(1, 24, 16); foot.scale(0.042, 0.032, 0.115);
      plain(foot, V(s * (JOINTS.ankle[0] + 0.006), 0.04, 0.05));
    });

    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.1, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.scale.set(0.3, 0.17, 1); shadow.position.y = 0.002;
    v.shadow = shadow;
    v.scene.add(shadow);
    return fig;
  }

  /* ---------- one view (builder or stats) ---------- */
  function shell(v) {
    const root = document.createElement("div"); root.className = "m3d-root";
    root.innerHTML = '<div class="m3d-stage"><canvas></canvas><p class="m3d-wait"></p></div>' +
      '<div class="m3d-bar"><div class="seg two m3d-seg"><button type="button" data-face="0"></button><button type="button" data-face="1"></button></div><span class="m3d-hint"></span></div>' +
      '<p class="m3d-read" aria-live="polite"></p><ul class="m3d-legend"></ul>';
    v.root = root; v.canvas = root.querySelector("canvas"); v.stage = root.querySelector(".m3d-stage");
    v.canvas.setAttribute("role", "img");
    root.querySelectorAll(".m3d-seg button").forEach(b => b.addEventListener("click", () => turnTo(v, +b.dataset.face * Math.PI)));
    const leg = root.querySelector(".m3d-legend");
    ["zero", "low", "ok", "high"].forEach(k => { const li = document.createElement("li"); li.innerHTML = '<i class="' + k + '"></i><span></span>'; leg.appendChild(li); });
    texts(v);
  }
  function texts(v) {
    const R = v.root;
    R.querySelector(".m3d-wait").textContent = t("m3d.loading");
    const [f, b] = R.querySelectorAll(".m3d-seg button");
    f.textContent = t("m3d.front"); b.textContent = t("m3d.back");
    R.querySelector(".m3d-hint").textContent = t("m3d.hint");
    v.canvas.setAttribute("aria-label", t("m3d.aria"));
    R.querySelectorAll(".m3d-legend span").forEach((s, i) => { s.textContent = t("m3d." + ["zero", "low", "ok", "high"][i]); });
    readout(v);
  }
  const setsText = n => tn("m3d.sets", Math.round(n * 2) / 2);
  function readout(v) {
    const el = v.root.querySelector(".m3d-read"), T = v.tally || {};
    if (v.sel) { const n = T[v.sel] || 0; el.textContent = t("m3d.read", { muscle: muscleName(v.sel), sets: setsText(n), status: t("m3d." + band(n)) }); return; }
    const top = Object.entries(T).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])[0];
    el.textContent = top ? t("m3d.top", { muscle: muscleName(top[0]), sets: setsText(top[1]) }) : t("m3d.empty");
  }
  function faceButtons(v) {
    const back = Math.cos(v.yaw) < 0;
    v.root.querySelectorAll(".m3d-seg button").forEach((b, i) => b.setAttribute("aria-pressed", String(!!i === back)));
  }

  function build3D(v) {
    const renderer = new THREE.WebGLRenderer({ canvas: v.canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    v.renderer = renderer;
    v.scene = new THREE.Scene();
    v.camera = new THREE.PerspectiveCamera(27, 1, 0.1, 20);
    v.camera.position.set(0, 0.95, 3.95); v.camera.lookAt(0, 0.9, 0);
    v.hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1.9);
    const key = new THREE.DirectionalLight(0xffffff, 2.1); key.position.set(1.6, 2.8, 3.2);
    const rim = new THREE.DirectionalLight(0xffffff, 0.9); rim.position.set(-2.2, 1.6, -2.6);
    v.scene.add(v.hemi, key, rim);
    v.fig = buildFigure(v);
    v.scene.add(v.fig);
    v.root.querySelector(".m3d-wait").hidden = true;
    bindPointer(v);
    if (window.ResizeObserver) new ResizeObserver(() => size(v)).observe(v.stage);
    size(v);
  }
  function size(v) {
    if (!v.renderer) return;
    const w = v.stage.clientWidth, h = v.stage.clientHeight;
    if (!w || !h) return;
    v.renderer.setSize(w, h, false);
    v.camera.aspect = w / h; v.camera.updateProjectionMatrix();
    draw(v);
  }
  /* Colours come from the app's theme, so light and dark both work */
  function colours(v) {
    if (!v.renderer) return;
    const C = THREE.Color, surface = new C(css("--surface") || "#ffffff"), strong = new C(css("--line-strong") || "#8d887e"), ink = new C(css("--ink") || "#16140f");
    const dark = surface.getHSL({}).l < 0.4;
    const body = surface.clone().lerp(strong, dark ? 0.62 : 0.4);
    v.bodyMat.color.copy(body);
    const zero = body.clone().lerp(ink, dark ? 0.08 : 0.1), line = body.clone().lerp(ink, dark ? 0.32 : 0.3);
    const by = {}; ["low", "ok", "high"].forEach(k => { by[k] = new C(css(BAND_VAR[k])); });
    /* A tapped muscle keeps its colour with a strong outline, and every other muscle fades back towards the body */
    const T = v.tally || {};
    v.painted.forEach(m => {
      const { regions, edge } = m.userData, col = m.geometry.attributes.color;
      for (let i = 0; i < regions.length; i++) {
        const r = regions[i], picked = !!v.sel && r === v.sel;
        let c = !r ? body : (k => k === "zero" ? zero : by[k])(band(T[r] || 0));
        if (v.sel && r && !picked) c = c.clone().lerp(body, 0.62);
        if (edge[i]) c = c.clone().lerp(picked ? ink : line, picked ? 0.7 : v.sel ? 0.3 : 0.55);
        col.setXYZ(i, c.r, c.g, c.b);
      }
      col.needsUpdate = true;
    });
    v.hemi.color.set(dark ? 0xb8b4ac : 0xffffff); v.hemi.groundColor.copy(body).multiplyScalar(0.5);
    v.shadow.material.color.copy(ink); v.shadow.material.opacity = dark ? 0.35 : 0.1;
  }
  const pending = new Set(); let frame = 0;
  function draw(v) {
    pending.add(v);
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      pending.forEach(x => { if (x.renderer && x.stage.clientWidth) { x.fig.rotation.y = x.yaw; x.shadow.rotation.z = x.yaw; x.renderer.render(x.scene, x.camera); } });
      pending.clear();
    });
  }
  function turnTo(v, target) {
    const from = v.yaw, delta = Math.atan2(Math.sin(target - from), Math.cos(target - from));
    if (!v.renderer || reduceMotion()) { v.yaw = from + delta; faceButtons(v); draw(v); return; }
    const t0 = performance.now(), dur = 480;
    const step = now => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      v.yaw = from + delta * e; draw(v);
      if (k < 1) requestAnimationFrame(step); else faceButtons(v);
    };
    requestAnimationFrame(step);
  }
  /* The muscle under a tap: the region most of the touched triangle's corners belong to */
  function regionAt(hit) {
    const regs = hit.object.userData.regions, f = hit.face, c = {};
    [f.a, f.b, f.c].forEach(i => { const r = regs[i]; if (r) c[r] = (c[r] || 0) + 1; });
    return Object.keys(c).sort((a, b) => c[b] - c[a])[0] || "";
  }
  function bindPointer(v) {
    const c = v.canvas, ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    let drag = null;
    c.addEventListener("pointerdown", e => { drag = { x: e.clientX, yaw: v.yaw, moved: false, id: e.pointerId }; });
    c.addEventListener("pointermove", e => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) > 6) { drag.moved = true; try { c.setPointerCapture(e.pointerId); } catch (x) {} }
      if (drag.moved) { v.yaw = drag.yaw + dx * 0.012; faceButtons(v); draw(v); }
    });
    const end = e => {
      if (!drag) return;
      const tap = !drag.moved && e.type === "pointerup"; drag = null;
      if (!tap) return;
      const r = c.getBoundingClientRect();
      ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      v.fig.rotation.y = v.yaw; v.fig.updateMatrixWorld(true);
      ray.setFromCamera(ndc, v.camera);
      const hit = ray.intersectObjects(v.fig.children, false)[0];
      const m = hit && hit.object.userData.regions ? regionAt(hit) : "";
      v.sel = m && m !== v.sel ? m : "";
      colours(v); readout(v); draw(v);
    };
    c.addEventListener("pointerup", end);
    c.addEventListener("pointercancel", end);
  }

  /* Show the figure inside host with these sets per muscle. key keeps one figure per place (builder, stats),
     so re-rendering a page moves the same figure into the new host instead of building another. */
  function show(host, tally, key) {
    if (!host) return;
    if (!webgl()) { host.hidden = true; return; }
    let v = views[key];
    if (v && v.failed) { host.hidden = true; return; }
    if (!v) {
      v = views[key] = { key, yaw: 0.42, sel: "", painted: [] };
      shell(v);
      loadThree().then(() => { build3D(v); colours(v); faceButtons(v); draw(v); })
        .catch(() => { v.failed = true; if (v.host) v.host.hidden = true; });
    }
    host.hidden = false;
    if (v.root.parentNode !== host) { host.innerHTML = ""; host.appendChild(v.root); }
    v.host = host;
    v.tally = tally || {};
    if (v.sel && !(v.sel in v.tally)) v.sel = "";
    texts(v); faceButtons(v);
    if (v.renderer) { size(v); colours(v); draw(v); }
  }
  function recolourAll() { Object.values(views).forEach(v => { if (v.renderer) { colours(v); draw(v); } }); }
  new MutationObserver(recolourAll).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  if (window.matchMedia) { const q = matchMedia("(prefers-color-scheme: dark)"); if (q.addEventListener) q.addEventListener("change", recolourAll); }

  return { show, band };
})();
