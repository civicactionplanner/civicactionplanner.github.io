// Service worker: stale-while-revalidate for everything same-origin, so the
// planner opens instantly and works offline, and each deploy reaches a device
// within one revisit. Cross-origin (fonts, Firebase) passes straight through.
const CACHE = "cas-planner-v1";
const PRECACHE = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "assets/img/hero.webp",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request, { ignoreSearch: url.pathname === "/" });
      const refresh = fetch(e.request)
        .then((res) => {
          if (res && res.ok) cache.put(e.request, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || refresh;
    })
  );
});
