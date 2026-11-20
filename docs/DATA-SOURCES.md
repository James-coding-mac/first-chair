# Data sources

| Data | Source | Licence / cost | Verified how |
|---|---|---|---|
| Pistes, lifts, restaurants (geometry + names) | OpenSkiMap / OpenStreetMap | ODbL, free; attribution required in-app | Cross-check names against the official 2026–27 Paradiski / Les Arcs / La Plagne piste maps |
| Weather + snow forecast | Open-Meteo | Free, keyless (non-commercial use; check terms before public launch) | — |
| Lift/piste open status | Resort websites (scraped) | Check the terms before public launch | Shows scrape time |
| Restaurant menus | Manual entry from restaurant sites | — | Source URL stored per menu |

Rule: every record carries `source` and `verified` (true/false). Unverified records are shown with a marker in the UI.
