# 20 Nov 2026: Step 2, offline map

**Brief:** map usable in airplane mode for Paradiski.

**Decision (Claude, reversible):** no bulk prefetch of map tiles. OSM's tile usage policy forbids bulk/offline prefetching from tile.openstreetmap.org. Instead the pistes, lifts, restaurants and base are drawn from our own bundled OSM data, over whatever tiles you've already viewed (cached) or a plain background.

**Done**
- `tools/build_paradiski.py` also writes `data/build/paradiski-map.geojson`: every piste segment in Paradiski (named or not, areas as polygons) and every lift, simplified (Douglas-Peucker, 4 m). 1,300 piste segments (185 as polygons) + 161 lifts, 432 KB. `paradiski.js` gains only a `mapData` field; names unchanged.
- `index.html` map: canvas renderer; piste lines in grade colours, off-piste dashed amber, lifts navy, base marker, restaurant dots from zoom 15; tap for name/grade (all OSM text through `esc()`); layers menu (pistes & lifts / restaurants / OpenSnowMap). Map note explains what works offline. Other resorts unchanged.
- `sw.js` v3: precaches the GeoJSON; best-effort precache of Leaflet js/css/layer icons from unpkg into `fc-runtime-v1` (install can't fail because of the CDN).

**Tested** (Chrome, local server): SW cached Leaflet + GeoJSON; then killed the server and reloaded: Leaflet, 1,461 vector features and 211 restaurant dots all drew from cache; popups correct; switching to Whistler clears vectors and restores its note; no console errors. **Not yet tested:** real airplane mode on the iPhone.

**Review (checker + security sub-agents): both PASS WITH FIXES. Fixed:**
- Builder: closed rings collapsed to 2 points (Douglas-Peucker with first == last), so all 185 piste areas were invisible. Rings now simplified as two halves; collapsed shapes dropped.
- Map: generation counter so quick resort switches can't draw the layer twice; offline layers only listed in the layers menu on Paradiski; vector layer carries its own OSM/ODbL credit.
- Leaflet pinned with SRI hashes (computed independently, matched the reviewer's); SW skips old opaque copies that would fail SRI.
- SW: cross-origin caching restricted to Google Fonts + unpkg leaflet@1.9.4 (SECURITY.md); error responses never cached; install uses `cache:"reload"` so a stale HTTP-cached file can't be pinned.
- Retested in Chrome (incl. server killed): Leaflet passes SRI from cache, 1,461 features / 185 polygons / 211 restaurant dots, race fixed, no console errors.
- Open (James's call, later): self-host Leaflet in the repo (BSD-2) instead of the CDN. CSP meta tag still missing.
- Phone note: the first online launch after the deploy still runs the old SW, so open the app twice with signal before airplane mode.

**Next**
- James: on the phone, open the app twice with signal, then airplane mode → Map tab → Paradiski.
- Step 3: weather by altitude + freezing level + wind.
