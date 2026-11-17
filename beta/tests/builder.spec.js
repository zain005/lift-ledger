// @ts-check
const { test, expect } = require("@playwright/test");

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

const addExercise = async (page, query) => {
  await page.click("#bdAdd");
  await page.fill("#pkSearch", query);
  await page.locator(".pk-item").first().click();
  await expect(page.locator("#picker")).toBeHidden();
};
const exCard = (page, n) => page.locator(".bd-ex").nth(n - 1);
const setBox = (page, ex, s) => exCard(page, ex).locator(".bd-set input").nth(s - 1);

test("Create my own program comes first on Home, highlighted", async ({ page }) => {
  const order = await page.evaluate(() => [...document.querySelectorAll("#home > *")].filter(e => e.offsetParent).map(e => e.id));
  expect(order.indexOf("homeCreate")).toBeLessThan(order.indexOf("homeProgs"));
  await expect(page.locator("#homeCreate")).toHaveClass(/create-hl/);
  await page.locator('.home-card[data-id="full-body-3"]').click();
  await page.click("#modeHome");
  const order2 = await page.evaluate(() => [...document.querySelectorAll("#home > *")].filter(e => e.offsetParent).map(e => e.id));
  expect(order2.indexOf("homeContinue")).toBeLessThan(order2.indexOf("homeCreate"));
});

test("the builder starts simple: a name, one day, no week or preset controls", async ({ page }) => {
  await page.click("#homeCreate");
  await expect(page.locator(".bd-daytab:not(.add)")).toHaveCount(1);
  await expect(page.locator("#bdAddDay")).toBeVisible();
  await expect(page.locator("#builder")).not.toContainText("Start from");
  await expect(page.locator("#bdWeeks, #bdWeeksInc, #bdStart, #bdStartChips")).toHaveCount(0);
  await expect(page.locator("#bdDelDay")).toBeHidden();
  for (let i = 0; i < 6; i++) await page.click("#bdAddDay");
  await expect(page.locator(".bd-daytab:not(.add)")).toHaveCount(7);
  await expect(page.locator("#bdAddDay")).toHaveCount(0);       // 7 is the most
  await page.click("#bdDelDay");
  await expect(page.locator(".bd-daytab:not(.add)")).toHaveCount(6);
});

test("the exercise list opens without the keyboard", async ({ page }) => {
  await page.click("#homeCreate");
  await page.click("#bdAdd");
  await expect(page.locator("#picker")).toBeVisible();
  expect(await page.evaluate(() => document.activeElement && document.activeElement.id)).not.toBe("pkSearch");
});

test("each exercise starts with one set box; + adds sets, − removes them", async ({ page }) => {
  await page.click("#homeCreate");
  await addExercise(page, "barbell bench press");
  await expect(exCard(page, 1).locator(".bd-set")).toHaveCount(1);
  await expect(setBox(page, 1, 1)).toHaveValue("6");
  await setBox(page, 1, 1).fill("12");
  await exCard(page, 1).locator(".setbtn.plus").click();
  await expect(setBox(page, 1, 2)).toHaveValue("12");           // a new set copies the last one
  await setBox(page, 1, 2).fill("10");
  await exCard(page, 1).locator(".setbtn.plus").click();
  await setBox(page, 1, 3).fill("8");
  await exCard(page, 1).locator(".setbtn.plus").click();
  await exCard(page, 1).locator(".setbtn.minus").click();
  await expect(exCard(page, 1).locator(".bd-set")).toHaveCount(3);
});

test("build a program and train with it, set by set", async ({ page }) => {
  await page.click("#homeCreate");
  await page.fill("#bdName", "Ahmed plan");
  await page.fill("#bdDayName", "Upper");
  await addExercise(page, "barbell bench press");
  await setBox(page, 1, 1).fill("12");
  await exCard(page, 1).locator(".setbtn.plus").click(); await setBox(page, 1, 2).fill("10");
  await exCard(page, 1).locator(".setbtn.plus").click(); await setBox(page, 1, 3).fill("8");
  await addExercise(page, "plank");
  await page.click("#bdAddDay");
  await page.fill("#bdDayName", "Lower");
  await addExercise(page, "bulgarian");
  await page.click("#bdSave");
  await expect(page.locator("#builder")).toBeHidden();
  await expect(page.locator("#homeGo")).toContainText("Your program");
  await expect(page.locator("#homeGo")).toContainText("Ahmed plan");
  await page.click("#homeGo");
  await expect(page.locator(".day")).toHaveCount(2);
  const first = page.locator(".ex").first();
  await expect(first.locator(".set")).toHaveCount(3);
  await expect(first.locator(".set label").nth(0)).toHaveText("Set 1 · 12");
  await expect(first.locator(".set label").nth(2)).toHaveText("Set 3 · 8");
  await expect(page.locator(".ex").nth(1).locator(".sr")).toContainText("sec");
  await page.locator(".day").nth(1).click();
  await expect(page.locator(".ex").first().locator(".pill.side")).toHaveText("each side");
  const raw = await page.evaluate(() => JSON.parse(localStorage.getItem(PREFIX + "programs-custom"))[0]);
  expect(raw.days[0].exercises[0]).toMatchObject({ ref: "bench-press", sets: 3, setReps: ["12", "10", "8"], primary: "chest" });
});

