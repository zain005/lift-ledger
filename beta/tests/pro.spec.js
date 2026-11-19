// @ts-check
const { test, expect } = require("@playwright/test");

/* Pro mode, weeks, and coach → trainee programs. Each "phone" is its own browser context. */
const errors = new WeakMap();
const watch = page => { const list = []; errors.set(page, list); page.on("pageerror", e => list.push(e.message)); return page; };
const clean = async page => {
  expect(errors.get(page)).toEqual([]);
  expect(await page.evaluate(() => [...MISSING])).toEqual([]);
};
async function phone(browser, baseURL) {
  const page = watch(await (await browser.newContext({ baseURL })).newPage());
  await page.goto("./");
  await expect(page.locator("#home")).toBeVisible();
  return page;
}
const settingsPage = async (page, name) => { await page.click("#modeSet"); await page.click(`.setrow[data-page="${name}"]`); };
const setPro = async (page, on) => {
  await settingsPage(page, "pro");
  const tog = page.locator("#proToggle");
  if ((await tog.isChecked()) !== on) await tog.click();
  await page.click("#modeHome");
};
const addExercise = async (page, query) => {
  await page.click("#bdAdd");
  await page.fill("#pkSearch", query);
  await page.locator(".pk-item").first().click();
  await expect(page.locator("#picker")).toBeHidden();
};
/* Train the next session: fill every set and mark the day done */
const trainNext = async page => {
  await page.click("#modeHome");
  await page.click("#homeGo");
  for (const box of await page.locator(".set input").all()) await box.fill("50");
  await page.click("#dayDone");
};
const shareLink = async (page, pro) => {
  await page.click("#modeHome");
  await page.click('#homeContinue .own-acts [data-act="share"]');
  if (pro !== undefined) { const t = page.locator("#shPro"); if ((await t.isChecked()) !== pro) await t.click(); }
  const link = await page.locator("#shLink").inputValue();
  await page.click("#shClose");
  return link;
};

test.beforeEach(async ({ page }) => {
  watch(page);
  await page.goto("./");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator("#home")).toBeVisible();
});

test("Pro is off by default; it shows weeks and calories, and turning it off hides them without losing anything", async ({ page }) => {
  await expect(page.locator("#modeCal")).toBeHidden();
  await page.locator('.home-card[data-id="full-body-3"]').click();
  await expect(page.locator("#weekToggle")).toBeHidden();
  await setPro(page, true);
  await expect(page.locator("#modeCal")).toBeVisible();
  await page.click("#modeWorkout");
  await expect(page.locator("#weekToggle")).toBeVisible();
  await expect(page.locator("#wtMain")).toHaveText("Week 1 of 8");
  // calorie details entered in Pro survive Pro being turned off and on again
  await settingsPage(page, "details");
  await page.fill("#pWeight", "80"); await page.fill("#pHeight", "180"); await page.fill("#pAge", "30");
  await setPro(page, false);
  await expect(page.locator("#modeCal")).toBeHidden();
  await page.click("#modeSet");
  await expect(page.locator('.setrow[data-page="details"]')).toHaveCount(0);
  await setPro(page, true);
  await settingsPage(page, "details");
  await expect(page.locator("#pWeight")).toHaveValue("80");
  await clean(page);
});

test("people already using calories or later weeks start in Pro", async ({ page }) => {
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem(PREFIX + "program", JSON.stringify("full-body-3"));
    localStorage.setItem(PREFIX + "log-full-body-3", JSON.stringify({ v: 2, w2: { ex: { "fb-a1": { s: ["60", "", ""] } }, done: {} } }));
  });
  await page.reload();
  await expect(page.locator("#home")).toBeVisible();
  expect(await page.evaluate(() => SET.pro)).toBe(true);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem(PREFIX + "program", JSON.stringify("full-body-3")); });
  await page.reload();
  await expect(page.locator("#home")).toBeVisible();
  expect(await page.evaluate(() => SET.pro)).toBe(false);
  await clean(page);
});

