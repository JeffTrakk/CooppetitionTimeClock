// Service worker: keeps the app shell loadable with no signal so workers can
// still punch (queued in IndexedDB) on "queue" sites. Network-first for
// pages, so online users always see fresh data.
// Push notifications will be handled here once Web Push is connected
// (see src/lib/integrations/messaging/channels.ts → pushChannel).

const CACHE = "timeclock-shell-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/icon.svg"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).pathname.startsWith("/api/")) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && (req.mode === "navigate" || req.url.includes("/_next/static/"))) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || Response.error())),
  );
});

// self.addEventListener("push", (event) => { ... }) — added when push is connected.
