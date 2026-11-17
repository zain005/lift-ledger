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

test("Create my own program comes first on Home, highlighted", async ({ page }) => {
  const order = await page.evaluate(() => [...document.querySelectorAll("#home > *")].filter(e => !e.hidden && e.offsetParent).map(e => e.id || e.className));
  expect(order.indexOf("homeCreate")).toBeLessThan(order.indexOf("homeProgs"));
  await expect(page.locator("#homeCreate")).toHaveClass(/create-hl/);
  await expect(page.locator("#homeCreate")).toBeEnabled();
  // once a program is running, Continue sits above it
  await page.locator('.home-card[data-id="full-body-3"]').click();
  await page.click("#modeHome");
  const order2 = await page.evaluate(() => [...document.querySelectorAll("#home > *")].filter(e => e.offsetParent).map(e => e.id));
  expect(order2.indexOf("homeContinue")).toBeLessThan(order2.indexOf("homeCreate"));
});

test("build a program from scratch and train with it", async ({ page }) => {
  await page.click("#homeCreate");
  await expect(page.locator("#builder")).toBeVisible();
  await page.fill("#bdName", "Ahmed 2-day plan");
  await page.click("#bdDaysDec");                       // 3 -> 2 days
  await expect(page.locator(".bd-daytab")).toHaveCount(2);
  await page.fill("#bdDayName", "Upper");
  await addExercise(page, "bench press");
  await addExercise(page, "plank");
  await exCard(page, 1).locator(".inc").click();        // 3 -> 4 sets
  await exCard(page, 1).locator(".reps").fill("5-8");
  await page.locator(".bd-daytab").nth(1).click();
  await page.fill("#bdDayName", "Lower");
  await addExercise(page, "bulgarian");
  await page.click("#bdSave");
  await expect(page.locator("#builder")).toBeHidden();
  await expect(page.locator("#progMsg")).toContainText("Ahmed 2-day plan");
  await expect(page.locator("#homeGo")).toContainText("Wk 1 · Upper");
  await page.click("#homeGo");
  await expect(page.locator("#appTitle")).toHaveText("Ahmed 2-day plan");
  await expect(page.locator(".day")).toHaveCount(2);
  await expect(page.locator(".wk")).toHaveCount(8);
  const first = page.locator(".ex").first();
  await expect(first.locator("h3")).toContainText("Barbell Bench Press");
  await expect(first.locator(".sr")).toHaveText("4×5–8");
  await expect(first.locator(".set")).toHaveCount(4);
  await expect(page.locator(".ex").nth(1).locator(".sr")).toContainText("sec");
  await page.locator(".day").nth(1).click();
  await expect(page.locator(".ex").first().locator(".pill.side")).toHaveText("each side");
  // the saved file keeps muscles, so it can be shared and counted later
  const raw = await page.evaluate(() => JSON.parse(localStorage.getItem(PREFIX + "programs-custom"))[0]);
  expect(raw.days[0].exercises[0]).toMatchObject({ ref: "bench-press", sets: 4, reps: "5–8", primary: "chest" });
  expect(raw.days[0].exercises[1].timed).toBe(true);
});

test("the builder won't save an incomplete program, and says why", async ({ page }) => {
  await page.click("#homeCreate");
  await page.click("#bdSave");
  await expect(page.locator("#bdMsg")).toContainText("name");
  await expect(page.locator("#bdName")).toHaveClass(/bad/);
  await page.fill("#bdName", "Test");
  await addExercise(page, "squat");
  await page.click("#bdSave");
  await expect(page.locator("#bdMsg")).toContainText("Day 2 has no exercises");
  await expect(page.locator('.bd-daytab[aria-pressed="true"]')).toContainText("Day 2");
  await page.click("#bdDaysDec"); await page.click("#bdDaysDec");
  await page.locator(".bd-daytab").first().click();
  await exCard(page, 1).locator(".reps").fill("lots");
  await page.click("#bdSave");
  await expect(page.locator("#bdMsg")).toContainText("range");
  await expect(exCard(page, 1).locator(".reps")).toHaveClass(/bad/);
  await exCard(page, 1).locator(".sets").fill("0");
  await exCard(page, 1).locator(".reps").fill("10");
  await page.click("#bdSave");
  await expect(page.locator("#bdMsg")).toContainText("sets must be");
  await exCard(page, 1).locator(".sets").fill("3");
  await page.click("#bdSave");
  await expect(page.locator("#builder")).toBeHidden();
});

