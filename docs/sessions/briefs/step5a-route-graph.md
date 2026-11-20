# Brief for Codex: Step 5a, piste/lift route graph (build tool only)

Read first: CLAUDE.md, AGENTS.md. **Only create these new files**: `tools/build_routes.py`, `tools/test_routes.py`, `data/build/paradiski-graph.json`. Do not edit any other file (another task is editing `tools/build_paradiski.py` and `index.html` right now). Python 3.9 standard library only. No network access needed.

## Inputs
- `data/raw/paradiski-overpass.json` (Overpass `out geom`: ways have `nodes` (ids) and `geometry` (lat/lon per node), `tags`).
- `data/raw/elevations.json`: `{ "<node id>": metres }` for every way end and every node shared by 2+ piste/lift ways (DEM, ~90 m resolution, so small differences are noise).
- Reuse top-level helpers by importing from `tools/build_paradiski.py` (`haversine`, `in_poly`, `geom`, `GRADE`, `OFFPISTE_GRADES`, `SECTORS`, `LIFT_TYPES`, `simplify`) — import, don't copy, don't modify. Sector outlines: the `landuse=winter_sports` ways named in `SECTORS`; keep only pistes/lifts inside them (same rule as build_paradiski: majority of sampled points inside).

## Graph
- **Nodes** = graph points: way ends + nodes shared by 2+ piste/lift ways. Store [lat, lon, ele].
- **Piste edges**: split each `piste:type=downhill` way (not `piste:abandoned=yes`) at graph nodes. OSM convention is that pistes are drawn **downhill**, so edge direction = way direction, except: if the DEM says the end is >25 m higher than the start, reverse it; if |Δele| < 5 m and the piece is < 300 m, add both directions (flat link). Grade: same mapping as build_paradiski (green/blue/red/black, off-piste for freeride/extreme/backcountry, else "unknown"). Areas (`area=yes`/closed): connect every graph node on the ring to every other in both directions with length = straight-line distance (you can ski across an area). Time = length / speed: green 18, blue 25, red 30, black 30, unknown 18, off-piste 25 km/h.
- **Lift edges**: aerialway ways in `LIFT_TYPES`, direction first→last node (OSM convention bottom→top), one-way up. Time = `aerialway:duration` if present (formats: minutes number, "mm:ss", "PTxM"), else length / speed by type (cable car 8, gondola 5, chair_lift 4.5, mixed_lift 4.5, drag/t-bar/j-bar/platter 3, rope_tow 2, magic_carpet 0.6 m/s); plus 120 s boarding/wait.
- **Walk links**: any lift end node that isn't on a piste, connect both ways to the nearest piste graph node within 80 m (time = distance / 1.0 m/s, kind "walk"). Report lifts that got no link.
- Edge geometry: keep simplified coordinates (`simplify(pts, 4)`) so the app can draw the route.
- Every edge keeps its name (piste or lift name, may be empty) and kind.

## Output `data/build/paradiski-graph.json` (compact, aim < 700 KB)
```
{ "v":1, "attribution":"© OpenStreetMap contributors, ODbL; elevation Copernicus DEM via Open-Meteo",
  "grades":["green","blue","red","black","offpiste","unknown"], "kinds":["piste","lift","walk"],
  "names":[...], "nodes":[[lat,lon,ele],...],
  "edges":[[from,to,kind,grade,nameIdx,len_m,time_s,[lat,lon,lat,lon,...]],...] }
```
(grade = -1 for lift/walk; coords at 5 dp.)

## Report (printed by build_routes.py)
Node/edge counts, file size, size of the largest strongly connected component, % of lift tops reachable from the node nearest the base (base = OSM `place` named "Plagne Bellecôte", see build_paradiski), lifts with no connection.

## tools/test_routes.py
Dijkstra over the graph (exclude off-piste edges always; optional max grade). From the base node, route to 10 destinations chosen **by code from the data** (not typed names): 5 mountain restaurants (`loc=="mtn"` in `data/build/paradiski.js` → nearest graph node) spread across both sectors, and 5 lift tops in Les Arcs (cross the Vanoise Express link if OSM has it). Print each route as a list of (kind, name, grade, minutes) collapsing consecutive same-name pieces, plus total time. Also run each with max grade = blue and show where it differs or fails.

## Done when
Both scripts run cleanly; print the report and the 10 routes. Do NOT commit. Finish with: files created, the report numbers, any route that looks wrong and why.