test("without Pro, a program I build is one week that repeats with no end", async ({ page }) => {
  await page.click("#homeCreate");
  await expect(page.locator("#bdWeekBox")).toBeHidden();
  await page.fill("#bdName", "Simple");
  await addExercise(page, "push-up");
  await page.click("#bdAddDay");
  await addExercise(page, "back squat");
  await page.click("#bdSave");
  await expect(page.locator("#homeGo .c-meta")).toHaveText("This week: 0 of 2 days");
  await trainNext(page); await trainNext(page);
  await page.click("#modeHome");
  await expect(page.locator("#homeGo .c-meta")).toHaveText("This week: 0 of 2 days");   // next week, no end
  await expect(page.locator("#homeGo .c-next")).toHaveText("Next: Day 1");
  await trainNext(page);
  expect(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem(PREFIX + "log-" + P.id))).filter(k => /^w/.test(k)).sort())).toEqual(["w1", "w2"]);
  const raw = await page.evaluate(() => JSON.parse(localStorage.getItem(PREFIX + "programs-custom"))[0]);
  expect(raw).toMatchObject({ weeks: 1, repeat: true });
  await clean(page);
});

test("in Pro, weeks hold their own days; Add week copies the last one; the program ends with Program complete", async ({ page }) => {
  await setPro(page, true);
  await page.click("#homeCreate");
  await expect(page.locator("#bdWeekBox")).toBeVisible();
  await page.fill("#bdName", "Block");
  await addExercise(page, "barbell bench press");
  await page.click("#bdAddWeek");
  await expect(page.locator(".bd-weektab:not(.add)")).toHaveCount(2);
  await expect(page.locator("#bdWeeksNote")).toContainText("copy of week 1");
  await expect(page.locator(".bd-ex")).toHaveCount(1);                      // week 2 starts as a copy
  await page.locator(".bd-ex").first().locator(".setbtn.plus").click();     // week 2: one more set
  await page.click("#bdAddDay");                                            // week 2: a second day
  await addExercise(page, "back squat");
  await page.locator(".bd-weektab").first().click();
  await expect(page.locator(".bd-daytab:not(.add)")).toHaveCount(1);        // week 1 unchanged
  await expect(page.locator(".bd-ex").first().locator(".bd-set")).toHaveCount(1);
  for (let i = 0; i < 11; i++) if (await page.locator("#bdAddWeek").count()) await page.click("#bdAddWeek");
  await expect(page.locator(".bd-weektab:not(.add)")).toHaveCount(12);
  await expect(page.locator("#bdAddWeek")).toHaveCount(0);                  // 12 is the most
  for (let i = 0; i < 10; i++) { await page.locator(".bd-weektab:not(.add)").last().click(); page.once("dialog", d => d.accept()); await page.click("#bdDelWeek"); }
  await expect(page.locator(".bd-weektab:not(.add)")).toHaveCount(2);
  await page.click("#bdSave");
  const raw = await page.evaluate(() => JSON.parse(localStorage.getItem(PREFIX + "programs-custom"))[0]);
  expect(raw).toMatchObject({ weeks: 2, weekly: true });
  expect(raw.phases.map(ph => ph.days.length)).toEqual([1, 2]);
  await page.click("#homeGo");
  await expect(page.locator(".day")).toHaveCount(1);
  await page.click("#weekToggle"); await page.locator(".wk").nth(1).click();
  await expect(page.locator(".day")).toHaveCount(2);
  await expect(page.locator(".ex").first().locator(".set")).toHaveCount(2);
  await trainNext(page); await trainNext(page); await trainNext(page);
  await page.click("#modeHome");
  await expect(page.locator("#homeGo .c-k")).toHaveText("Program complete");
  await expect(page.locator(".complete-note")).toBeVisible();
  await page.click("#homeGo");
  await expect(page.locator("#progress .tile .v").first()).toContainText("3");
  await clean(page);
});

