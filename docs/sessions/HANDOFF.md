# HANDOFF (20 Nov 2026, updated 17:10): read this first, then CLAUDE.md and docs/STATUS.md

Claude stopped here to save its context. Everything below is committed and LIVE unless marked otherwise.

## Live now (main, GitHub Pages)
Plan steps 1–6 + extras + rotatable map (two-finger twist, compass north-up/heading): Paradiski data, offline map, village/summit weather + snow depth, Track day (runs/lifts), offline routing (avoids closed lifts, last-lift warning), premium redesign, lift/piste status scraper (Lumiplan), SOS card + 112 + "Send my spot", season stats, share day card, pistes skied, sun on slopes, resort links, biggest descents, queue times (when published), day replay, services + viewpoints layer, wallet (pass/insurance, on-device), photo log (IndexedDB), friends leaderboard (stats files). SW is v14.
Tests (all pass): `node tools/test_tracking.mjs`, `test_route_js.mjs`, `test_stats.mjs`, `test_pistes_skied.mjs`, `test_sun.mjs`; `python3 tools/test_scrape_status.py`; `python3 tools/test_routes.py`.
Rules learned: every new helper used inside `renderLog`/GPS code needs a stub in tools/test_tracking.mjs (it slices index.html); bump `VERSION` in sw.js on every shipped change; `git pull --rebase` before push (the status bot will commit to main once its workflow exists).

## In progress (NOT committed)
1. **3D terrain view** (approved by James). Qwen was asked to write `map3d.js` from docs/sessions/briefs/qwen-map3d.md.
   - SRI to paste into it: maplibre-gl@4.7.1 JS `sha256-vpYzxNhw4m+zfxz+XFp3GBZnEUAD6hYgeseFDY2ordE=`, CSS `sha256-V2sIX92Uh6ZaGSFTKMHghsB85b9toJtmazgG09AI2uk=`.
   - ~~BLOCKER~~ RESOLVED 20 Nov 17:10: AWS Terrain Tiles DO send `Access-Control-Allow-Origin: *` on GET (the earlier check used HEAD). Use `https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png`. Backup: `tiles.mapterhorn.com` (webp, CORS ok).
   - Uncommitted prep in the working tree: 3D button (Leaflet control under the compass), `#map3d` overlay + close button, `open3D()` (guarded by `window.FC3D`), sw.js allow-list for maplibre-gl@4.7.1 + terrain host, TILE_MAX 1200. Still needed: `<script src="map3d.js">`, add `./map3d.js` to SHELL_FILES, SW version bump, browser test.
   - Qwen job q4 (queued after the rotate.js review) writes map3d.js from the brief, SRI already filled in.
   - Integration still to do: "3D" button on the map → container div → `FC3D.open(el, {center, zoom, geojson: vecData[resortId], path, esc})`; add `unpkg.com/maplibre-gl@4.7.1/` + the terrain host to `isAllowedCdn` in sw.js; SW bump.
2. **Avalanche bulletin** (approved). Findings: the public index `https://donneespubliques.meteofrance.fr/donnees_libres/Pdf/BRA/bra.YYYYMMDD.json` (keyless; sample in tests/fixtures/avalanche/) lists massifs + issue times; bulletins are public only as PDF `.../BRA/BRA.<MASSIF>.<YYYYMMDDHHMMSS>.pdf` (the XML URLs return HTML). Pre-season the index 302-redirects. Danger level 1–5 needs Météo-France's API key (James registers; key only as a GitHub secret).
   - Qwen was asked to write `tools/fetch_avalanche.py` + test (brief: docs/sessions/briefs/qwen-avalanche.md) → writes `data/status/avalanche.json` with the latest Haute-Tarentaise + Vanoise PDF links.
   - To do after review: add `python3 tools/fetch_avalanche.py` + commit of `data/status/avalanche.json` to `.github/workflows/status.yml` (once a day is enough); app: show "Avalanche bulletin · Haute-Tarentaise · issued 15:20 →" buttons (status card or SOS/off-piste warning), fetched network-first like the status file.
   - Qwen output files were in Claude's session scratchpad; if lost, rerun: `tools/qwen.sh "$(cat docs/sessions/briefs/qwen-map3d.md)"` (same for qwen-avalanche.md), take the code blocks, review, run tests.

## Blocked on James
- `.github/workflows/status.yml` on GitHub is EMPTY (James created it, paste didn't take; runs fail). Full content: docs/github-workflow-status.yml → paste into the file on GitHub. Neither the git token nor gh has the `workflow` scope.
- iPhone tests: open twice with signal → airplane mode → Map/Paradiski; route; SOS; photo; Track day on a walk.
- Step 7: names/grades vs the official 2026–27 map (only 16 greens; unmatched names in data/status/paradiski.json).
- Decide: phone-motion "turn analysis" (free Carv-lite)? Météo-France API key for the danger level?

## How to delegate
- Codex (usage resets 19:13 on 20 Nov): `~/.local/bin/codex exec -s workspace-write -C ~/code/first-chair "Read docs/sessions/HANDOFF.md and do item N"` (add `-c sandbox_workspace_write.network_access=true` for research).
- Qwen (local, free, text only): `tools/qwen.sh "instruction" file...`; a human or Claude/Codex must apply + test its code.
