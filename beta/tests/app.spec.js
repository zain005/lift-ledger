// @ts-check
const { test, expect } = require("@playwright/test");

/** Collect page errors and missing strings; fail the test if there are any. */
const errors = new WeakMap();
test.beforeEach(async ({ page }) => {
  const list = []; errors.set(page, list);
  page.on("pageerror", e => list.push(e.message));
  await page.goto("./");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator("#home")).toBeVisible();
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
  expect(await page.evaluate(() => [...MISSING])).toEqual([]);
});

/* ---------- helpers ---------- */
const start = async (page, id = "full-body-3") => {
  await page.click("#modeHome");
  await page.locator(`.home-card[data-id="${id}"]`).click();
  await expect(page.locator(".ex").first()).toBeVisible();
};
const cont = async page => { await page.click("#homeGo"); await expect(page.locator(".ex").first()).toBeVisible(); };
/* The week selector is off the workout page for now; tests move between weeks the way the app does internally */
const week = (page, n) => page.evaluate(w => goWeek(w), n);
const day = (page, n) => page.locator(".day").nth(n - 1).click();
const settingsPage = async (page, name) => { await page.click("#modeSet"); await page.click(`.setrow[data-page="${name}"]`); };
const firstSet = page => page.locator(".ex").first().locator(".set input").first();
const noSideScroll = page => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
/* Weeks and calories live in Pro mode, which is off by default */
const proOn = async page => {
  if (await page.evaluate(() => SET.pro)) return;
  await settingsPage(page, "pro");
  await page.locator("#proToggle").click();
  await expect(page.locator("#proToggle")).toBeChecked();
};
const fillDetails = async page => {
  await proOn(page);
  await settingsPage(page, "details");
  await page.fill("#pWeight", "80"); await page.fill("#pHeight", "180"); await page.fill("#pAge", "30");
};

/* ---------- first launch and Home ---------- */

test("first launch is a clean Home page with nothing chosen", async ({ page }) => {
  await expect(page.locator("#homeHeadline")).toHaveText("Let's get you started");
  await expect(page.locator("#homeGo")).toHaveCount(0);
  await expect(page.locator(".home-card")).toHaveCount(3);
  await expect(page.locator(".home-card .act").first()).toHaveText("Start");
  await expect(page.locator("#homeCreate")).toBeVisible();
  await expect(page.locator("#modeWorkout")).toBeHidden();
  await expect(page.locator("#weekbar")).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem(PREFIX + "program"))).toBeNull();
  expect(await noSideScroll(page)).toBe(true);
});

test("calorie details start blank, with a setup prompt", async ({ page }) => {
  await proOn(page);
  await page.click("#modeCal");
  await expect(page.locator("#calSetup")).toBeVisible();
  await expect(page.locator("#calBody")).toBeHidden();
  await page.click("#calSetupBtn");
  for (const id of ["#pWeight", "#pHeight", "#pAge", "#pBf"]) await expect(page.locator(id)).toHaveValue("");
  await page.fill("#pWeight", "80"); await page.fill("#pHeight", "180"); await page.fill("#pAge", "30");
  await page.click("#detailsDone");
  await expect(page.locator("#calBody")).toBeVisible();
  const maint = Number((await page.locator("#tMaint").textContent()).replace(/,/g, ""));
  expect(maint).toBeGreaterThan(1500);
  expect(maint).toBeLessThan(3500);
});

test("starting a program opens it, and Home then offers Continue", async ({ page }) => {
  await start(page);
  await expect(page.locator("#appTitle")).toHaveText("Full Body");
  await expect(page.locator("#dayTitle")).toHaveText("Full Body A");
  await expect(page.locator(".day")).toHaveCount(3);
  expect(await noSideScroll(page)).toBe(true);
  for (const box of await page.locator(".set input").all()) await box.fill("20");
  await page.click("#dayDone");
  await page.click("#modeHome");
  await expect(page.locator("#homeHeadline")).toHaveText("Welcome back");
  await expect(page.locator("#homeGo")).toContainText("Next: Full Body B");
  await expect(page.locator('.home-card[data-id="full-body-3"] .act')).toHaveText("Open");
  await page.reload();
  await expect(page.locator("#home")).toBeVisible();              // every launch opens on Home
  await cont(page);
  await expect(page.locator("#dayTitle")).toHaveText("Full Body B");
});

