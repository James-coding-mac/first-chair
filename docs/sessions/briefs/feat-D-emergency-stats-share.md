# Brief for Codex: Feature D, emergency card + season stats + shareable day card

Read first: CLAUDE.md, AGENTS.md, docs/SECURITY.md, docs/DECISIONS.md (UI = polished lift-signage; match the redesigned components/tokens already in index.html). Edit `index.html` (and `sw.js` VERSION bump) only, unless stated. Offline-first; no new external hosts; all text via esc()/textContent.

## 1. "Where am I" emergency card (all resorts)
- An "SOS / Where am I" pill on the Map tab (red outline, top-right of the map or next to Locate). Opens a full-width sheet/card:
  - Live GPS lat/lon in **decimal (5 dp) and degrees-minutes** + accuracy (m) + altitude if available; updates live; works offline.
  - Nearest piste name + grade + sector (Paradiski: from the map GeoJSON/graph; others: omit) and nearest lift name, with distance.
  - Big **"Call 112"** button (`tel:112`) — 112 is the EU emergency number. **Do not add any other phone numbers** (no piste-rescue numbers unless they come from a verified data file — none exists yet; leave a code comment where James can add confirmed ones).
  - "Copy details" button (Clipboard API, with fallback text selection) producing a plain text block: coordinates, nearest piste/lift, time.
  - If no fix yet: "Getting your position… go outside / clear view of the sky"; if permission denied: how to enable.
- Reuse the existing geolocation watch helpers (`ensureWatch`/`maybeStopWatch`), don't create a second watch.

## 2. Season stats (Log tab)
A stats card at the top of the Log tab computed from `fc_log`: days logged, days per resort, and from entries with `track` data: total runs, total vertical, total distance, best day vertical, top speed. Filter pills: All / per resort. Pure function `seasonStats(entries)` — put it in `track.js`? No: put it in a new small file `stats.js` (`window.FCStats`) with a node test `tools/test_stats.mjs` (old entries without track, mixed, empty). Precache stats.js.

## 3. Shareable day card
- On each log entry that has `track` data, and on the tracker summary after stopping: a "Share" button.
- Draws a 1080×1350 image on a `<canvas>`: navy background, FIRST CHAIR wordmark (Barlow, already loaded — wait for `document.fonts.ready`), resort name, date, big vertical number, runs, distance, top speed, a tiny sparkline/elevation profile if runs exist, and the user's notes NOT included (privacy). No map tiles (tainted canvas).
- Share via `navigator.share({files:[File]})` when `navigator.canShare` supports files (iOS Safari does); otherwise download the PNG (`<a download>`).
- Pure drawing function `drawDayCard(ctx, data)` in `stats.js` so it's testable for no-crash with a stub ctx.

## sw.js
Add stats.js to SHELL_FILES; bump VERSION.

## Done when
node --check passes; `node tools/test_stats.mjs`, `node tools/test_tracking.mjs`, `node tools/test_route_js.mjs` pass. Do NOT commit/push. Finish with files changed, tests, gaps.
