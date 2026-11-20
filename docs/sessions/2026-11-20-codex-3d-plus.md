# 3D full map mode — 20 November 2026

Implemented `docs/sessions/briefs/codex-3d-plus.md`.

- `map3d.js`: `setPosition` updates blue/white GeoJSON dot and geodesic 48-point accuracy polygon; `setPath` updates/clears route geometry. Calls while style is loading are buffered safely. Replay fits the saved path at pitch 60, draws a red dot and owns its stop callback. Terrain raster uses a once-registered `steep` protocol, existing FCSteep algorithms and AWS URL, returning encoded PNG bytes; missing tiles render the same grey hatch as 2D. Toggle is inside the map. Close aborts in-flight protocol requests, stops replay and removes map sources/layers/controls. Bearing is supplied by the 2D rotor; pitch transitions from 0 to 60 in 800 ms or jumps with reduced motion.
- `index.html`: forwards fresh GPS fixes and route changes; adds Replay in 3D beside 2D replay; shares saved-timestamp/120×/pause/clock logic. Avoids attaching Share day card's handler to replay-only entries. Adds minimal toggle styling.
- `sw.js`: bumps shell v20 to v21. A concurrent change to skip opaque cached tiles for CORS requests appeared during this task; preserved as found, not authored here.
- Tests: new `tools/test_map3d.mjs`; extended `tools/test_review_fixes.mjs` stubs and `tools/test_route_js.mjs` route-forwarding assertions.
- Documentation: this note and `docs/STATUS.md`.

Validation: every `tools/test_*.mjs` and `tools/test_*.py` passes. Existing route diagnostics still report known disconnected destinations (8/10 all-grade, 6/10 blue reachable), with invariants/parity passing. New tests cover before/open/pending position and path calls, route clearing, replay stop on close, stale callbacks, reduced motion, fit bounds, single protocol registration, PNG generation, missing-tile hatch, aborted requests, fresh/stale GPS forwarding, inherited bearing and shared replay clock pause/stop. Inline JS, map3d.js and sw.js parse; `git diff --check` passes.

Gaps: no real WebGL/browser visual or iPhone test in this session. Check touch controls, pitch/fit framing, GPS accuracy polygon, replay labels and pause, repeated opening/closing, steepness colours/hatch, and cached versus uncached tiles in airplane mode. Terrain resolution and existing tile cache limitations remain. No storage schema, external hosts, dependencies or resort data changed. No commit/push; ready for Claude review.
