# Decisions

## Made by James (20 Nov 2026)
- Stays a **PWA** (home-screen web app); no native app for now.
- Repo stays **public** on free GitHub Pages for now; revisit before a "real" launch.
- Trip MVP: offline map + GPS, routing to restaurants/lifts, snow/weather, speed/stats, lift/piste status.
- AI team: Claude leads; Qwen 3.6 27B (local) and Codex help; checker and security agents review.
- Budget: **£0** unless James approves.

## Trip profile (James, 20 Nov 2026)
- Base: **Plagne Bellecôte** (La Plagne). Default map centre, weather point and route "home". Take the coordinates from OSM in Step 1; don't type them from memory.
- Ability: very competent, all blacks, avalanche-trained off-piste rider. Route filter defaults to **all pistes, including black**.
- Off-piste: show OSM `piste:type` freeride/itinerary routes if present, clearly labelled; **never auto-route off-piste**, and show the avalanche bulletin (BERA, Météo-France) link next to them.
- Users: just James for now; maybe a few friends later (so keep data per device, and think about sharing after the trip).

## Technical (Claude; reversible)
- Keep the single-file `index.html` + Leaflet. No framework or build step; v3 works and holds James's logged data.
- Paradiski data comes from OpenStreetMap via Overpass → `tools/` script → bundled GeoJSON.
- Paradiski list data ships as a generated script `data/build/paradiski.js` (sets `window.FC_PARADISKI`), not pasted into `index.html`: it can be regenerated, and works offline from the SW precache. (Step 1)
- Sectors come from OSM's ski-area outlines (La Plagne; Les Arcs / Peisey-Vallandry), so Peisey-Vallandry is part of the Les Arcs sector, as OSM has it. (Step 1)
- Map tile cache (`fc-tiles-v1`) and the Leaflet/fonts cache (`fc-runtime-v1`) have fixed names, so bumping the app VERSION doesn't wipe them or strand the map offline. (Step 1)
- **Known risk:** favourites/notes/ratings are keyed on run/restaurant *names*. A rebuild after OSM edits can rename a generated name (e.g. a `(village)` or `#2` suffix) and hide notes saved on it. `build_paradiski.py` prints a WARNING listing any names that disappeared. Don't rebuild during the trip without reading it. (OSM ids aren't more stable: ways get split.) (Step 1 review)

- No bulk/offline prefetch of map tiles: OSM's tile usage policy forbids it. Offline map = our bundled OSM vectors over already-viewed cached tiles. If James wants a full offline background later, it needs a source whose licence allows offline use (e.g. self-generated tiles). (Step 2)

## UI (James, 20 Nov 2026)
- Premium redesign = **"polished lift-signage"**: keep the palette and Barlow/Inter, but SVG icons instead of emoji, big map with floating controls, large-number condition cards, softer shadows, slide-up sheets, automatic dark mode. Done after Steps 3–5 (they edit the same file).

## Delegation (James, 20 Nov 2026)
- Push build work to Codex/Qwen to save Claude usage; Claude writes briefs (`docs/sessions/briefs/`), reviews, tests and commits.

## Workarounds approved (James, 20 Nov 2026)
- **Pass wallet + photo log**: pass-shop links; pass number/photo/insurance stored on-device only; geotagged photos in IndexedDB; OSM viewpoints.
- **Friends without a server**: "Send my spot" link (position in the URL fragment, never sent to a server); import friends' stats files for a leaderboard. Live location → Apple Find My.
- **Avalanche level** via the scheduled GitHub job (Météo-France; any key only as a GitHub secret, never in the app).
- **3D terrain view**: MapLibre GL JS (open source, from the allowed CDN) + AWS Terrain Tiles (open data, no key) as a new allowed host; optional offline pack for Paradiski.
- Later: native Apple Watch companion; accounts/live leaderboards (Supabase/Firebase) after the trip.

## Basemap (James, 20 Nov 2026: "go with 1")
- Tried **CARTO Voyager, no labels**: from a website it shows "API KEY REQUIRED" watermarks, so not used (no new host added).
- Default background = **"Snow relief"** drawn in the app (steep.js reliefLayer) from AWS Terrain Tiles (already approved for 3D): white snow, NW hillshade, no printed names. First Chair draws all names itself (villages, hamlets, peaks with heights, lakes, pistes, lifts), so every name stays upright when the map rotates, in 2D and 3D. OpenStreetMap stays selectable ("OpenStreetMap (detailed)").

## Pending: needs James
- (none)

- Map styles (20 Nov 2026): use EOX Sentinel-2 cloudless 2016 for Satellite / Satellite only in 2D and 3D; both candidates passed browser-header tile checks, but Esri's subscription/offline terms do not fit this app. EOX is keyless CC BY 4.0 with attribution; allow `tiles.maps.eox.at` for capped viewed-tile caching. Piste map and Detailed preserve clean/osm preferences. See DATA-SOURCES.md for evidence.
