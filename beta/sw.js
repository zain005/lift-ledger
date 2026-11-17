/* Offline support: always try the newest version online, fall back to the saved copy offline. Bump VERSION on each release. */
const VERSION = "lift-ledger-beta-9";
const SHELL = [
  "./", "index.html", "css/app.css", "js/i18n.js", "js/app.js", "js/library.js", "js/builder.js", "js/share.js", "vendor/fflate.js", "vendor/qrcode.js", "js/calories.js", "data/exercises.json", "manifest.webmanifest",
  "programs/index.json", "programs/full-body-3.json", "programs/upper-lower-4.json", "programs/push-pull-legs-6.json",
  "icons/icon.svg", "icons/icon-192.png", "icons/apple-touch-icon.png",
  "fonts/barlow-latin-400-normal.woff2", "fonts/barlow-latin-500-normal.woff2", "fonts/barlow-latin-600-normal.woff2",
  "fonts/barlow-condensed-latin-500-normal.woff2", "fonts/barlow-condensed-latin-600-normal.woff2", "fonts/barlow-condensed-latin-700-normal.woff2"
];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  const url = new URL(req.url);
  // The main app's worker leaves the test version at /beta/ to its own worker.
  const leaveAlone = !location.pathname.includes("/beta/") && url.pathname.includes("/beta/");
  if (req.method !== "GET" || url.origin !== location.origin || leaveAlone) return;
  e.respondWith(networkFirst(req));
});

/* Network first, so people always get the newest version when they're online.
   "no-cache" makes the browser check with the server instead of reusing its own short-term copy.
   On a slow connection (weak gym signal) the saved copy is used after 4 seconds; offline it's used straight away. */
async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(req, { ignoreSearch: true });
  const fresh = fetch(req.mode === "navigate" ? new Request(req.url, { cache: "no-cache", credentials: "same-origin" }) : new Request(req, { cache: "no-cache" }))
    .then(res => { if (res.ok) cache.put(req, res.clone()); return res; });
  if (!cached) return fresh;
  const slow = new Promise(resolve => setTimeout(() => resolve(cached), 4000));
  return Promise.race([fresh.catch(() => cached), slow]);
}
