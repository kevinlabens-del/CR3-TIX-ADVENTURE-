const APP_VERSION = "18.0.0";
const CACHE_NAME = "cr3atix-adventure-v18";
const APP_ROOT = new URL("./", self.registration.scope).toString();
const CORE_PATHS = [
  "", "manifest.webmanifest", "manifest-github.webmanifest", "favicon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png",
  "game/hero-sprite.png", "game/hero.png", "game/enemy.png",
  ...Array.from({ length: 10 }, (_, index) => `game/worlds/world-${String(index + 1).padStart(2, "0")}.webp`),
  "game/bosses/boss-01-kryon-prime.png", "game/bosses/boss-02-vulkar.png", "game/bosses/boss-03-selene-x.png",
  "game/bosses/boss-04-mycora.png", "game/bosses/boss-05-glacius.png", "game/bosses/boss-06-heliox.png",
  "game/bosses/boss-07-abyssus.png", "game/bosses/boss-08-archivor.png", "game/bosses/boss-09-tempestor.png",
  "game/bosses/boss-10-nox-imperator.png",
];
const CORE_FILES = CORE_PATHS.map((path) => new URL(path, APP_ROOT).toString());

async function warmApplicationShell(cache) {
  await Promise.allSettled(CORE_FILES.map((url) => cache.add(url)));
  try {
    const response = await fetch(APP_ROOT, { cache: "reload" });
    if (!response.ok) return;
    await cache.put(APP_ROOT, response.clone());
    const html = await response.text();
    const linkedAssets = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
      .map((match) => new URL(match[1], APP_ROOT))
      .filter((url) => url.origin === self.location.origin)
      .map((url) => url.toString());
    await Promise.allSettled(linkedAssets.map((url) => cache.add(url)));
  } catch {
    // Le cache principal reste utilisable même si un fichier optionnel échoue.
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => warmApplicationShell(cache))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("cr3atix-adventure-") && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: "window", includeUncontrolled: true }))
      .then((clients) => clients.forEach((client) => client.postMessage({ type: "CR3ATIX_UPDATE_ACTIVE", version: APP_VERSION }))),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "CR3ATIX_SKIP_WAITING") {
    event.waitUntil(self.skipWaiting());
    return;
  }
  if (event.data?.type === "CR3ATIX_GET_VERSION") {
    event.source?.postMessage({ type: "CR3ATIX_VERSION", version: APP_VERSION });
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then((response) => {
          if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match(APP_ROOT))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok && response.type === "basic") {
        caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
      }
      return response;
    })),
  );
});
