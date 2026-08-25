/** Bump CACHE_NAME whenever auth/gate clients change — forces clients off stale bundles. */
const CACHE_NAME = "kleen-v3-no-shell-cache";

self.addEventListener("install", (event) => {
  // Do not precache app shells — that pinned broken JS and hid deploys.
  self.skipWaiting();
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Never touch non-http(s) (chrome-extension:// etc.) — was throwing Cache.put errors.
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // Never cache HTML/app navigations or Next bundles — always network.
  const dest = event.request.destination;
  if (
    event.request.mode === "navigate" ||
    dest === "document" ||
    dest === "script" ||
    dest === "worker" ||
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/api/") ||
    url.pathname === "/job-flow" ||
    url.pathname.startsWith("/job-flow/") ||
    url.pathname === "/sign-in" ||
    url.pathname.startsWith("/dashboard")
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Static images/icons only — cache after network success.
  if (dest === "image" || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/images/")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone).catch(() => {});
            });
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((r) => r || Response.error())),
    );
  }
});
