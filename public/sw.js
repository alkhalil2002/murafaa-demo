/*
 * Murafaa service worker.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * SECURITY DECISION: this worker caches STATIC ASSETS ONLY.
 *
 * It deliberately does NOT cache HTML pages or any API response. Every page in
 * this app is tenant data — case titles, client names, invoice amounts — and a
 * Cache Storage entry survives sign-out, persists on disk, and is readable by
 * anyone who later opens the browser on that device. A lawyer's phone is
 * exactly the device where that matters.
 *
 * The offline story is therefore: the shell and assets load instantly, and a
 * clear offline page appears instead of stale case data. That is the correct
 * trade for a legal product. Do not "improve" this by adding a
 * stale-while-revalidate rule for navigations.
 * ─────────────────────────────────────────────────────────────────────────
 */

const VERSION = "v1";
const STATIC_CACHE = `murafaa-static-${VERSION}`;
const OFFLINE_URL = "/offline.html";

const PRECACHE = [OFFLINE_URL, "/manifest.webmanifest", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Immutable build output and icons — safe to cache, contains no tenant data. */
function isCacheableAsset(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/static/") ||
      url.pathname.startsWith("/icons/") ||
      url.pathname === "/manifest.webmanifest")
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Never touch auth or API traffic — not even to read from cache.
  if (url.pathname.startsWith("/api/")) return;

  if (isCacheableAsset(url)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Navigations: always network. Fall back to the offline page, never to a
  // cached copy of someone's case list.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
  }
});
