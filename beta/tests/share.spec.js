// @ts-check
const { test, expect } = require("@playwright/test");

/* The trainer and the trainee each get their own browser (separate storage), like two phones. */
const errors = new WeakMap();
const watch = page => { const list = []; errors.set(page, list); page.on("pageerror", e => list.push(e.message)); return page; };
const clean = async page => {
  expect(errors.get(page)).toEqual([]);
  expect(await page.evaluate(() => [...MISSING])).toEqual([]);
};
async function phone(browser, baseURL) {
  const ctx = await browser.newContext({ baseURL });
  const page = watch(await ctx.newPage());
  await page.goto("./");
  await expect(page.locator("#home")).toBeVisible();
  return page;
}
const addExercise = async (page, query) => {
  await page.click("#bdAdd");
  await page.fill("#pkSearch", query);
  await page.locator(".pk-item").first().click();
  await expect(page.locator("#picker")).toBeHidden();
};
const setBox = (page, ex, s) => page.locator(".bd-ex").nth(ex - 1).locator(".bd-set input").nth(s - 1);

async function buildProgram(page) {
  await page.click("#homeCreate");
  await page.fill("#bdName", "Coach Sara plan");
  await page.fill("#bdDayName", "Upper");
  await addExercise(page, "barbell bench press");
  await setBox(page, 1, 1).fill("12");
  await page.locator(".bd-ex").first().locator(".setbtn.plus").click(); await setBox(page, 1, 2).fill("10");
  await page.locator(".bd-ex").first().locator(".setbtn.plus").click(); await setBox(page, 1, 3).fill("8");
  await page.click("#bdAdd"); await page.click("#pkAddOwn");
  await page.fill("#fxName", "Sled push"); await page.fill("#fxReps", "20"); await page.click("#fxSave");
  await expect(page.locator("#picker")).toBeHidden();
  await page.click("#bdAddDay");
  await page.fill("#bdDayName", "Lower");
  await addExercise(page, "bulgarian");
  await page.click("#bdSave");
  await expect(page.locator("#builder")).toBeHidden();
}
async function shareLink(page) {
  await page.click('.own-acts [data-act="share"]');
  await expect(page.locator("#share")).toBeVisible();
  const link = await page.locator("#shLink").inputValue();
  await page.click("#shClose");
  return link;
}

