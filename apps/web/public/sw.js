/* EvidujZdarma – service worker pokladny.
 * Pokladna (/pokladna) se otevře i bez internetu: HTML síť→cache, statické soubory cache-first.
 * API se nikdy necachuje — tržby drží pokladna v IndexedDB a synchronizuje sama. */
const VERSION = "ez-pos-v1";
const SHELL = ["/pokladna", "/manifest.webmanifest", "/icon.svg", "/icons/192", "/icons/512"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Neměnné soubory buildu: cache-first
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname === "/icon.svg") {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Pokladna: síť (aktuální verze), při výpadku z cache
  if (req.mode === "navigate" && url.pathname.startsWith("/pokladna")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && url.pathname === "/pokladna") {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put("/pokladna", copy));
          }
          return res;
        })
        .catch(() => caches.match("/pokladna").then((hit) => hit || new Response("Offline", { status: 503 }))),
    );
  }
});
