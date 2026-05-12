/* DocklyLogistics – minimal service worker.
 *
 * Strategy:
 *  - Pre-cache the PWA shell (manifest, icons) on install.
 *  - For GET requests outside /api and /_next/data: try cache first, otherwise
 *    network. Successful responses for static assets are persisted.
 *  - API/data requests bypass the SW entirely (network-only).
 *  - When the network is unavailable, a basic 503 response is returned.
 */

const CACHE_NAME = "docklylogistics-v1";
const STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/icon-192.svg",
  "/icon-512.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(STATIC_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (
    url.pathname.startsWith("/api") ||
    url.pathname.startsWith("/_next/data")
  )
    return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (
          res.ok &&
          (url.pathname.endsWith(".svg") ||
            url.pathname.endsWith(".webmanifest") ||
            url.pathname.startsWith("/_next/static"))
        ) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, res.clone());
        }
        return res;
      } catch {
        return new Response("Offline", { status: 503, statusText: "Offline" });
      }
    })(),
  );
});
