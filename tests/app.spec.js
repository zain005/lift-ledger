// @ts-check
const { test, expect } = require("@playwright/test");

/** Collect page errors and fail the test if there are any. */
const errors = new WeakMap();
test.beforeEach(async ({ page }) => {
  const list = []; errors.set(page, list);
  page.on("pageerror", e => list.push(e.message));
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator(".ex").first()).toBeVisible();
});

test.afterEach(async ({ page }) => { expect(errors.get(page)).toEqual([]); });

const noSideScroll = page => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test("loads the default program on a phone-sized screen", async ({ page }) => {
  await expect(page.locator("#appTitle")).toHaveText("Full Body");
  await expect(page.locator("#dayTitle")).toHaveText("Wk 1 · Full Body A");
  await expect(page.locator(".day")).toHaveCount(3);
  await expect(page.locator(".wk:not(.prog)")).toHaveCount(8);
  expect(await noSideScroll(page)).toBe(true);
});

test("makes no requests to other sites", async ({ page }) => {
  const external = [];
  const origin = new URL(page.url()).origin;
  page.on("request", r => { if (new URL(r.url()).origin !== origin) external.push(r.url()); });
  await page.reload();
  await expect(page.locator(".ex").first()).toBeVisible();
  await page.click("#modeCal");
  await page.click("#modeSet");
  expect(external).toEqual([]);
});

test("logged weights and done days survive a reload", async ({ page }) => {
  const first = page.locator(".ex").first().locator(".set input");
  await first.nth(0).fill("60");
  await first.nth(1).fill("62.5");
  await page.click("#dayDone");
  await expect(page.locator("#emptyWarn")).toBeVisible();
  await expect(page.locator(".set input.empty").first()).toBeVisible();
  await page.reload();
  // A done day with empty sets is where the app reopens
  await expect(page.locator("#dayTitle")).toHaveText("Wk 1 · Full Body A");
  await expect(page.locator(".ex").first().locator(".set input").nth(1)).toHaveValue("62.5");
  await expect(page.locator(".day").first()).toHaveClass(/complete/);
});

test("a skipped session is marked missed", async ({ page }) => {
  await page.locator(".day").nth(1).click();
  await page.click("#dayDone");
  await expect(page.locator(".day").first()).toHaveClass(/missed/);
});

test("last week's weights show on the next week", async ({ page }) => {
  await page.locator(".ex").first().locator(".set input").first().fill("80");
  await page.locator(".wk").nth(1).click();
  await page.locator(".day").first().click();
  await expect(page.locator(".ex").first().locator(".last")).toContainText("80");
});

test("swapping an exercise only changes that week", async ({ page }) => {
  const card = page.locator(".ex").first();
  await card.locator(".alts summary").click();
  await card.locator(".alts li button").first().click();
  await expect(page.locator(".ex").first().locator(".tag")).toHaveText("Swapped");
  await page.locator(".wk").nth(1).click();
  await page.locator(".day").first().click();
  await expect(page.locator(".ex").first().locator(".tag")).toHaveCount(0);
});

test("each program keeps its own log", async ({ page }) => {
  await page.locator(".ex").first().locator(".set input").first().fill("50");
  await page.click("#modeSet");
  await page.locator(".pcard").nth(2).click();
  await page.click("#modeWorkout");
  await expect(page.locator("#appTitle")).toHaveText("Push Pull Legs");
  await expect(page.locator(".day")).toHaveCount(6);
  expect(await noSideScroll(page)).toBe(true);
  await expect(page.locator(".ex").first().locator(".set input").first()).toHaveValue("");
  await page.click("#modeSet");
  await page.locator(".pcard").nth(0).click();
  await page.click("#modeWorkout");
  await expect(page.locator(".ex").first().locator(".set input").first()).toHaveValue("50");
});

test("stats page counts sessions", async ({ page }) => {
  await page.click("#dayDone");
  await page.click(".wk.prog");
  await expect(page.locator("#progress .tile .v").first()).toContainText("1");
  await expect(page.locator(".sessgrid .cell")).toHaveCount(24);
  expect(await noSideScroll(page)).toBe(true);
});

test("imports a valid program and rejects a broken one", async ({ page }) => {
  await page.click("#modeSet");
  const program = {
    name: "Test Plan", weeks: 4,
    days: [{ name: "Only Day", exercises: [{ name: "Goblet Squat", sets: 2, reps: "10" }] }]
  };
  await page.setInputFiles("#progFile", { name: "p.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(program)) });
  await expect(page.locator("#progMsg")).toContainText("Imported");
  await page.click("#modeWorkout");
  await expect(page.locator("#appTitle")).toHaveText("Test Plan");
  await expect(page.locator(".wk:not(.prog)")).toHaveCount(4);
  await expect(page.locator(".ex .set")).toHaveCount(2);

  await page.click("#modeSet");
  await page.setInputFiles("#progFile", { name: "bad.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ name: "Bad" })) });
  await expect(page.locator("#progMsg")).toHaveClass(/err/);
});

test("exports logged sets as CSV", async ({ page }) => {
  await page.locator(".ex").first().locator(".set input").first().fill("70");
  await page.click("#modeSet");
  const [download] = await Promise.all([page.waitForEvent("download"), page.click("#expCsv")]);
  const text = require("fs").readFileSync(await download.path(), "utf8");
  expect(text.split("\n")[0]).toContain("program,week,phase");
  expect(text).toContain("Back Squat");
  expect(text).toContain(",70,kg,");
});

test("backup restores everything", async ({ page }) => {
  await page.locator(".ex").first().locator(".set input").first().fill("90");
  await page.click("#modeSet");
  const [download] = await Promise.all([page.waitForEvent("download"), page.click("#expJson")]);
  const backup = require("fs").readFileSync(await download.path());
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.click("#modeSet");
  page.once("dialog", d => d.accept());
  await page.setInputFiles("#impFile", { name: "b.json", mimeType: "application/json", buffer: backup });
  await page.waitForLoadState("load");
  await expect(page.locator(".ex").first().locator(".set input").first()).toHaveValue("90");
});

test("settings hide tips and the calories tab", async ({ page }) => {
  await expect(page.locator(".cue").first()).toBeVisible();
  await page.click("#modeSet");
  await page.locator(".tog", { hasText: "Exercise tips" }).locator("input").click();
  await page.locator(".tog", { hasText: "Calories tab" }).locator("input").click();
  await expect(page.locator("#modeCal")).toBeHidden();
  await page.click("#modeWorkout");
  await expect(page.locator(".cue")).toHaveCount(0);
});

test("calorie calculator shows maintenance, then a balance once food is added", async ({ page }) => {
  await page.click("#modeCal");
  await expect(page.locator("#cBand")).toHaveText("kcal maintenance");
  const maint = Number((await page.locator("#tMaint").textContent()).replace(/,/g, ""));
  expect(maint).toBeGreaterThan(1500);
  expect(maint).toBeLessThan(3500);
  await page.selectOption("#uSel", "rice");
  await page.fill("#uAmt", "500");
  await page.click("#uAdd");
  await expect(page.locator("#cPct")).toHaveText(/^[−+±]?\d+%$/);
  expect(await noSideScroll(page)).toBe(true);
});