test("a trainee on a coach's normal program sees only that program, until they turn Pro on", async ({ browser, baseURL }) => {
  const coach = await phone(browser, baseURL);
  await coach.click("#homeCreate"); await coach.fill("#bdName", "Sara plan");
  await addExercise(coach, "leg press");
  await coach.click("#bdSave");
  await coach.click('#homeContinue .own-acts [data-act="share"]');
  await expect(coach.locator("#shProRow")).toBeHidden();                   // only coaches in Pro see the switch
  const link = await coach.locator("#shLink").inputValue();
  await coach.click("#shClose");

  const trainee = await phone(browser, baseURL);
  await trainee.goto(link);
  await expect(trainee.locator("#imPro")).toBeHidden();
  await trainee.click("#imAdd");
  await expect(trainee.locator("#homeGo .c-k")).toHaveText("From your coach");
  for (const id of ["#homeCreate", "#homeProgs", "#homeChooseH", "#homeMine"]) await expect(trainee.locator(id)).toBeHidden();
  await expect(trainee.locator(".own-acts")).toHaveCount(0);
  await expect(trainee.locator(".home-links")).toBeHidden();
  expect(await trainee.evaluate(() => SET.pro)).toBe(false);
  // Pro shows everything; choosing a ready-made program stops following the coach
  await setPro(trainee, true);
  await expect(trainee.locator("#homeCreate")).toBeVisible();
  await expect(trainee.locator(".home-card")).toHaveCount(3);
  await expect(trainee.locator('#homeContinue .own-acts button')).toHaveText(["Delete program"]);   // a coach's program can't be edited
  await trainee.locator('.home-card[data-id="upper-lower-4"]').click();
  expect(await trainee.evaluate(() => SET.follow)).toBe("");
  await setPro(trainee, false);
  await expect(trainee.locator("#homeCreate")).toBeVisible();
  await clean(coach); await clean(trainee);
});

test("a coach in Pro can send a Pro program, including a ready-made one; the trainee gets Pro", async ({ browser, baseURL }) => {
  const coach = await phone(browser, baseURL);
  await setPro(coach, true);
  await coach.locator('.home-card[data-id="push-pull-legs-6"]').click();
  const plain = await shareLink(coach, false);
  const link = await shareLink(coach, true);
  expect(link).not.toBe(plain);
  expect(link.length).toBeLessThan(plain.length + 10);
  expect(link.length).toBeLessThan(120);                                   // ready-made programs travel by name
  const trainee = await phone(browser, baseURL);
  await trainee.goto(link);
  await expect(trainee.locator("#imName")).toHaveText("Push Pull Legs");
  await expect(trainee.locator("#imPro")).toBeVisible();
  await expect(trainee.locator("#imDays li")).toHaveCount(6);
  await trainee.click("#imAdd");
  expect(await trainee.evaluate(() => [SET.pro, SET.follow, P.id])).toEqual([true, "push-pull-legs-6", "push-pull-legs-6"]);
  await expect(trainee.locator("#modeCal")).toBeVisible();
  await clean(coach); await clean(trainee);
});

test("an updated program shows what changed; the trainee can update or keep their version", async ({ browser, baseURL }) => {
  const coach = await phone(browser, baseURL);
  await coach.click("#homeCreate"); await coach.fill("#bdName", "Sara plan");
  await addExercise(coach, "barbell bench press");
  await addExercise(coach, "plank");
  await coach.click("#bdSave");
  const trainee = await phone(browser, baseURL);
  await trainee.goto(await shareLink(coach));
  await trainee.click("#imAdd");
  await trainee.click("#homeGo");
  await trainee.locator(".ex").first().locator(".set input").first().fill("70");

  await coach.click('#homeContinue .own-acts [data-act="edit"]');
  await coach.locator(".bd-ex").first().locator(".setbtn.plus").click();
  await coach.locator(".bd-ex").nth(1).locator(".del").click();
  await addExercise(coach, "cable fly");
  await coach.click("#bdSave");
  const v2 = await shareLink(coach);

  await trainee.goto(v2);
  await expect(trainee.locator("#imChanges")).toBeVisible();
  await expect(trainee.locator("#imChangeList li")).toHaveText(["Barbell Bench Press: 2×6 → 3×6", "Added: Cable Fly", "Removed: Plank"].map(s => new RegExp(s.replace(/[×→]/g, ".").replace(/[0-9]/g, "\\d"))));
  await expect(trainee.locator("#imCancel")).toHaveText("Keep my current version");
  await trainee.click("#imCancel");
  await trainee.click("#modeHome");
  await trainee.click("#homeGo");
  await expect(trainee.locator(".ex")).toHaveCount(2);                     // kept the old version
  await trainee.goto(v2);
  await trainee.click("#imAdd");
  await trainee.click("#homeGo");
  await expect(trainee.locator(".ex")).toHaveCount(2);
  await expect(trainee.locator(".ex").nth(1).locator("h3")).toContainText("Cable Fly");
  await expect(trainee.locator(".ex").first().locator(".set input").first()).toHaveValue("70");
  await clean(coach); await clean(trainee);
});

