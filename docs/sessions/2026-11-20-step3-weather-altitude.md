# Step 3 — weather by altitude (20 Nov 2026)

Implemented the scoped weather-altitude brief; no commit or push. Awaiting Claude review.

Changed `tools/build_paradiski.py`, `data/build/paradiski.js`, `index.html`, `sw.js`, `docs/STATUS.md`, and this note.

The builder selects the highest lift top with a cached elevation and the nearest elevated OSM point within 400 m of the base. Current results: village 1926 m; Aiguille Rouge top 3131 m. These are cached terrain elevations, with the existing unverified OSM naming caveat. Internal top-node IDs are removed before output. Missing elevations skip weatherPoints with a note.

Paradiski uses two forecast requests and a separate `fc_weather_alt` cache. The compact two-column card displays current temperature/conditions, wind/gusts/compass direction, freezing level matched to the response’s current local hour, and three days of snow/max temperature. Cached forecasts show age; fetch failures retain cache; missing values show a dash. API numbers are converted and checked, labels escaped, and late fetches cannot repaint another resort. Other resorts retain the original weather path and `fc_weather`. SW change is only VERSION v4.

Validation:
- Builder completed with no WARNING. Parsed generated data equals the previous data after removing weatherPoints; map GeoJSON byte-for-byte unchanged.
- `node --check` passed for the extracted main inline script and sw.js.
- Temporary Node VM checks passed for request parameters, separate storage, freezing-hour selection, compass/gusts, escaped labels and malicious/missing values, offline age/no-cache message, request-failure fallback, and switching resorts during pending requests.
- Builder run against temporary outputs with a missing elevation file passed the fallback check and emitted no internal top_node fields.

Known gaps: no live Open-Meteo request or browser/iPhone visual verification in this session. Claude should review and check the two-column card on iPhone before commit. The separate routing agent’s files were not touched; pre-existing docs/DECISIONS.md and docs/PLAN.md edits were left intact.
