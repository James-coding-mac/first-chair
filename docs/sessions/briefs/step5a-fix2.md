# Follow-up brief 2 for Codex: Step 5a connectivity

Same file limits (only tools/build_routes.py, tools/test_routes.py, data/build/paradiski-graph.json; another agent is editing index.html/sw.js/track.js). Context: after fix 1, 82/161 lift tops are reachable and nothing is reachable with max grade = blue. The elevation model is ~90 m resolution, so differences of ±20–30 m over short distances are noise. Adjust:

1. **Walk links** (lift ends ↔ piste/lift nodes within 150 m): allow climbs up to **40 m**; walk time = distance/1.0 m/s + climb_m × 6 s (penalise climbing rather than forbid it).
2. **DEM direction checks** only for piste pieces ≥ 200 m long; shorter pieces trust the OSM way direction. Keep the >25 m reverse rule and the >15 m drop rule only for ≥ 200 m pieces.
3. **Max-blue failures**: in test_routes.py, for each destination that fails with max = blue, print the cheapest red/black/unknown edge(s) the all-grades route needed (name, grade). Treat "unknown" grade (unnamed connectors, roads/links) as allowed under every filter, and say so in the output.
4. **Diagnostics**: for the 10 largest disconnected components, print why they're cut off: the nearest main-component node, its distance and elevation difference.
5. Re-run. Aim ≥ 85% lift tops reachable. If not, list the top 5 blockers with lat/lon and names so a human can check them on the official map.

Do NOT commit. Finish with numbers, the 10 routes (all grades + max blue), and remaining blockers.
