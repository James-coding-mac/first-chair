# Status

**Updated:** 20 Nov 2026
**Current step:** Step 2 (offline map) built and tested locally; see docs/sessions/2026-11-20-step2-offline-map.md. Next is Step 3 (weather by altitude).

- Live at https://james-coding-mac.github.io/first-chair/ (Paradiski included once the push has gone through; James to check on the iPhone).
- **Paradiski** is in the resort switcher: 293 runs (La Plagne + Les Arcs/Peisey), 211 restaurants (47 on the mountain, 164 village), 152 lifts in the data (drawn on the map; no lift list screen). Every record shows an UNVERIFIED tag.
- Data pipeline: `tools/fetch_paradiski.sh` (Overpass → `data/raw/`, gitignored) → `python3 tools/build_paradiski.py` → `data/build/paradiski.js` (committed, loaded by `index.html`, precached by `sw.js`). **After rebuilding, bump `VERSION` in `sw.js`, and read the builder's WARNING list: names key saved notes (DECISIONS.md → Known risk).**
- Base = Plagne Bellecôte, 45.51389, 6.69709, from OSM `place=hamlet` way 1427752417. Map centre and weather point use it.
- Off-piste (OSM freeride / backcountry) routes are listed under a "⚠ Off-piste" filter with a warning and a link to the Météo-France BERA (Alpes du Nord page; there's no stable per-massif URL).
- Known data gaps (for Step 7 checking): only 16 greens (OSM mappers here rarely use `novice`), 356 unnamed piste segments skipped, runs have no "lift" field yet (Step 5 routing will add it), some same-named runs carry a sector suffix or #1/#2.
- Codex CLI: `~/.local/bin/codex` (logged in). Qwen: LM Studio :1234, `tools/qwen.sh`.
- Token ticker: Übersicht widget `first-chair-tokens`; numbers come from `tools/token_usage.py`.
- Offline map (Step 2): Paradiski pistes/lifts/restaurants drawn from `data/build/paradiski-map.geojson` (canvas vectors); Leaflet precached by the SW. No bulk tile prefetch (OSM tile policy), so the background map offline = tiles you've already viewed.