test("the workout page has no week selector, just the days and Stats", async ({ page }) => {
  await start(page);
  await expect(page.locator("#weekbar")).toBeHidden();
  await expect(page.locator("#weekToggle")).toBeHidden();
  await expect(page.locator(".wk:visible")).toHaveCount(0);
  await expect(page.locator(".day")).toHaveCount(3);
  await expect(page.locator("#statsBtn")).toBeVisible();
});

test("Settings is a short list, and each item opens its own page", async ({ page }) => {
  await page.click("#modeSet");
  await expect(page.locator(".setrow")).toHaveCount(7);
  await expect(page.locator('.setrow[data-page="details"]')).toHaveCount(0);   // personal details belong to Pro
  await expect(page.locator("#settings .subpage:visible")).toHaveCount(0);
  await page.click('.setrow[data-page="appearance"]');
  await expect(page.locator('.subpage[data-page="appearance"]')).toBeVisible();
  await expect(page.locator("#setList")).toBeHidden();
  await page.click("#setBack");
  await expect(page.locator("#setList")).toBeVisible();
  await proOn(page);
  await page.click("#setBack");
  await expect(page.locator('.setrow[data-page="details"] small')).toHaveText("Not set yet");
});

/* ---------- logging ---------- */

test("makes no requests to other sites", async ({ page }) => {
  const external = [];
  const origin = new URL(page.url()).origin;
  page.on("request", r => { if (new URL(r.url()).origin !== origin) external.push(r.url()); });
  await page.reload();
  await proOn(page);
  await start(page);
  await page.click("#modeCal");
  await page.click("#modeSet");
  expect(external).toEqual([]);
});

test("logged weights and done days survive a reload", async ({ page }) => {
  await start(page);
  const first = page.locator(".ex").first().locator(".set input");
  await first.nth(0).fill("60");
  await first.nth(1).fill("62.5");
  await page.click("#dayDone");
  await expect(page.locator("#emptyWarn")).toBeVisible();
  await expect(page.locator(".set input.empty").first()).toBeVisible();
  await page.reload();
  await cont(page);
  // A done day with empty sets is where Continue goes
  await expect(page.locator("#dayTitle")).toHaveText("Full Body A");
  await expect(page.locator(".ex").first().locator(".set input").nth(1)).toHaveValue("62.5");
  await expect(page.locator(".day").first()).toHaveClass(/complete/);
});

test("a skipped session is marked missed", async ({ page }) => {
  await start(page);
  await day(page, 2);
  await page.click("#dayDone");
  await expect(page.locator(".day").first()).toHaveClass(/missed/);
});

test("last week's weights show on the next week", async ({ page }) => {
  await start(page);
  await firstSet(page).fill("80");
  await week(page, 2);
  await day(page, 1);
  await expect(page.locator(".ex").first().locator(".last")).toContainText("80");
  await expect(firstSet(page)).toHaveAttribute("placeholder", "80");   // last time's weight is the grey hint
  await expect(firstSet(page)).toHaveValue("");
});

test("the workout screen can keep the phone awake, and it's a setting", async ({ page }) => {
  await settingsPage(page, "workout");
  const tog = page.locator(".tog", { hasText: "Keep screen on" }).locator("input");
  await expect(tog).toBeChecked();
  await tog.click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem(PREFIX + "settings")).awake)).toBe(false);
});

test("swapping an exercise only changes that week", async ({ page }) => {
  await start(page);
  const card = page.locator(".ex").first();
  await card.locator(".alts summary").click();
  await card.locator(".alts li button").first().click();
  await expect(page.locator(".ex").first().locator(".tag")).toHaveText("Swapped");
  await week(page, 2);
  await day(page, 1);
  await expect(page.locator(".ex").first().locator(".tag")).toHaveCount(0);
});

test("each program keeps its own log", async ({ page }) => {
  await start(page);
  await firstSet(page).fill("50");
  await start(page, "push-pull-legs-6");
  await expect(page.locator("#appTitle")).toHaveText("Push Pull Legs");
  await expect(page.locator(".day")).toHaveCount(6);
  expect(await noSideScroll(page)).toBe(true);
  await expect(firstSet(page)).toHaveValue("");
  await page.click("#modeHome");
  await expect(page.locator('.home-card[data-id="full-body-3"] .act')).toHaveText("Resume");
  await page.locator('.home-card[data-id="full-body-3"]').click();
  await expect(firstSet(page)).toHaveValue("50");
});

