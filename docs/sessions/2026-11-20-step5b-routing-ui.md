# Step 5b — offline routing UI

Implemented exactly the routing brief; no commit or push. Ready for Claude review.

Files changed:
- `route.js`: isolated in-memory graph routers, nearest-node snapping and binary-heap Dijkstra; directed edges, unknown grades allowed, off-piste excluded.
- `index.html`: Paradiski-only searchable lift tops/mountain restaurants, Route buttons for every Eat row, Home/base destination, grade chips persisted in new `fc_route_pref`, directions and map layers. Names escaped. Async requests cancelled on Clear/resort switch/new route. Failed graph loads can retry.
- `tools/build_paradiski.py`, `data/build/paradiski.js`: only new resort field is graphData. Existing names/data preserved.
- `sw.js`: v6 shell precaches graph and route.js.
- `tools/test_route_js.mjs`: exact Python destination selection and route-cost comparisons plus synthetic routing and in-memory UI tests.
- `docs/STATUS.md` and this session note.

Verification:
- `node --check route.js`, `node --check sw.js`, and extracted main inline script: pass.
- `node tools/test_route_js.mjs`: same reachability and times within 1% for all 10 Python destinations under all four filters. All: 8/10; red: 7/10; blue: 6/10; green: 0/10.
- Tests cover off-piste exclusion, unknown grades, directionality, disconnected/zero-length routes, snapping, independent graph instances; UI GPS freshness/accuracy, base fallback, escaping, memory caching, missing snap, connectivity failure, async cancellation, failed-load retry.
- `node tools/test_tracking.mjs`: all 12 analysis cases and UI/storage lifecycle checks pass.
- `python3 tools/build_paradiski.py`: no WARNING. Parsed generated object compared to HEAD: identical after removing graphData. Map GeoJSON unchanged.

Assumptions and remaining checks:
- Reuses the latest fix from Locate me or Track day. No fresh fix, stale/inaccurate fix, or no graph node within 300 m means base start; the origin is shown.
- Destinations/start snap to graph nodes. Route time excludes the distances between actual locations and those nodes. Unknown grade and unverified-data caveats are displayed.
- OSM connectivity gaps remain; no synthetic links or off-piste fallback. Lift times come from graph estimates, not live queues or closures.
- Browser visual inspection and iPhone install/airplane-mode/GPS field tests are still pending. Verify bold overlays/dashed lifts, mobile search, Eat-to-map navigation, and v6 cache installation on device.
- No existing localStorage schema/key changed. Only fc_route_pref is added.