test("week-by-week programs travel in the link, and links made before weeks still open", async ({ browser, baseURL }) => {
  const coach = await phone(browser, baseURL);
  await setPro(coach, true);
  await coach.click("#homeCreate"); await coach.fill("#bdName", "Two weeks");
  await addExercise(coach, "back squat");
  await coach.click("#bdAddWeek"); await coach.click("#bdAddDay"); await addExercise(coach, "leg press");
  await coach.click("#bdSave");
  const trainee = await phone(browser, baseURL);
  await trainee.goto(await shareLink(coach));
  await expect(trainee.locator("#imSummary")).toContainText("2 weeks");
  await trainee.click("#imAdd");
  const shape = p => p.evaluate(() => P.phases.map(ph => ph.days.map(d => d.map(e => e.name))));
  expect(await shape(trainee)).toEqual(await shape(coach));
  // a version 1 link, as the previous app made them
  const old = await trainee.evaluate(() => {
    const body = b64url(fflate.deflateSync(fflate.strToU8(JSON.stringify({ i: "my-old1", n: "Old link", w: 8, d: [{ i: "d1", n: "Day 1", e: [{ i: "x1", n: "Plank", s: ["30"], r: "plank", t: 1 }] }] })), { level: 9 }));
    return location.origin + location.pathname + "#p=1." + body + "." + checksum(body);
  });
  await trainee.goto(old);
  await expect(trainee.locator("#imName")).toHaveText("Old link");
  await clean(coach); await clean(trainee);
});

test("in a saved program only the last week can be deleted, so logged weeks never shift", async ({ page }) => {
  await page.goto("./");
  await page.evaluate(() => {
    const days = [{ id: "d1", name: "Day 1", exercises: [{ id: "x1", name: "Squat", sets: 3, reps: "8" }] }];
    localStorage.setItem(PREFIX + "programs-custom", JSON.stringify([{ format: 2, id: "my-weeks", name: "Three weeks", weeks: 3, weekly: true, builder: true,
      days, phases: [1, 2, 3].map(w => ({ name: "", weeks: [w, w], days })) }]));
    localStorage.setItem(PREFIX + "program", JSON.stringify("my-weeks"));
    localStorage.setItem(PREFIX + "settings", JSON.stringify({ pro: true }));
  });
  await page.reload();
  const dialogs = [];
  page.on("dialog", d => { dialogs.push(d.type() + ": " + d.message()); d.accept(); });
  await page.click('#homeContinue .own-acts [data-act="edit"]');
  await expect(page.locator("#builder")).toBeVisible();
  const tabs = page.locator(".bd-weektab:not(.add)");
  await expect(tabs).toHaveCount(3);
  await tabs.nth(1).click();
  await page.click("#bdDelWeek");
  await expect(tabs).toHaveCount(3);
  expect(dialogs[0]).toMatch(/^alert: .*only the last week \(week 3\)/);
  await tabs.nth(2).click();
  await page.click("#bdDelWeek");
  await expect(tabs).toHaveCount(2);
  expect(dialogs[1]).toMatch(/^confirm: Delete week 3/);
});