test("Home shows my program first, with Edit and Delete right below it", async ({ page }) => {
  await page.click("#homeCreate");
  await page.fill("#bdName", "Mine");
  await addExercise(page, "push-up");
  await page.click("#bdSave");
  const order = await page.evaluate(() => [...document.querySelectorAll("#homeContinue > *")].map(e => e.id || e.className));
  expect(order).toEqual(["homeGo", "own-acts"]);
  await expect(page.locator('.own-acts [data-act="edit"]')).toHaveText("Edit program");
  await expect(page.locator('.own-acts [data-act="delete"]')).toHaveText("Delete program");
  page.once("dialog", d => d.accept());
  await page.click('.own-acts [data-act="delete"]');
  await expect(page.locator("#homeGo")).toHaveCount(0);
  await expect(page.locator(".home-card")).toHaveCount(3);
});

test("the builder won't save an incomplete program, and says why", async ({ page }) => {
  await page.click("#homeCreate");
  await page.click("#bdSave");
  await expect(page.locator("#bdMsg")).toContainText("name");
  await expect(page.locator("#bdName")).toHaveClass(/bad/);
  await page.fill("#bdName", "Test");
  await addExercise(page, "back squat");
  await page.click("#bdAddDay");
  await page.click("#bdSave");
  await expect(page.locator("#bdMsg")).toContainText("Day 2 has no exercises");
  await page.click("#bdDelDay");
  await exCard(page, 1).locator(".setbtn.plus").click();
  await setBox(page, 1, 2).fill("");
  await page.click("#bdSave");
  await expect(page.locator("#bdMsg")).toContainText("set 2");
  await expect(setBox(page, 1, 2)).toHaveClass(/bad/);
  await setBox(page, 1, 2).fill("8-10");
  await page.click("#bdSave");
  await expect(page.locator("#builder")).toBeHidden();
});

test("a manual exercise can skip muscle and equipment, and be edited from the builder", async ({ page }) => {
  await page.click("#homeCreate");
  await page.fill("#bdName", "Manual");
  await page.click("#bdAdd");
  await page.click("#pkAddOwn");
  await page.fill("#fxName", "Sled push");
  await page.fill("#fxReps", "20");
  await page.click("#fxSave");
  await expect(page.locator("#picker")).toBeHidden();
  await expect(exCard(page, 1)).toContainText("Sled push");
  await exCard(page, 1).locator(".bd-edit").click();
  await expect(page.locator("#pkForm")).toBeVisible();
  await page.fill("#fxName", "Heavy sled push");
  await page.selectOption("#fxPrimary", "quads");
  await page.click("#fxSave");
  await expect(page.locator("#picker")).toBeHidden();
  await expect(exCard(page, 1)).toContainText("Heavy sled push");
  await expect(exCard(page, 1)).toContainText("Quads");
  await page.click("#bdSave");
  await page.click("#homeGo");
  await expect(page.locator(".ex").first()).toContainText("Heavy sled push");
});

test("editing a program keeps logged weights on the right exercise", async ({ page }) => {
  await page.click("#homeCreate");
  await page.fill("#bdName", "Edit me");
  await addExercise(page, "leg press");
  await addExercise(page, "leg extension");
  await page.click("#bdSave");
  await page.click("#homeGo");
  await page.locator(".ex").first().locator(".set input").first().fill("120");
  await page.click("#modeHome");
  await page.click('.own-acts [data-act="edit"]');
  await expect(page.locator("#bdTitle")).toHaveText("Edit program");
  await exCard(page, 1).locator(".down").click();
  await addExercise(page, "seated leg curl");
  await page.click("#bdSave");
  await expect(page.locator("#progMsg")).toContainText("Saved your changes");
  await page.click("#homeGo");
  await expect(page.locator(".ex")).toHaveCount(3);
  await expect(page.locator(".ex").nth(1).locator("h3")).toContainText("Leg Press");
  await expect(page.locator(".ex").nth(1).locator(".set input").first()).toHaveValue("120");
});

test("weekly sets per muscle add up as you build", async ({ page }) => {
  await page.click("#homeCreate");
  await addExercise(page, "barbell bench press");
  const row = name => page.locator(".bd-mrow", { has: page.locator(".mn", { hasText: new RegExp("^" + name + "$") }) }).locator(".mv");
  await expect(row("Chest")).toHaveText("1");
  await expect(row("Triceps")).toHaveText("0.5");
  await exCard(page, 1).locator(".setbtn.plus").click();
  await exCard(page, 1).locator(".setbtn.plus").click();
  await expect(row("Chest")).toHaveText("3");
  await page.click("#bdAddDay");
  await addExercise(page, "cable fly");
  await expect(row("Chest")).toHaveText("4");
});

test("closing with unsaved work asks first", async ({ page }) => {
  await page.click("#homeCreate");
  await page.fill("#bdName", "Draft");
  page.once("dialog", d => d.dismiss());
  await page.click("#bdClose");
  await expect(page.locator("#builder")).toBeVisible();
  page.once("dialog", d => d.accept());
  await page.click("#bdClose");
  await expect(page.locator("#builder")).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
