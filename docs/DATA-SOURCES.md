# Data sources

| Data | Source | Licence / cost | Verified how |
|---|---|---|---|
| Pistes, lifts, restaurants (geometry + names) | OpenSkiMap / OpenStreetMap | ODbL, free; attribution required in-app | Cross-check names against the official 2026–27 Paradiski / Les Arcs / La Plagne piste maps |
| Weather + snow forecast | Open-Meteo | Free, keyless (non-commercial use; check terms before public launch) | — |
| Lift/piste open status | Resort websites (scraped) | Check the terms before public launch | Shows scrape time |
| Restaurant menus | Manual entry from restaurant sites | — | Source URL stored per menu |

Rule: every record carries `source` and `verified` (true/false). Unverified records are shown with a marker in the UI.

## Lift/piste open status (Step 6a, `tools/scrape_status.py` → `data/status/paradiski.json`)
- **Primary:** Lumiplan's public Paradiski interactive-map feed (`public.lumiplay.link/interactive-map/v1/map/e6302a83…/staticPoiData` + `dynamicPoiData`), the same data the resorts' interactive map uses. Plain public GET, no key or token. Per lift/piste: status, scheduled + actual opening hours (→ closing time), grooming, snow quality, resort message. `public.lumiplay.link` has no robots.txt (404 → allowed).
- **Fallbacks:** La Plagne `ouvertures.la-plagne.com/datas_statics.json` + `datas_dynamics.json`, La Plagne live panel (`/encart-live/ajax`), Les Arcs "domaines et remontées" page (totals only). robots.txt checked on every run; redirects refused; one GET per source per run; identifies as `first-chair-personal/0.1`.
- **Frequency:** GitHub Action every 15 min 07:00–17:00 UTC; commits only when something changes, or to refresh the "as of" time (hourly in season, daily pre-season).
- **Matching:** source names → OSM names by normalised exact match (accents, case, articles, plurals, Roman numerals, lift-type prefixes ignored); same-named lifts paired by altitude (DEM); never guessed. Unmatched names listed in the file for James's Step 7 check. 20 Nov 2026: 111/147 lifts, 208/293 pistes matched.
- **Terms:** personal, low-frequency use. **Re-check Lumiplan's and the resorts' terms before any public launch.**
