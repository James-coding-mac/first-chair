# HANDOFF (20 Nov 2026, updated 18:20): read this first, then CLAUDE.md and docs/STATUS.md

Claude stopped here to save its context. Everything below is committed and LIVE unless marked otherwise.

## Live now (main, GitHub Pages)
Plan steps 1–6 + extras + rotatable map (two-finger twist, compass north-up/heading): Paradiski data, offline map, village/summit weather + snow depth, Track day (runs/lifts), offline routing (avoids closed lifts, last-lift warning), premium redesign, lift/piste status scraper (Lumiplan), SOS card + 112 + "Send my spot", season stats, share day card, pistes skied, sun on slopes, resort links, biggest descents, queue times (when published), day replay, services + viewpoints layer, wallet (pass/insurance, on-device), photo log (IndexedDB), friends leaderboard (stats files). SW is v14.
Tests (all pass): `node tools/test_tracking.mjs`, `test_route_js.mjs`, `test_stats.mjs`, `test_pistes_skied.mjs`, `test_sun.mjs`; `python3 tools/test_scrape_status.py`; `python3 tools/test_routes.py`.
Rules learned: every new helper used inside `renderLog`/GPS code needs a stub in tools/test_tracking.mjs (it slices index.html); bump `VERSION` in sw.js on every shipped change; `git pull --rebase` before push (the status bot will commit to main once its workflow exists).

## Done since 15:30 (live)
- Rotatable map (rotate.js, own code; two-finger twist, compass north-up / follow heading).
- Avalanche bulletins: tools/fetch_avalanche.py (Qwen-written, reviewed) → data/status/avalanche.json → buttons in the status card.
- 3D terrain view: map3d.js (Qwen-written, 2 bugs fixed by Claude), "3D" button under the compass. SW v18.
- Lesson: Qwen code is usable after review; Qwen *reviews* were mostly false positives (verify before acting).

## Blocked on James
- `.github/workflows/status.yml` on GitHub is EMPTY (James created it, paste didn't take; runs fail). Full content (now incl. the avalanche step): docs/github-workflow-status.yml → paste into the file on GitHub. Neither the git token nor gh has the `workflow` scope.
- iPhone tests: open twice with signal → airplane mode → Map/Paradiski; route; SOS; photo; Track day on a walk.
- Step 7: names/grades vs the official 2026–27 map (only 16 greens; unmatched names in data/status/paradiski.json).
- Decide: phone-motion "turn analysis" (free Carv-lite)? Météo-France API key for the danger level?

## How to delegate
- Codex (usage resets 19:13 on 20 Nov): `~/.local/bin/codex exec -s workspace-write -C ~/code/first-chair "Read docs/sessions/HANDOFF.md and do item N"` (add `-c sandbox_workspace_write.network_access=true` for research).
- Qwen (local, free, text only): `tools/qwen.sh "instruction" file...`; a human or Claude/Codex must apply + test its code.

## Update 20 Nov ~21:30 (all live, e868e81)
- Steepness layer, last lift home, lift names per ride, labels along lines (2D+3D, always readable), full 3D mode (GPS, route, replay, avalanche-terrain toggle), snow-relief background drawn in-app + First Chair draws all names (villages/peaks/lakes), map-type picker (Piste / Satellite (EOX Sentinel-2 2016) / Satellite only / Detailed OSM), speed & altitude graphs, hourly summit forecast. Codex review #2: 11 fixes.
- Proposed for AFTER the trip (James to confirm): generic per-resort pipeline config, then Tignes–Val d'Isère (~1 h), Three Valleys (~1–1.5 h), Whistler (~2–3 h, Vail status + Avalanche Canada). Keep James's hand-written runs/notes alongside OSM ones (names key favourites/notes).
- Workflow: Qwen writes standalone modules, Codex integrates/fixes/tests, Claude briefs + reviews + browser-tests. Test pages with SW unregistered + `fetch(f,{cache:'reload'})` + `?f=` URL, or the browser serves stale scripts.