test("copy a ready-made program and change your copy", async ({ page }) => {
  await page.click("#homeCreate");
  await page.locator("#bdStartChips .chip", { hasText: "Upper / Lower" }).click();
  await expect(page.locator("#bdName")).toHaveValue("My Upper / Lower");
  await expect(page.locator(".bd-daytab")).toHaveCount(4);
  await expect(page.locator(".bd-ex")).toHaveCount(7);
  await exCard(page, 7).locator(".del").click();
  await expect(page.locator(".bd-ex")).toHaveCount(6);
  await page.click("#bdSave");
  await expect(page.locator(".home-card")).toHaveCount(4);
  await page.click("#homeGo");
  await expect(page.locator(".ex")).toHaveCount(6);
  // the original is untouched
  await page.click("#modeHome");
  await page.locator('.home-card[data-id="upper-lower-4"]').click();
  await expect(page.locator(".ex")).toHaveCount(7);
});

test("editing a program keeps logged weights on the right exercise", async ({ page }) => {
  await page.click("#homeCreate");
  await page.fill("#bdName", "Edit me");
  await page.click("#bdDaysDec"); await page.click("#bdDaysDec");
  await addExercise(page, "leg press");
  await addExercise(page, "leg extension");
  await page.click("#bdSave");
  await page.click("#homeGo");
  await page.locator(".ex").first().locator(".set input").first().fill("120");
  await page.click("#modeHome");
  await page.locator(".pcard-acts .linkbtn", { hasText: "Edit" }).click();
  await expect(page.locator("#bdTitle")).toHaveText("Edit program");
  await expect(page.locator("#bdStart")).toBeHidden();
  await exCard(page, 1).locator(".down").click();       // Leg Press moves to second place
  await addExercise(page, "seated leg curl");
  await page.click("#bdSave");
  await expect(page.locator("#progMsg")).toContainText("Saved your changes");
  await page.click("#homeGo");
  await expect(page.locator(".ex")).toHaveCount(3);
  await expect(page.locator(".ex").nth(1).locator("h3")).toContainText("Leg Press");
  await expect(page.locator(".ex").nth(1).locator(".set input").first()).toHaveValue("120");
  await expect(page.locator(".ex").first().locator(".set input").first()).toHaveValue("");
});

test("weekly sets per muscle add up as you build", async ({ page }) => {
  await page.click("#homeCreate");
  await addExercise(page, "barbell bench press");
  const row = name => page.locator(".bd-mrow", { has: page.locator(".mn", { hasText: new RegExp("^" + name + "$") }) }).locator(".mv");
  await expect(row("Chest")).toHaveText("3");
  await expect(row("Triceps")).toHaveText("1.5");
  await exCard(page, 1).locator(".inc").click();
  await expect(row("Chest")).toHaveText("4");
  await page.locator(".bd-daytab").nth(1).click();
  await addExercise(page, "cable fly");
  await expect(row("Chest")).toHaveText("7");
});

test("closing with unsaved work asks first, and removing a program keeps Home tidy", async ({ page }) => {
  await page.click("#homeCreate");
  await page.fill("#bdName", "Draft");
  page.once("dialog", d => d.dismiss());
  await page.click("#bdClose");
  await expect(page.locator("#builder")).toBeVisible();
  await page.click("#bdDaysDec"); await page.click("#bdDaysDec");
  await addExercise(page, "push-up");
  await page.click("#bdSave");
  await expect(page.locator(".home-card")).toHaveCount(4);
  page.once("dialog", d => d.accept());
  await page.locator(".pcard-acts .linkbtn", { hasText: "Remove" }).click();
  await expect(page.locator(".home-card")).toHaveCount(3);
  await expect(page.locator("#homeGo")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
