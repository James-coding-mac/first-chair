# Brief for Codex: make 3D a full map mode

Read CLAUDE.md, AGENTS.md, docs/SECURITY.md. Files: `map3d.js` (MapLibre 3D view, API window.FC3D.open(container, opts)/close()/isOpen()), `index.html` (open3D(), routing in takeRoute(), replayDay(), GPS onPos()/latestPosition, rotation `rotor.getBearing()`), `steep.js` (FCSteep.slopes/decode/band). Keep the existing style; no new dependencies or hosts.

## Add
1. **Live position in 3D**: `FC3D.setPosition(lat, lon, accuracyM)` draws/updates a blue dot (#3D7FB8, white outline) + accuracy circle (GeoJSON circle polygon, 48 points); call it from onPos() when FC3D.isOpen(). On open, if latestPosition is < 2 min old, show it immediately.
2. **Route in 3D**: when a route is shown (takeRoute builds `routeLayer`), keep the route's [lat,lon] polyline in a module variable `currentRouteLine` (cleared by clearRoute()). open3D passes it as `opts.path`. Add `FC3D.setPath(path|null)` so a route started while 3D is open appears in 3D too.
3. **Replay in 3D**: in the log, add a "▶ Replay in 3D" button next to "Replay day on map" for entries with a path. It opens 3D centred on the path (fitBounds with padding, pitch 60) and animates a red dot along the path at 120× with the same clock label as replayDay (reuse its timing logic; factor a shared helper rather than duplicating). Closing 3D stops the animation.
4. **Steepness in 3D**: a toggle button inside the 3D view ("Steepness") adding a MapLibre `raster` layer whose tiles are generated client-side: register a custom protocol with `maplibregl.addProtocol('steep', ...)` that fetches the matching AWS terrarium tile (same URL as steep.js), computes slope with FCSteep.decode/slopes/band, and returns a PNG/ImageBitmap. Grey hatch on fetch failure (same as steep.js). Opacity 0.5, drawn above the OSM raster, below piste lines.
5. **Match the 2D view on open**: bearing = rotor.getBearing() (if rotation exists), start pitch 0 and ease to 60 over 800 ms (skip the animation if prefers-reduced-motion).
6. Escape all names (opts.esc) as now. Clean up everything (markers, animation, protocol not re-registered twice) on close; open/close repeatedly must not leak or throw.

## Tests
Extend tools/test_review_fixes.mjs or add tools/test_map3d.mjs with a stub maplibregl (no WebGL) checking: setPosition before/after open, setPath, replay start/stop on close, protocol registered once, cancellation still works. All existing tests must pass. Bump VERSION in sw.js. Do NOT commit/push. Report files changed, tests, gaps.
