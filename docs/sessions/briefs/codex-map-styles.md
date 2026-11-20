# Brief for Codex: Google-Maps-style map picker incl. satellite (2D + 3D)

Read CLAUDE.md, AGENTS.md, docs/SECURITY.md, docs/DECISIONS.md (Basemap section). James asked (20 Nov) for satellite and Google-Maps-like map type options. You have network access.

## 0. Pick the satellite source (verify first, in a way that reflects a real browser)
- Candidate A: Esri World Imagery `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}` (note y/x order).
- Candidate B: EOX Sentinel-2 cloudless 2016 `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg` (CC BY 4.0, attribution "Sentinel-2 cloudless – https://s2maps.eu by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016)").
For each: fetch a few Paradiski tiles (z 13–16 around 45.51, 6.70) WITH headers `Referer: https://james-coding-mac.github.io/first-chair/` and `Origin: https://james-coding-mac.github.io` and check: HTTP 200, image content-type, `Access-Control-Allow-Origin` present (needed for 3D/MapLibre), and no watermark/"key required" behaviour (compare image sizes across tiles; a tiny identical image for every tile = error placeholder; also look for a text/JSON error). Read the provider's terms page for keyless/non-commercial use and attribution. Choose A if it passes, else B. Write findings + chosen provider + attribution to docs/DATA-SOURCES.md and a line in docs/DECISIONS.md. If neither passes, stop and report.

## 1. 2D (index.html)
Replace the base-layer radio list with a "Map type" picker: a round button (top-right, under the layers control or replacing its base section) that opens a small sheet of 4 thumbnail cards (use a tiny static preview: a CSS gradient/emoji is fine, no new image files needed):
- "Piste map" = existing `baseLayers.clean` (snow relief) + vectors/labels (default for resorts with places)
- "Satellite" = imagery + our piste/lift vectors + all labels (labels need a white halo, already have text-shadow; make sure they read on imagery)
- "Satellite only" = imagery, vectors hidden (labels for places still shown)
- "Detailed" = existing OSM (`baseLayers.osm`), place labels hidden as now
Store the choice per resort in the existing `fc_basemap` (values clean/satellite/satonly/osm; old values keep working). Keep overlays (steepness, restaurants, services, photos, skied, sun) in the Leaflet layers control. Imagery tiles: add the host to `isTile` in sw.js (cached, capped like the others).
## 2. 3D (map3d.js)
`styleFor(key)`: satellite/satonly → raster source with the imagery (tileSize 256, attribution), plus hillshade at low exaggeration (0.15) over it; vectors hidden for satonly. Pass the key from open3D (basemapKey()).
## 3. Tests + rules
Update/add tests (test_map3d stub, any index-slicing harness stubs). All existing tests pass. Bump sw.js VERSION. Escape nothing new from data except via esc. Do NOT commit/push. Report: provider check results, files changed, tests.
