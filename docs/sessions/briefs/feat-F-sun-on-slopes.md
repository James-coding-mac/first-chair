# Brief for Codex: Feature F, sun on the slopes

Read first: CLAUDE.md, AGENTS.md. Paradiski only. Edit index.html, a new `sun.js` (+ `tools/test_sun.mjs`), `tools/build_paradiski.py` (one new optional field per map feature only if needed), sw.js (VERSION bump).

## Goal
Show which pistes are in the sun **now** and at a chosen time today, fully offline.
- Sun position: implement the standard NOAA/SunCalc solar azimuth/altitude formulas in `sun.js` (`FCSun.position(date, lat, lon) → {azimuth°, altitude°}`, `FCSun.times(date, lat, lon) → sunrise/sunset`). Test against known values (e.g. 21 Dec, lat 45.5 N lon 6.7 E, solar noon altitude ≈ 21.1°; sunrise/sunset within 3 min of NOAA reference values you compute in the test from the published equations' worked example).
- Piste aspect: for each piste line in the map GeoJSON, compute its downhill bearing and slope from the graph node elevations (`data/build/paradiski-graph.json`: nearest nodes to the line's ends) — the slope **faces** the downhill direction. Lines shorter than 150 m or with < 20 m drop: aspect unknown.
- In sun ≈ sun altitude > 3° AND the angle between sun azimuth and slope aspect < 100° (roughly lit), or sun altitude > 25° (lit regardless of aspect). Terrain shading by mountains is NOT modelled — say so in the UI ("ignores shadows from surrounding peaks").
- UI: a "Sun" layer in the map's layers menu: sunny pistes drawn with a warm gold glow, shaded ones dimmed; a time slider (sunrise → sunset, default now) in a small card under the map with sunrise/sunset times; a one-line tip like "Morning sun: north-east facing slopes" derived from the computation.

## Done when
node --check passes; `node tools/test_sun.mjs` and existing tests pass. Do NOT commit/push. Report files, tests, gaps.
