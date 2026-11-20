# Follow-up brief for Codex: Step 5a fixes (route graph)

Context: your first pass (tools/build_routes.py, tools/test_routes.py, data/build/paradiski-graph.json) followed the original brief, and the brief had flaws. Fix them. Same file limits as before: edit ONLY those three files (another agent is editing index.html, sw.js, track.js right now). Python 3.9 stdlib. Also make both scripts work when run as `python3 -I tools/build_routes.py` (isolated mode drops the script dir from sys.path: insert `os.path.dirname(os.path.abspath(__file__))` into sys.path explicitly before importing build_paradiski).

## Changes
1. **Areas: downhill only.** For piste areas, link ring graph nodes a→b only when ele[b] <= ele[a] + 5 (never uphill), and only to the 6 nearest such nodes (not all-to-all). This must remove the uphill shortcuts (Chez Wam / La Rossa routes).
2. **Flat links**: the "both directions if |Δele| < 5 m and < 300 m" rule stays, but for any edge, if it climbs more than 15 m (end higher than start on the DEM) and isn't a lift, drop it. Print how many edges were dropped/reversed by DEM so we can sanity-check.
3. **Lift ends**: connect each lift end (bottom and top) both ways to the nearest graph node(s) of pistes OR other lift ends within **150 m** (walk, 1.0 m/s, plus 0 wait). For the top, only to nodes at most 20 m higher; for the bottom, only from nodes at most 20 m lower than... (i.e. no long uphill walks: walk edges may climb at most 20 m).
4. **Dangling piste ends**: a piste way end that is no other way's node and has no outgoing edge (dead end) gets a link to the nearest graph node within 50 m that is not higher by more than 5 m.
5. **Vanoise Express** (OSM name contains "Vanoise Express", it's a cable car linking the two sectors, both directions): cable cars run both ways — for `aerialway=cable_car` add the reverse edge too (top→bottom ride).
6. **Size**: target < 900 KB. Keep coordinates only for edges (5 dp, simplified 4 m); walk edges need no coordinates (draw a straight line).
7. **Diagnostics** printed by build_routes.py: counts as before; % lift tops reachable from base (exclude off-piste); list the 20 largest components other than the main one with a sample piste/lift name and centre lat/lon; lifts with no connection.
8. test_routes.py: same 10 destinations + max-blue variant; additionally assert no route segment climbs > 25 m except on lift edges, and print PASS/FAIL per route.

## Done when
Both run cleanly (also under `-I`). Aim: ≥ 85% of lift tops reachable from base. If you can't reach that, explain the main causes from the diagnostics (with example names/locations). Do NOT commit. Finish with the report numbers and the 10 routes.
