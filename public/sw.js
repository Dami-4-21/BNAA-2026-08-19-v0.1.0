const APP_CACHE = "bnaasaas-app-v1";
const API_CACHE = "bnaasaas-api-v1";
const FILE_CACHE = "bnaasaas-documents-v1";
const APP_SHELL = ["/login", "/manifest.webmanifest", "/pwa-icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => ![APP_CACHE, API_CACHE, FILE_CACHE].includes(key))
          .map((key) => caches.delete(key)),
      ),
    ).then(() => self.clients.claim()),
  );
});

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }

    throw new Error("offline");
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (response && response.ok) {
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, APP_CACHE));
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname === "/manifest.webmanifest") {
    event.respondWith(cacheFirst(request, APP_CACHE));
    return;
  }

  if (
    (url.pathname.includes("/documents/") && url.pathname.endsWith("/file")) ||
    (url.pathname.includes("/site/photos/") && url.pathname.endsWith("/file"))
  ) {
    event.respondWith(cacheFirst(request, FILE_CACHE));
    return;
  }

  if (url.pathname.startsWith("/api/projects/") || url.pathname === "/api/workspace") {
    event.respondWith(networkFirst(request, API_CACHE));
  }
});
