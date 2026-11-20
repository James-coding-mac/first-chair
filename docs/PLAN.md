# Plan: v4 (Paradiski) by 12 Dec 2026

v3 is live (offline shell, weather, GPS tracking, runs/restaurants/log). v4 adds Paradiski and makes the app work properly with no signal on the mountain. One step = one session.

| Step | What | Done when | Target |
|---|---|---|---|
| 0 | Docs, AI team, token ticker | Pushed | 20 Nov ✅ |
| 1 | Add **Paradiski** resort (Les Arcs + La Plagne + Peisey-Vallandry), with runs, lifts and restaurants generated from OSM (`tools/build_paradiski.py`), all marked `verified:false` until checked against the official 2026–27 piste map | Shows in the resort switcher; existing `fc_` data untouched | 24 Nov ✅ (20 Nov) |
| 2 | **Offline map**: draw pistes/lifts from bundled GeoJSON (Leaflet vector layer), with optional precaching of OpenSnowMap tiles for the Paradiski area | Map usable in airplane mode | 27 Nov |
| 3 | Weather by altitude (village vs summit) + freezing level + wind | Shows cached forecast + its age offline | 29 Nov |
| 4 | Tracking upgrade: runs auto-split on lift vs piste, vertical, day totals | Tested on a walk/drive | 2 Dec |
| 5 | **Routing**: piste/lift graph, fastest route to a restaurant/lift, difficulty filter | 10 test routes look sensible | 6 Dec |
| 6 | Lift/piste open status (scheduled GitHub Action scrape → JSON) | Shows status + "as of" time | 8 Dec |
| 7 | James verifies names against the official map; polish | — | 10 Dec |
| 8 | Freeze: fixes only | — | 11 Dec |

After the trip: busyness (needs many users), accounts/sync, friends, public launch, costs.
