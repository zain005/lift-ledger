// @ts-check
const { test, expect } = require("@playwright/test");

/* Arabic: complete text, right-to-left layout, Arabic exercise names with the English name underneath,
   Arabic and gym-slang search, and numbers that read correctly inside Arabic sentences. */
const errors = new WeakMap();
test.beforeEach(async ({ page }) => {
  const list = []; errors.set(page, list);
  page.on("pageerror", e => list.push(e.message));
  await page.goto("./");
  await expect(page.locator("#home")).toBeVisible();
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator("#home")).toBeVisible();
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
  expect(await page.evaluate(() => [...MISSING])).toEqual([]);
});

const toArabic = async page => {
  await page.click("#modeSet");
  await page.locator('.setrow[data-page="language"]').click();
  await Promise.all([page.waitForEvent("load"), page.locator('#langSeg button[lang="ar"]').click()]);
  await expect(page.locator("#home")).toBeVisible();
};
const proOn = async page => {
  await page.click("#modeSet"); await page.locator('.setrow[data-page="pro"]').click();
  await page.locator("#proToggle").click(); await page.click("#modeHome");
};

test("switching to Arabic turns the whole app right-to-left, and back again", async ({ page }) => {
  await toArabic(page);
  expect(await page.evaluate(() => [document.documentElement.lang, document.documentElement.dir])).toEqual(["ar", "rtl"]);
  await expect(page.locator("#modeHome")).toContainText("الرئيسية");
  await expect(page.locator("#homeCreate")).toContainText("أنشئ برنامجي الخاص");
  await expect(page.locator('.home-card[data-id="push-pull-legs-6"]')).toContainText("دفع سحب أرجل");
  await page.click("#modeSet"); await page.locator('.setrow[data-page="language"]').click();
  await Promise.all([page.waitForEvent("load"), page.locator('#langSeg button[lang="en"]').click()]);
  await expect(page.locator("#homeCreate")).toContainText("Create my own program");
  expect(await page.evaluate(() => document.documentElement.dir)).toBe("ltr");
});

test("every English text has an Arabic version with the same placeholders and markup", async ({ page }) => {
  const problems = await page.evaluate(() => {
    const out = [];
    const flat = v => typeof v === "object" ? Object.values(v).join(" ") : String(v);
    for (const k of Object.keys(STRINGS.en)) {
      if (!(k in STRINGS.ar)) { out.push("missing " + k); continue; }
      const en = flat(STRINGS.en[k]), ar = flat(STRINGS.ar[k]);
      for (const ph of new Set(en.match(/\{\w+\}/g) || [])) if (ph !== "{n}" && !ar.includes(ph)) out.push(k + " lacks " + ph);
      if ((en.match(/<\/?\w+/g) || []).length !== (ar.match(/<\/?\w+/g) || []).length) out.push(k + " markup differs");
      if (typeof STRINGS.en[k] === "object" && typeof STRINGS.ar[k] !== "object") out.push(k + " needs plural forms");
      if (typeof STRINGS.ar[k] === "object") for (const f of ["zero", "one", "two", "few", "many", "other"]) if (!(f in STRINGS.ar[k])) out.push(k + " lacks " + f);
    }
    for (const k of Object.keys(STRINGS.ar)) if (!(k in STRINGS.en)) out.push("extra " + k);
    return out;
  });
  expect(problems).toEqual([]);
});

