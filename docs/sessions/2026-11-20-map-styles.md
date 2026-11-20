# Map styles — 20 Nov 2026

Implemented codex-map-styles.md. Provider evidence and links are in docs/DATA-SOURCES.md. Both sources returned distinct JPEGs with browser Referer/Origin and valid CORS at z13–16. EOX selected because its 2016 endpoint permits keyless use and device caching; Esri requires subscription/software terms this project does not meet.

Files changed for this task: index.html, map3d.js, sw.js, tools/test_map3d.mjs, tools/test_map_styles.mjs, docs/DATA-SOURCES.md, docs/DECISIONS.md, docs/STATUS.md, this note. Preserved pre-existing charts/hourly work and other uncommitted changes.

- Round top-right Map type button opens four thumbnail cards; keyboard Escape closes and returns focus, pressed state follows resort preference. Labels retain white halos. Satellite only hides the piste/lift group and its labels, retains place labels, and leaves optional overlays available. Other resort defaults and clean/osm preferences remain compatible.
- 3D receives the selected key, uses EOX raster tiles + 0.15 hillshade for imagery, and omits piste/lift geometry and labels in Satellite only. Route/GPS/replay and independent overlays remain available.
- EOX requests use CORS in 2D too, avoiding opaque cached tiles when moving to 3D. Existing shared capped cache preserved; shell bumped v28 → v29. No dependencies, keys, bulk downloads, commits or pushes.

Validation: all 11 tools/test_*.mjs suites pass; Python unittest discovery reports 49 passing cases. Inline JS/map3d.js/sw.js syntax and git diff --check pass. New checks cover per-resort defaults/preferences, repeated imagery switching, satellite-only suppression/restoration, non-vector resorts, 3D source/attribution/hillshade and cache hostname boundaries.

Known gaps: no real browser/WebGL or iPhone visual/gesture/offline-transition check. EOX imagery is from 2016 and blurry when zoomed in; picker states this. Offline imagery is limited to viewed cached areas. Claude reviews before commit.
