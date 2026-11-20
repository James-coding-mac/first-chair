/* First Chair service worker — offline app shell + opportunistic tile cache.
   Bump VERSION when the precache list or this file changes to force an update. */
const VERSION = "v20";
const SHELL   = "fc-shell-" + VERSION;    // core app files (same-origin)
const RUNTIME = "fc-runtime-v1";          // fonts, Leaflet (cross-origin; fixed name so an update can't strand the map offline)
const TILES   = "fc-tiles-v1";            // map tiles you've viewed (fixed name: survives app updates)
const TILE_MAX = 1200;                     // cap so the tile cache can't grow forever (2D tiles + 3D terrain)

const SHELL_FILES = [
  "./", "./index.html", "./manifest.json", "./track.js", "./route.js", "./stats.js", "./sun.js", "./rotate.js", "./map3d.js", "./steep.js",
  "./icon.png", "./icon-192.png", "./icon-512.png",
  "./data/build/paradiski.js", "./data/build/paradiski-map.geojson", "./data/build/paradiski-graph.json"
];
// Map library from the CDN, saved at install so the map works in airplane mode. Best effort:
// if the CDN is down the install still succeeds and these get cached on first normal use.
const CDN_FILES = [
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/leaflet@1.9.4/dist/images/layers.png",
  "https://unpkg.com/leaflet@1.9.4/dist/images/layers-2x.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    // cache:"reload" skips the browser's HTTP cache, so a stale copy can't get pinned into this version
    caches.open(SHELL).then(c => c.addAll(SHELL_FILES.map(u => new Request(u, { cache:"reload" }))))
      .then(() => caches.open(RUNTIME).then(c => c.addAll(CDN_FILES)).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => ![SHELL, RUNTIME, TILES].includes(k)).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// Cross-origin hosts we're willing to cache (docs/SECURITY.md: same-origin + allow-listed only)
function isAllowedCdn(url){
  return url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com" ||
         (url.hostname === "unpkg.com" && (url.pathname.startsWith("/leaflet@1.9.4/") || url.pathname.startsWith("/maplibre-gl@4.7.1/")));
}
// opaque = a no-cors response (tiles, font CSS): its status can't be read, so it's accepted as-is
function cacheable(res){ return res && (res.ok || res.type === "opaque"); }

function isTile(url){
  return url.hostname === "elevation-tiles-prod.s3.amazonaws.com" ||   // 3D terrain (AWS Terrain Tiles, open data)
         url.hostname.includes("opensnowmap.org") ||
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
          if(cacheable(res)){ cache.put(req, res.clone()); trimCache(TILES, TILE_MAX); }
          return res;
        }catch(e){ return hit || Response.error(); }
      })
    );
    return;
  }

  // Live lift/piste status: network-first (it changes all day), last copy when offline.
  if(url.origin === self.location.origin && url.pathname.includes("/data/status/")){
    event.respondWith(
      fetch(req).then(res => {
        if(res.ok){ const copy = res.clone(); caches.open(SHELL).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req).then(hit => hit || Response.error()))
    );
    return;
  }

  // Same-origin static files: cache-first.
  if(url.origin === self.location.origin){
    event.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if(res.ok){ const copy = res.clone(); caches.open(SHELL).then(c => c.put(req, copy)); }
        return res;
      }))
    );
    return;
  }

  // Anything else cross-origin and not allow-listed: leave it to the browser, never cache it.
  if(!isAllowedCdn(url)) return;

  // Google Fonts, Leaflet CDN: stale-while-revalidate.
  event.respondWith(
    caches.open(RUNTIME).then(async cache => {
      let hit = await cache.match(req);
      // Leaflet is loaded with SRI (a cors request); an old opaque copy would fail the check, so skip it
      if(hit && hit.type === "opaque" && req.mode === "cors") hit = undefined;
      const network = fetch(req).then(res => { if(cacheable(res)) cache.put(req, res.clone()); return res; })
                                .catch(() => hit || Response.error());
      return hit || network;
    })
  );
});
