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

## Satellite basemap (20 Nov 2026)
Chosen: **EOX Sentinel-2 cloudless 2016**, keyless CC BY 4.0. Endpoint:
`https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg`.
Attribution in both maps: “Sentinel-2 cloudless – https://s2maps.eu by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016)”.

Verified both candidates with GET requests carrying `Referer: https://james-coding-mac.github.io/first-chair/` and `Origin: https://james-coding-mac.github.io`. Coordinates near 45.51, 6.70:

| z / x / y | Esri bytes | EOX bytes |
|---|---:|---:|
| 13 / 4248 / 2930 | 10460 | 17239 |
| 14 / 8496 / 5860 | 8689 | 9377 |
| 15 / 16993 / 11721 | 7596 | 6834 |
| 16 / 33987 / 23443 | 6191 | 4038 |

All eight: HTTP 200, `image/jpeg`, distinct SHA-256 hashes, JPEG bodies rather than text/JSON errors. Esri CORS `*`; EOX CORS `https://james-coding-mac.github.io`. Visually inspected z13/z16 from each: real terrain, no watermark/key-required placeholder. These are browser-header HTTP checks, not a real browser/WebGL integration test.

- **Esri:** technical checks pass, but rejected on terms for this subscription-free app. [Esri's official terms summary](https://www.esri.com/content/dam/arcgisonline/docs/tou_summary.pdf) requires Esri software or an ArcGIS subscription and restricts offline use; public unauthenticated tile responses do not establish permission. [Attribution guidance](https://support.esri.com/en-us/knowledge-base/what-is-the-correct-way-to-cite-an-arcgis-online-basema-000012040) also requires imagery contributor credits.
- **EOX:** [provider FAQ](https://cloudless.eox.at/documentation/faq) permits the free 2016 endpoint under CC BY 4.0, subject to reasonable traffic, visible attribution and no SLA; recommends device caching to reduce load. Only viewed tiles enter the existing 1,200-tile shared cache; no bulk download added. Historical imagery is soft at high zoom; cap requests at the tested z16 and overzoom beyond. The picker explains age, detail and offline limits.