test("a trainer shares a program and the trainee gets exactly the same program", async ({ browser, baseURL }) => {
  const coach = await phone(browser, baseURL);
  await buildProgram(coach);
  await coach.click('.own-acts [data-act="share"]');
  await expect(coach.locator("#shName")).toHaveText("Coach Sara plan");
  await expect(coach.locator("#shSummary")).toHaveText("2 days a week · 3 exercises");
  await expect(coach.locator("#shQr svg")).toBeVisible();
  const link = await coach.locator("#shLink").inputValue();
  expect(link).toMatch(/#p=2\.[\w-]+\.[0-9a-z]+$/);
  expect(link.length).toBeLessThan(1200);
  expect(await coach.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const trainee = await phone(browser, baseURL);
  await trainee.goto(link);
  await expect(trainee.locator("#importSheet")).toBeVisible();
  await expect(trainee.locator("#imName")).toHaveText("Coach Sara plan");
  await expect(trainee.locator("#imDays li")).toHaveCount(2);
  await expect(trainee.locator("#imDays li").first()).toContainText("Sled push");
  await expect(trainee.locator("#imAdd")).toHaveText("Add this program");
  await trainee.click("#imAdd");
  await expect(trainee.locator("#importSheet")).toBeHidden();
  expect(new URL(trainee.url()).hash).toBe("");                     // the link isn't needed again
  await expect(trainee.locator("#progMsg")).toContainText("Added");
  await expect(trainee.locator("#installTip")).toBeVisible();
  await expect(trainee.locator("#homeGo")).toContainText("Coach Sara plan");

  // Same days, exercises, sets and reps as the trainer wrote them
  const strip = p => p.evaluate(() => PROGRAMS.filter(q => !q.builtin).map(q => [q.id, q.name, q.dayNames, q.phases[0].days.map(d => d.map(e => [e.id, e.name, e.sets, e.setReps || e.reps]))]));
  expect(await strip(trainee)).toEqual(await strip(coach));

  // It stays after closing the app, with no link
  await trainee.goto("./");
  await trainee.click("#homeGo");
  await expect(trainee.locator(".ex").first().locator(".set label").nth(2)).toHaveText("Set 3 · 8");
  await clean(coach); await clean(trainee);
});

test("a cut-off or unknown link is reported, never half-imported", async ({ browser, baseURL }) => {
  const coach = await phone(browser, baseURL);
  await buildProgram(coach);
  const link = await shareLink(coach);
  const trainee = await phone(browser, baseURL);

  await trainee.goto(link.slice(0, link.length - 40));
  await expect(trainee.locator("#imErr")).toBeVisible();
  await expect(trainee.locator("#imErrText")).toContainText("Part of the link is missing");
  await trainee.click("#imErrClose");
  await expect(trainee.locator("#importSheet")).toBeHidden();
  expect(await trainee.evaluate(() => localStorage.getItem(PREFIX + "programs-custom"))).toBeNull();

  await trainee.goto(link.replace("#p=2.", "#p=9."));
  await expect(trainee.locator("#imErrText")).toContainText("newer version");
  await clean(coach); await clean(trainee);
});

test("sharing an updated program keeps the trainee's logged weights", async ({ browser, baseURL }) => {
  const coach = await phone(browser, baseURL);
  await buildProgram(coach);
  const trainee = await phone(browser, baseURL);
  await trainee.goto(await shareLink(coach));
  await trainee.click("#imAdd");
  await trainee.click("#homeGo");
  await trainee.locator(".ex").first().locator(".set input").first().fill("60");

  // The coach adds an exercise to the first day and sends the link again
  await coach.click('.own-acts [data-act="edit"]');
  await addExercise(coach, "cable fly");
  await coach.click("#bdSave");
  await trainee.goto(await shareLink(coach));
  await expect(trainee.locator("#imUpdateNote")).toBeVisible();
  await expect(trainee.locator("#imAdd")).toHaveText("Update my program");
  await trainee.click("#imAdd");
  await expect(trainee.locator("#progMsg")).toContainText("logged weights are kept");
  await trainee.click("#homeGo");
  await expect(trainee.locator(".ex")).toHaveCount(3);
  await expect(trainee.locator(".ex").first().locator(".set input").first()).toHaveValue("60");
  expect(await trainee.evaluate(() => JSON.parse(localStorage.getItem(PREFIX + "programs-custom")).length)).toBe(1);
  await clean(coach); await clean(trainee);
});

test("a ready-made program can be shared too (Share only); my own has Share, Edit and Delete", async ({ page }) => {
  watch(page);
  await page.goto("./");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('.home-card[data-id="full-body-3"]').click();
  await page.click("#modeHome");
  expect(await page.locator(".own-acts button").evaluateAll(b => b.map(x => x.dataset.act))).toEqual(["share"]);
  await buildProgram(page);
  expect(await page.locator("#homeContinue .own-acts button").evaluateAll(b => b.map(x => x.dataset.act))).toEqual(["share", "edit", "delete"]);
  await clean(page);
});

test("opening a link to my own program changes nothing, so it stays mine to edit and share", async ({ browser, baseURL }) => {
  const coach = await phone(browser, baseURL);
  await buildProgram(coach);
  const link = await shareLink(coach);
  await coach.goto(link);                      // a coach checking their own link on the same phone
  await expect(coach.locator("#importSheet")).toBeVisible();
  await expect(coach.locator("#imErrText")).toContainText("your own program");
  await expect(coach.locator("#imAdd")).toBeHidden();
  await coach.click("#imErrClose");
  expect(await coach.locator("#homeContinue .own-acts button").evaluateAll(b => b.map(x => x.dataset.act))).toEqual(["share", "edit", "delete"]);
  await expect(coach.locator("#homeCreate")).toBeVisible();
  const saved = await coach.evaluate(() => JSON.parse(localStorage.getItem("llb-programs-custom")));
  expect(saved).toHaveLength(1);
  expect(saved[0].builder).toBe(true);
  expect(saved[0].shared).toBeFalsy();
  await clean(coach);
});

test("a shared program can never take a ready-made program's place", async ({ browser, baseURL }) => {
  const trainee = await phone(browser, baseURL);
  // A link whose program uses the same id as the ready-made Full Body program
  const link = await trainee.evaluate(() => shareUrl({ id: "full-body-3", name: "Look-alike", weeks: 1, repeat: true,
    days: [{ id: "d1", name: "Day 1", exercises: [{ id: "x1", name: "Squat", sets: 3, reps: "8" }] }] }, false));
  await trainee.goto(link);
  await trainee.click("#imAdd");
  await trainee.reload();
  await expect(trainee.locator("#homeContinue .c-name")).toHaveText("Look-alike");
  const ids = await trainee.evaluate(() => PROGRAMS.map(p => p.id));
  expect(ids).toContain("full-body-3");
  expect(ids).toContain("full-body-3-custom");
  await clean(trainee);
});
