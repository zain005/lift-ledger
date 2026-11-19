// @ts-check
const { test, expect } = require("@playwright/test");

/* These tests run with the real service worker (the rest of the suite blocks it). */
test.use({ serviceWorkers: "allow" });

test("opens with no internet after the first visit", async ({ page, context }) => {
  await page.goto("./");
  await page.locator('.home-card[data-id="full-body-3"]').click();
  await expect(page.locator(".ex").first()).toBeVisible();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();                               // now controlled by the worker
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.click("#homeGo");
  await page.locator(".ex").first().locator(".set input").first().fill("42");
  await context.setOffline(true);
  await page.reload();
  await page.click("#homeGo");
  await expect(page.locator(".ex").first()).toBeVisible();
  await expect(page.locator(".ex").first().locator(".set input").first()).toHaveValue("42");
  await context.setOffline(false);
});

test("online, the newest files are fetched rather than the saved copy", async ({ page }) => {
  await page.goto("./");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  // Plant a stale copy of the page in the worker's cache; an online reload must not show it.
  await page.evaluate(async () => {
    const names = await caches.keys();
    const c = await caches.open(names[0]);
    await c.put(new Request(location.href), new Response("<!doctype html><title>stale</title><p id=stale>old copy</p>", { headers: { "Content-Type": "text/html" } }));
  });
  await page.reload();
  await expect(page.locator("#stale")).toHaveCount(0);
  await expect(page.locator("#home")).toBeVisible();
});

test("online, a server error never replaces the saved copy", async ({ page }) => {
  await page.goto("./");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  // A file the worker has saved but the server now answers with an error (here a 404)
  const got = await page.evaluate(async () => {
    const c = await caches.open((await caches.keys())[0]);
    const url = new URL("missing-on-server.txt", location.href).href;
    await c.put(new Request(url), new Response("saved copy", { headers: { "Content-Type": "text/plain" } }));
    const r = await fetch(url);
    return [r.status, await r.text()];
  });
  expect(got).toEqual([200, "saved copy"]);
});
