# Brief for Codex: Step 3, weather by altitude (Paradiski)

Read first: CLAUDE.md, AGENTS.md, docs/SECURITY.md. Rules that matter most here: never break existing `fc_*` localStorage keys; no invented data; offline must degrade clearly; no new external hosts (Open-Meteo `api.open-meteo.com` is already allowed); escape any text put in innerHTML with the existing `esc()`.

## Goal
For resorts that define `weatherPoints` (only Paradiski), the weather card shows **village vs summit** side by side: now temp, weather, wind speed + gusts (km/h) and direction; **freezing level** (m) now; 3-day snowfall and max temp for each point. Offline it shows the cached forecast **with its age** ("Offline · forecast from 3 h ago"; online: "Updated 14:05"). Whistler, Tignes–Val d'Isère and Three Valleys must look and behave exactly as now.

## Data (tools/build_paradiski.py)
Add to the resort object a field:
`"weatherPoints": [{"label": "Village · Plagne Bellecôte", "at": [lat, lon], "ele": <m or null>}, {"label": "Summit · top of <lift name>", "at": [...], "ele": <m>}]`
- Village = the existing base point (`base_pt`, `BASE_NAME`); `ele` = elevation of the nearest point in `data/raw/elevations.json` within 400 m, else null.
- Summit = the Paradiski lift (in `lifts`) whose **top** has the highest elevation in `data/raw/elevations.json`. That file maps OSM node id (string) → metres; a lift's top node is the last entry of the aerialway way's `nodes` list, so you'll need to keep that id when building lifts (add a `"top_node"` key only internally; do NOT add new fields to lift records in the output except if needed, and never change run/eat/lift names).
- If elevations.json is missing, skip weatherPoints (the app then falls back to the current single-point weather) and print a note.
- After the change, run `python3 tools/build_paradiski.py`: it must print **no WARNING** (names unchanged), and `paradiski.js` must differ only by the new field.

## App (index.html)
- New localStorage key `fc_weather_alt` = `{ resortId: { points: [ <open-meteo response per point> ], at: <ms> } }`. Do not change `fc_weather`.
- One request per point: `https://api.open-meteo.com/v1/forecast?latitude=..&longitude=..&elevation=<ele if known>&current=temperature_2m,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m&hourly=freezing_level_height&daily=weather_code,temperature_2m_max,snowfall_sum&forecast_days=3&timezone=auto&wind_speed_unit=kmh`. Freezing level now = the hourly value for the current hour.
- Reuse `wmo()` and the existing card styles; keep it compact on a phone (two columns, then the 3-day row per point or a combined table, your call; mobile-first, 640px max). Wind direction as compass letters (N, NE…).
- Treat every API value as untrusted: use `Number()`/`Math.round` and never put raw strings into innerHTML.
- Show age when stale; if no cache and offline: "Weather needs a data signal — it'll load next time you're online."
- Race-safe when switching resorts quickly (same pattern as `renderWeather` uses: check the resort id when the fetch resolves).

## sw.js
Bump `VERSION` to `v4` (data file changed). Nothing else.

## Done when
- `node --check` on sw.js and on the main inline script passes; the builder prints no WARNING.
- Do NOT commit or push. When finished, list files changed, how you tested, and known gaps.