test("stats page counts sessions", async ({ page }) => {
  await start(page);
  await page.click("#dayDone");
  await page.click("#statsBtn");
  await expect(page.locator("#progress .tile .v").first()).toContainText("1");
  await expect(page.locator(".sessgrid .cell")).toHaveCount(24);
  expect(await noSideScroll(page)).toBe(true);
  await page.click("#statsBtn");
  await expect(page.locator(".ex").first()).toBeVisible();
});

test("imports a valid program and rejects a broken one", async ({ page }) => {
  const program = {
    name: "Test Plan", weeks: 4,
    days: [{ name: "Only Day", exercises: [{ name: "Goblet Squat", sets: 2, reps: "10" }] }]
  };
  await page.setInputFiles("#progFile", { name: "p.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(program)) });
  await expect(page.locator("#progMsg")).toContainText("Imported");
  await expect(page.locator("#homeGo")).toContainText("Test Plan");
  await cont(page);
  await expect(page.locator("#appTitle")).toHaveText("Test Plan");
  expect(await page.evaluate(() => NW())).toBe(4);
  await expect(page.locator(".ex .set")).toHaveCount(2);

  await page.click("#modeHome");
  await page.setInputFiles("#progFile", { name: "bad.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ name: "Bad" })) });
  await expect(page.locator("#progMsg")).toHaveClass(/err/);
});

test("exports logged sets as CSV", async ({ page }) => {
  await start(page);
  await firstSet(page).fill("70");
  await settingsPage(page, "data");
  const [download] = await Promise.all([page.waitForEvent("download"), page.click("#expCsv")]);
  const text = require("fs").readFileSync(await download.path(), "utf8");
  expect(text.split("\n")[0]).toContain("program,week,phase");
  expect(text).toContain("Back Squat");
  expect(text).toContain(",70,kg,");
});

test("backup restores everything", async ({ page }) => {
  await start(page);
  await firstSet(page).fill("90");
  await settingsPage(page, "data");
  const [download] = await Promise.all([page.waitForEvent("download"), page.click("#expJson")]);
  const backup = require("fs").readFileSync(await download.path());
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await settingsPage(page, "data");
  page.once("dialog", d => d.accept());
  await page.setInputFiles("#impFile", { name: "b.json", mimeType: "application/json", buffer: backup });
  await page.waitForLoadState("load");
  await cont(page);
  await expect(firstSet(page)).toHaveValue("90");
});

test("settings hide tips and the calories tab", async ({ page }) => {
  await proOn(page);
  await start(page);
  await expect(page.locator(".cue").first()).toBeVisible();
  await settingsPage(page, "workout");
  await page.locator(".tog", { hasText: "Exercise tips" }).locator("input").click();
  await page.click("#setBack");
  await page.click('.setrow[data-page="app"]');
  await page.locator(".tog", { hasText: "Calories tab" }).locator("input").click();
  await expect(page.locator("#modeCal")).toBeHidden();
  await page.click("#modeWorkout");
  await expect(page.locator(".cue")).toHaveCount(0);
});

test("calorie calculator shows a balance once food is added", async ({ page }) => {
  await fillDetails(page);
  await page.click("#modeCal");
  await expect(page.locator("#cBand")).toHaveText("kcal maintenance");
  await page.selectOption("#uSel", "rice");
  await page.fill("#uAmt", "500");
  await page.click("#uAdd");
  await expect(page.locator("#cPct")).toHaveText(/^[−+±]?\d+%$/);
  expect(await noSideScroll(page)).toBe(true);
});

/* ---------- dark mode, translation groundwork, permanent ids ---------- */

const bodyBg = page => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test("dark mode can be chosen in settings and is remembered", async ({ page }) => {
  const light = await bodyBg(page);
  await settingsPage(page, "appearance");
  await page.locator('#themeSeg button[data-th="dark"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await bodyBg(page)).not.toBe(light);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await settingsPage(page, "appearance");
  await page.locator('#themeSeg button[data-th="light"]').click();
  expect(await bodyBg(page)).toBe(light);
});

test("'Match phone' follows the phone's dark setting", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "system");
  expect(await bodyBg(page)).toBe("rgb(15, 15, 14)");
  await page.emulateMedia({ colorScheme: "light" });
  expect(await bodyBg(page)).toBe("rgb(246, 245, 242)");
});

test("every screen's text comes from the strings file", async ({ page }) => {
  await proOn(page);
  await page.click("#modeCal");
  await start(page);
  await firstSet(page).fill("40");
  await page.click("#dayDone");
  await page.click("#statsBtn");
  await fillDetails(page);
  await page.click("#modeCal");
  await page.selectOption("#uSel", "egg"); await page.fill("#uAmt", "3"); await page.click("#uAdd");
  await page.selectOption("#aSel", "steps"); await page.fill("#aV1", "5000"); await page.click("#aAdd");
  await page.click("#modeWorkout"); await page.click("#weekToggle");
  for (const p of ["language", "pro", "appearance", "workout", "app", "details", "library", "data"]) { await settingsPage(page, p); }
  await page.click("#modeHome");
});

test("Arabic-Indic digits typed on an Arabic keyboard are accepted", async ({ page }) => {
  await start(page);
  await firstSet(page).fill("٦٢٫٥");
  await expect(firstSet(page)).toHaveValue("62.5");
  await page.reload();
  await cont(page);
  await expect(firstSet(page)).toHaveValue("62.5");
});

test("right-to-left layout fits the screen on every page", async ({ page }) => {
  await start(page);
  await page.evaluate(() => { document.documentElement.dir = "rtl"; renderAll(); });
  const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(await fits()).toBe(true);
  await page.click("#statsBtn"); expect(await fits()).toBe(true);
  await page.click("#modeHome"); expect(await fits()).toBe(true);
  await fillDetails(page); expect(await fits()).toBe(true);
  await page.click("#modeCal"); expect(await fits()).toBe(true);
  await page.click("#modeSet"); expect(await fits()).toBe(true);
});

test("logs saved by the previous version are upgraded without losing anything", async ({ page }) => {
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem(PREFIX + "program", JSON.stringify("full-body-3"));
    localStorage.setItem(PREFIX + "log-full-body-3", JSON.stringify({
      w1: { "0-0": { s: ["55", "57.5", "60"] }, "0-3": { s: ["40", "", ""], alt: "Stiff-leg deadlift" }, done0: true, "1-2": { s: ["30", "", ""] } }
    }));
  });
  await page.reload();
  await cont(page);
  await week(page, 1);
  await day(page, 1);
  await expect(page.locator(".day").first()).toHaveClass(/complete/);
  await expect(page.locator(".ex").nth(0).locator(".set input").nth(2)).toHaveValue("60");
  await expect(page.locator(".ex").nth(3)).toContainText("Stiff-leg deadlift");
  await day(page, 2);
  await expect(page.locator(".ex").nth(2).locator(".set input").first()).toHaveValue("30");
  const saved = await page.evaluate(() => ({
    log: JSON.parse(localStorage.getItem(PREFIX + "log-full-body-3")),
    backup: localStorage.getItem(PREFIX + "log-v1-backup-full-body-3") !== null
  }));
  expect(saved.log.v).toBe(2);
  expect(saved.log.w1.ex["fb-a1"].s).toEqual(["55", "57.5", "60"]);
  expect(saved.log.w1.done["fb-a"]).toBe(true);
  expect(saved.backup).toBe(true);
});

test("a backup restores whichever version made it", async ({ page }) => {
  const backup = { app: "lift-ledger", format: 1, data: {
    "ll-program": "upper-lower-4",
    "ll-log-upper-lower-4": { w1: { "0-0": { s: ["70", "70", "70"] } } },
    "ll-settings": { theme: "dark" }
  } };
  await settingsPage(page, "data");
  page.once("dialog", d => d.accept());
  await page.setInputFiles("#impFile", { name: "b.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) });
  await page.waitForLoadState("load");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await cont(page);
  await expect(page.locator("#appTitle")).toHaveText("Upper / Lower");
  await week(page, 1);
  await day(page, 1);
  await expect(firstSet(page)).toHaveValue("70");
});

test("the test version and the main app keep separate data", async ({ page }) => {
  await start(page);
  await firstSet(page).fill("99");
  const { keys, prefix } = await page.evaluate(() => ({ keys: Object.keys(localStorage), prefix: PREFIX }));
  expect(prefix).toBe(new URL(page.url()).pathname.includes("/beta/") ? "llb-" : "ll-");
  expect(keys.length).toBeGreaterThan(0);
  expect(keys.every(k => k.startsWith(prefix))).toBe(true);
});

test("language choice sits at the top of Settings", async ({ page }) => {
  await page.click("#modeSet");
  await expect(page.locator(".setrow").first()).toContainText("Language");
  await page.locator(".setrow").first().click();
  await expect(page.locator("#langSeg button")).toHaveCount(2);
  await expect(page.locator('#langSeg button[lang="en"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('#langSeg button[lang="ar"]')).toBeDisabled();
  await expect(page.locator('#langSeg button[lang="ar"]')).toContainText("العربية");
});
