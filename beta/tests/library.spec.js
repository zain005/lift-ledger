// @ts-check
const { test, expect } = require("@playwright/test");

const errors = new WeakMap();
test.beforeEach(async ({ page }) => {
  const list = []; errors.set(page, list);
  page.on("pageerror", e => list.push(e.message));
  await page.goto("./");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('.home-card[data-id="full-body-3"]').click();
  await expect(page.locator(".ex").first()).toBeVisible();
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
  expect(await page.evaluate(() => [...MISSING])).toEqual([]);
});

const openLibrary = async page => { await page.click("#modeSet"); await page.click('.setrow[data-page="library"]'); await page.click("#libBrowse"); await expect(page.locator("#picker")).toBeVisible(); };

test("the library is complete and consistent", async ({ page }) => {
  const r = await page.evaluate(() => {
    const ex = LIBRARY.exercises, ids = new Set(ex.map(e => e.id));
    const perMuscle = {}; LIBRARY.muscles.forEach(m => { perMuscle[m] = ex.filter(e => e.primary === m || (e.secondary || []).includes(m)).length; });
    const progRefs = PROGRAMS.flatMap(p => p.phases.flatMap(ph => ph.days.flat().map(e => e.ref)));
    LIBRARY.muscles.forEach(m => t("muscle." + m)); LIBRARY.equipment.forEach(q => t("equip." + q));
    return { n: ex.length, unique: ids.size === ex.length, perMuscle, unknownRefs: progRefs.filter(id => !ids.has(id)),
      bad: ex.filter(e => !LIBRARY.muscles.includes(e.primary) || !LIBRARY.equipment.includes(e.equipment) || !e.reps || !e.cue).map(e => e.id) };
  });
  expect(r.n).toBeGreaterThanOrEqual(150);
  expect(r.unique).toBe(true);
  expect(r.bad).toEqual([]);
  expect(r.unknownRefs).toEqual([]);
  for (const [m, n] of Object.entries(r.perMuscle)) expect(n, m).toBeGreaterThanOrEqual(2);
});

test("search finds exercises by name, nickname and muscle", async ({ page }) => {
  await openLibrary(page);
  await page.fill("#pkSearch", "rdl");
  await expect(page.locator(".pk-item").first()).toContainText("Romanian Deadlift");
  await page.fill("#pkSearch", "skullcrusher");
  await expect(page.locator(".pk-item").first()).toContainText("Skull Crusher");
  await page.fill("#pkSearch", "calves smith");
  await expect(page.locator(".pk-item")).toHaveCount(1);
  await expect(page.locator(".pk-item")).toContainText("Smith Machine Calf Raise");
  await page.fill("#pkSearch", "zzzz");
  await expect(page.locator(".pk-list .none")).toBeVisible();
});

test("muscle and equipment filters narrow the list", async ({ page }) => {
  await openLibrary(page);
  await page.locator("#pkMuscles .chip", { hasText: "Calves" }).click();
  const n = await page.locator(".pk-item").count();
  expect(n).toBeGreaterThanOrEqual(5);
  await page.selectOption("#pkEquip", "smith");
  await expect(page.locator(".pk-item")).toHaveCount(1);
  await page.click("#pkClose");
  await expect(page.locator("#picker")).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("swap an exercise for any library exercise, starting with the same muscle", async ({ page }) => {
  const card = page.locator(".ex").first();
  await card.locator(".alts summary").click();
  await card.locator(".libbtn").click();
  await expect(page.locator('#pkMuscles .chip[aria-pressed="true"]')).toHaveText("Quads");
  const inView = await page.evaluate(() => { const b = document.getElementById("pkMuscles").getBoundingClientRect(), c = document.querySelector('#pkMuscles .chip[aria-pressed="true"]').getBoundingClientRect(); return c.left >= b.left - 1 && c.right <= b.right + 1; });
  expect(inView).toBe(true);
  await page.fill("#pkSearch", "pendulum");
  await page.locator(".pk-item").first().click();
  await expect(page.locator("#picker")).toBeHidden();
  await expect(page.locator(".ex").first().locator("h3")).toContainText("Pendulum Squat");
  await expect(page.locator(".ex").first().locator(".swapped")).toContainText("Back Squat");
  await page.reload();
  await page.click("#homeGo");
  await expect(page.locator(".ex").first().locator("h3")).toContainText("Pendulum Squat");
  await page.evaluate(() => goWeek(2)); await page.locator(".day").first().click();
  await expect(page.locator(".ex").first().locator("h3")).toContainText("Back Squat");
});

test("add, find, edit and delete my own exercise", async ({ page }) => {
  await openLibrary(page);
  await page.click("#pkAddOwn");
  await page.click("#fxSave");
  await expect(page.locator("#fxMsg")).toContainText("name");
  await page.fill("#fxName", "Landmine Squat");
  await page.selectOption("#fxPrimary", "quads");
  await expect(page.locator('#fxSecondary .chip[data-m="quads"]')).toBeHidden();
  await page.fill("#fxReps", "abc");
  await page.click("#fxSave");
  await expect(page.locator("#fxMsg")).toContainText("range");
  await page.fill("#fxReps", "٨-١٢");
  await page.locator("#fxSecondary .chip", { hasText: "Glutes" }).click();
  await page.click("#fxSave");
  await expect(page.locator("#pkForm")).toBeHidden();
  await page.locator("#pkMuscles .chip", { hasText: "My exercises" }).click();
  await expect(page.locator(".pk-item")).toHaveCount(1);
  await expect(page.locator(".pk-item")).toContainText("Landmine Squat");
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem(PREFIX + "exercises-custom"))[0]);
  expect(saved).toMatchObject({ name: "Landmine Squat", primary: "quads", secondary: ["glutes"], reps: "8–12", custom: true });
  // glutes filter finds it through its secondary muscle; search finds it too
  await page.reload(); await openLibrary(page);
  await page.fill("#pkSearch", "landmine squat");
  await page.locator(".pk-item", { hasText: "Landmine Squat" }).click();
  await expect(page.locator("#pkForm")).toBeVisible();
  await page.fill("#fxName", "Landmine Front Squat");
  await page.click("#fxSave");
  await page.fill("#pkSearch", "landmine front");
  await expect(page.locator(".pk-item", { hasText: "Landmine Front Squat" })).toHaveCount(1);
  await page.locator(".pk-item", { hasText: "Landmine Front Squat" }).click();
  page.once("dialog", d => d.accept());
  await page.click("#fxDelete");
  await page.fill("#pkSearch", "landmine");
  await expect(page.locator(".pk-item", { hasText: "Landmine Press" })).toHaveCount(1);
  await expect(page.locator(".pk-item", { hasText: "Landmine Front Squat" })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem(PREFIX + "exercises-custom")))).toEqual([]);
});

test("picking my new exercise from Swap uses it straight away", async ({ page }) => {
  const card = page.locator(".ex").first();
  await card.locator(".alts summary").click();
  await card.locator(".libbtn").click();
  await page.click("#pkAddOwn");
  await page.fill("#fxName", "Safety Bar Squat");
  await page.fill("#fxReps", "6-8");
  await page.click("#fxSave");
  await expect(page.locator("#picker")).toBeHidden();
  await expect(page.locator(".ex").first().locator("h3")).toContainText("Safety Bar Squat");
});