test("every library exercise and ready-made program is translated", async ({ page }) => {
  const res = await page.evaluate(async () => {
    const out = [];
    const lib = await fetch("data/exercises.json").then(r => r.json());
    lib.exercises.forEach(e => { if (!e.name_ar || !e.cue_ar || !e.terms_ar) out.push("exercise " + e.id); });
    const names = lib.exercises.map(e => e.name_ar);
    if (new Set(names).size !== names.length) out.push("duplicate Arabic names");
    const idx = await fetch("programs/index.json").then(r => r.json());
    for (const f of idx.programs || idx) {
      const p = await fetch("programs/" + (typeof f === "string" ? f : f.file)).then(r => r.json());
      for (const k of ["name", "description", "schedule"]) if (p[k] && !p[k + "_ar"]) out.push(p.id + " " + k);
      (p.phases || []).forEach(ph => { if (ph.name && !ph.name_ar) out.push(p.id + " phase"); });
      p.days.forEach(d => {
        if (!d.name_ar || (d.short && !d.short_ar)) out.push(p.id + " day " + d.id);
        d.exercises.forEach(e => {
          if ((e.alts || []).length && (e.alts_ar || []).length !== e.alts.length) out.push(p.id + " alts " + e.id);
          const l = lib.exercises.find(x => x.id === e.ref);
          if (e.cue && !e.cue_ar && !(l && l.cue === e.cue)) out.push(p.id + " cue " + e.id);
        });
      });
    }
    return out;
  });
  expect(res).toEqual([]);
});

test("in Arabic, exercises show the Arabic name with the English one underneath; demos search in English", async ({ page }) => {
  await toArabic(page);
  await page.locator('.home-card[data-id="full-body-3"]').click();
  const first = page.locator(".ex").first();
  await expect(first.locator("h3")).toHaveText("السكوات الخلفي بالبار");
  await expect(first.locator(".en-name")).toHaveText("Back Squat");
  await expect(first.locator(".cue")).toContainText("شدّ جذعك");
  expect(decodeURIComponent(await first.locator(".playbtn").getAttribute("href") || "")).toContain("Back Squat");
  await expect(page.locator("#dayTitle")).toHaveText("الجسم الكامل أ");
  await expect(first.locator(".set label").first()).toHaveText("المجموعة 1");
  await expect(first.locator(".set .unit").first()).toHaveText("كغ");
  // swap list: Arabic alternatives, Arabic buttons
  await first.locator(".alts summary").click();
  await expect(first.locator(".alts li button").first()).toHaveAttribute("data-use", "اختيار");
  await expect(first.locator(".alts li button span").first()).toHaveText("الهاك سكوات");
});

test("Arabic search understands gym words, missing hamzas and Arabic digits", async ({ page }) => {
  await toArabic(page);
  await page.click("#homeCreate");
  await page.click("#bdAdd");
  const top = async q => { await page.fill("#pkSearch", q); return page.locator(".pk-item .pk-name").first().innerText(); };
  expect(await top("سكوات")).toContain("السكوات الخلفي بالبار");
  expect(await top("منشار")).toContain("التجديف بالدمبل بذراع واحدة");
  expect(await top("بنش")).toContain("ضغط البنش بالبار");
  expect(await top("الرفعه الميته")).toContain("الرفعة الميتة");
  expect(await top("اكتاف جانبي")).toContain("الرفع الجانبي بالدمبل");
  expect(await top("lat pulldown")).toContain("السحب الأمامي");
  await expect(page.locator(".pk-item .pk-en").first()).toHaveText("Lat Pulldown");
});

test("numbers with signs and percentages read correctly inside Arabic text", async ({ page }) => {
  await toArabic(page);
  await proOn(page);
  await page.click("#modeSet"); await page.locator('.setrow[data-page="details"]').click();
  await page.fill("#pWeight", "80"); await page.fill("#pHeight", "180"); await page.fill("#pAge", "30");
  await page.click("#modeCal");
  const texts = await page.locator("#cal").evaluate(el => el.innerText);
  expect(texts).toMatch(/⁦[+−]\d+%⁩/);                     // e.g. ⁦+15%⁩, isolated left-to-right
  expect(await page.evaluate(() => t("share.chgSets", { name: "بنش", from: "3×8", to: "4×8" }))).toBe("بنش: ⁦3×8⁩ ← ⁦4×8⁩");
});

