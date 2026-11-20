# Brief for Codex: Step 5b, routing in the app (Paradiski)

Read first: CLAUDE.md, AGENTS.md, docs/SECURITY.md, docs/DECISIONS.md (trip profile: James is an expert; route filter defaults to ALL pistes incl. black; never auto-route off-piste). Graph format: see `tools/build_routes.py` / `data/build/paradiski-graph.json` (nodes [lat,lon,ele]; edges [from,to,kind,grade,nameIdx,len_m,time_s,coords]; kinds piste/lift/walk; grades list in the file; off-piste edges must never be used; "unknown" grade allowed under every filter).

## Goal
"Take me there" for Paradiski, working fully offline:
- **Destinations**: any restaurant (Eat tab rows get a "Route" button for resorts with a graph), any lift top (a searchable "Route to…" box on the Map tab listing lifts and mountain restaurants), and **Home = the base** (Plagne Bellecôte, `R.base`).
- **Start**: current GPS position if a fix ≤ 60 s old with accuracy ≤ 100 m (snap to the nearest graph node within 300 m), otherwise the base. Show which was used ("From your position" / "From Plagne Bellecôte").
- **Difficulty filter**: chips "All (incl. black)" (default), "Max red", "Max blue", "Max green". Remember the choice in a new key `fc_route_pref`.
- **Result**: route drawn on the map as a bold line on top (lifts dashed), start/end markers, map fits the route; a step list card under the map: collapse consecutive same-name pieces → "▲ Arpette chairlift · 8 min", "■ Replat (blue) · 2 min", "Walk 120 m"; total time; "Clear route" button. If no route: explain ("No route with this filter — try a harder filter" / "Not connected in the OSM data") and never fall back to off-piste.
- Restaurant/lift snapping: nearest graph node within 300 m; if none, say so.

## Implementation
- Load the graph lazily with fetch when first needed (like the map vectors), cache in memory; add `R.graphData = "data/build/paradiski-graph.json"` via `tools/build_paradiski.py` (one new field only; builder must print no WARNING; names unchanged) and precache it in `sw.js` (add to SHELL_FILES, bump VERSION to v6).
- Dijkstra with a binary heap in a new file `route.js` (`window.FCRoute = { load(json), nearestNode(lat,lon,maxM), route(from, to, {maxGrade}) }`), pure functions, loaded with `<script src>`, precached. Unit-test it in node: `tools/test_route_js.mjs` must reproduce, for the 10 destinations used by tools/test_routes.py (base → each), the same reachability and total time within 1% as the Python router (you can call the Python script or hard-code its numbers by reading its output once).
- All names from OSM go through `esc()`; use Leaflet layers (no raw HTML from data); colours from the existing palette; mobile-first, ≤ 640 px.
- Other resorts: no routing UI shown at all.

## Done when
`node --check` on route.js, sw.js and the main inline script; `node tools/test_route_js.mjs` passes; builder prints no WARNING. Do NOT commit/push. Finish with files changed, test output, known gaps.
