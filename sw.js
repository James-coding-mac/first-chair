/* First Chair service worker — offline app shell + opportunistic tile cache.
   Bump VERSION when the precache list or this file changes to force an update. */
const VERSION = "v1";
const SHELL   = "fc-shell-" + VERSION;    // core app files (same-origin)
const RUNTIME = "fc-runtime-" + VERSION;  // fonts, Leaflet, etc. (cross-origin)
const TILES   = "fc-tiles-" + VERSION;    // map tiles you've viewed
const TILE_MAX = 500;                      // cap so the tile cache can't grow forever

const SHELL_FILES = [
  "./", "./index.html", "./manifest.json",
  "./icon.png", "./icon-192.png", "./icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => ![SHELL, RUNTIME, TILES].includes(k)).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

function isTile(url){
  return url.hostname.includes("opensnowmap.org") ||
         url.hostname.includes("tile.openstreetmap.org");
}

async function trimCache(name, max){
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if(keys.length > max){
    for(let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
  }
}

self.addEventListener("fetch", event => {
  const req = event.request;
  if(req.method !== "GET") return;                 // never cache writes
  const url = new URL(req.url);

  // Weather API: always go to network (app does its own last-known caching).
  if(url.hostname.includes("api.open-meteo.com")) return;

  // App navigations: network-first so a fresh deploy shows up online,
  // fall back to the cached shell when offline.
  if(req.mode === "navigate"){
    event.respondWith(
      fetch(req).catch(() => caches.match("./index.html").then(r => r || caches.match("./")))
    );
    return;
  }

  // Map tiles: cache-first, capped — viewed areas keep working offline.
  if(isTile(url)){
    event.respondWith(
      caches.open(TILES).then(async cache => {
        const hit = await cache.match(req);
        if(hit) return hit;
        try{
          const res = await fetch(req);
          cache.put(req, res.clone());
          trimCache(TILES, TILE_MAX);
          return res;
        }catch(e){ return hit || Response.error(); }
      })
    );
    return;
  }

  // Same-origin static files: cache-first.
  if(url.origin === self.location.origin){
    event.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(SHELL).then(c => c.put(req, copy));
        return res;
      }))
    );
    return;
  }

  // Cross-origin (Google Fonts, Leaflet CDN): stale-while-revalidate.
  event.respondWith(
    caches.open(RUNTIME).then(async cache => {
      const hit = await cache.match(req);
      const network = fetch(req).then(res => { cache.put(req, res.clone()); return res; })
                                .catch(() => hit);
      return hit || network;
    })
  );
});