test("no English is left on any screen in Arabic (apart from brand and technical names)", async ({ page }) => {
  await toArabic(page);
  await proOn(page);
  const ALLOW = /^(Lift|Ledger|GitHub|LinkedIn|RPE|QR|BMR|MET|ACSM|JSON|CSV|json|csv|YouTube|Safari|README|index\.html|Mifflin-St|Jeor|Katch-McArdle|JM|T|V|name|weeks|days|exercises|sets)$/;
  const scan = async () => page.evaluate(allow => {
    const re = new RegExp(allow), out = [];
    const ok = s => (s.match(/[A-Za-z][A-Za-z.\-]*/g) || []).every(w => re.test(w.replace(/[.\-]+$/, "")));
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) { const el = w.currentNode.parentElement; if (!el || !el.offsetParent || el.closest('.en-name,.pk-en,#shLink,[lang="en"]')) continue;
      const s = w.currentNode.textContent.trim(); if (/[A-Za-z]{2,}/.test(s) && !ok(s)) out.push(s); }
    document.querySelectorAll("[placeholder],[aria-label],[data-use],[data-restore]").forEach(el => { if (!el.offsetParent) return;
      for (const a of ["placeholder", "aria-label", "data-use", "data-restore"]) { const v = el.getAttribute(a); if (v && /[A-Za-z]{2,}/.test(v) && !ok(v)) out.push(a + ": " + v); } });
    return out;
  }, ALLOW.source);
  const seen = [];
  const look = async () => seen.push(...await scan());
  await look();
  await page.locator('.home-card[data-id="upper-lower-4"]').click();
  await page.locator(".ex").first().locator(".alts summary").click();
  await page.locator(".rpe summary").click();
  await look();
  await page.click("#weekToggle"); await look();
  await page.click("#statsBtn"); await look();
  await page.click("#modeHome"); await look();
  for (const pg of ["language", "pro", "appearance", "workout", "app", "library", "data", "about", "details"]) { await page.click("#modeSet"); await page.locator(`.setrow[data-page="${pg}"]`).click(); await look(); }
  await page.fill("#pWeight", "80"); await page.fill("#pHeight", "180"); await page.fill("#pAge", "30");
  await page.click("#modeCal"); await page.evaluate(() => document.querySelectorAll("#cal details").forEach(d => { d.open = true; })); await look();
  await page.click("#modeHome"); await page.click("#homeCreate"); await look();
  await page.click("#bdAdd"); await look();
  await page.click("#pkAddOwn"); await look(); await page.click("#fxCancel");
  await page.locator(".pk-item").first().click(); await look();
  await page.fill("#bdName", "خطتي"); await page.click("#bdSave");
  await page.click('#homeContinue .own-acts [data-act="share"]'); await look();
  expect([...new Set(seen)]).toEqual([]);
});

test("a program built in Arabic reads in English on an English phone", async ({ page }) => {
  await toArabic(page);
  await page.click("#homeCreate"); await page.fill("#bdName", "خطة أحمد");
  await page.click("#bdAdd"); await page.fill("#pkSearch", "بنش"); await page.locator(".pk-item").first().click();
  await page.click("#bdSave");
  await page.click("#modeSet"); await page.locator('.setrow[data-page="language"]').click();
  await Promise.all([page.waitForEvent("load"), page.locator('#langSeg button[lang="en"]').click()]);
  await page.click("#homeGo");
  await expect(page.locator(".ex").first().locator("h3")).toHaveText("Barbell Bench Press");
  await expect(page.locator(".ex").first().locator(".cue")).toContainText("Shoulder blades");
});

test("Save program sits at the end of the builder, not stuck to the screen; demos have a round play button", async ({ page }) => {
  await page.click("#homeCreate");
  expect(await page.locator(".bd-foot").evaluate(el => getComputedStyle(el).position)).toBe("static");
  await page.click("#bdClose");
  await page.locator('.home-card[data-id="full-body-3"]').click();
  const btn = page.locator(".ex").first().locator(".playbtn");
  await expect(btn).toBeVisible();
  const box = await btn.boundingBox();
  expect(box && Math.round(box.width)).toBe(44);
  expect(await btn.evaluate(el => getComputedStyle(el).borderRadius)).toBe("50%");
  await expect(page.locator(".ex").first().locator("h3 a")).toHaveCount(0);   // the name itself is plain text now
});
