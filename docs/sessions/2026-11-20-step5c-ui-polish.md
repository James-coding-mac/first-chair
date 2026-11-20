# Step 5c — polished lift-signage UI

20 November 2026. Implemented locally; not committed or pushed. Claude review pending.

## Scope and changes

- Changed `index.html`, `sw.js`, `docs/STATUS.md`, and this session note only. Existing untracked scraper/test/brief work was left alone.
- Replaced the presentation CSS with shared spacing, radii, surfaces, typography and colour tokens; retained legacy token aliases. Added automatic dark surfaces, themed Leaflet controls/popups, outlined black-grade markers, focus rings and reduced-motion support.
- Kept the navy sticky header and native resort select; added a compact read-only cached weather chip with village temperature, snow and a cache timestamp tooltip. Missing/invalid values hide it. Existing weather paint paths refresh it without extra requests or storage writes.
- Made the map the first element, with existing Locate/Track controls floating over its bottom. Route search has a search icon and scrollable difficulty pills. The tracker remains below for stats, recovery and save controls.
- Added inline SVG navigation icons, translucent blurred navigation, 40px temperature displays, compact wind/freezing rows, grouped run/eat/log lists, larger favourite/star targets, row chevrons, 180ms expansion transitions, and route timeline dots with aligned times.
- Kept all existing IDs and classes; renamed IDs/classes: **none**. Added presentation wrappers/classes and `condition-chip`. Favourite is now a native button with its original class/listener and pressed state.
- SW VERSION bumped from v6 to v7. No tracking/routing algorithm, data file, storage schema, dependency, host, scraper or workflow changes.
- Glacier brand colour remains #3D7FB8; filled controls use the darker glacier shade #316FA3 with white text to meet 4.5:1 contrast (5.34:1).

## Verification

- `node --check sw.js` and extracted main inline script: pass.
- `node tools/test_tracking.mjs`: all 12 analysis cases and UI/storage lifecycle checks pass.
- `node tools/test_route_js.mjs`: directed-path, safety/filter, snapping, graph, cancellation and UI checks pass; Python parity remains 8/7/6/0 reachable under all/red/blue/green, times within 1%.
- Compared pre/post literal IDs: none removed; only dynamic `tab-` prefix is absent as a literal ID. All original storage key strings retained.
- Header-chip isolated checks: missing cache hides, negative temperature/zero snow display, null temperature hides.
- Sampled light/dark text pair contrast calculations: 5.11:1–8.62:1 (not a full rendered accessibility audit).
- `git diff --check`: pass.

## Remaining checks

Browser visual verification could not run: the sandbox rejected binding the local HTTP server, the browser access host was unavailable, and computer-use access to Chrome was denied. No approval override was available. Do not treat mobile layout or dark mode as visually signed off.

Claude/James should review 360px and desktop light/dark layouts, native select truncation with the condition chip, long names, all star targets, expanded row notes, route timeline, map controls/attribution, safe-area insets, and offline/PWA refresh on iPhone. Real GPS and offline install checks from earlier steps also remain pending. No commit or push performed.
