# Decisions

## Made by James (20 Nov 2026)
- Stays a **PWA** (home-screen web app); no native app for now.
- Repo stays **public** on free GitHub Pages for now; revisit before a "real" launch.
- Trip MVP: offline map + GPS, routing to restaurants/lifts, snow/weather, speed/stats, lift/piste status.
- AI team: Claude leads; Qwen 3.6 27B (local) and Codex help; checker and security agents review.
- Budget: **£0** unless James approves.

## Technical (Claude; reversible)
- Keep the single-file `index.html` + Leaflet. No framework or build step; v3 works and holds James's logged data.
- Paradiski data comes from OpenStreetMap via Overpass → `tools/` script → bundled GeoJSON.

## Pending: needs James
- (none)
