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

## Pending: needs James
- (none)
