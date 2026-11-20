# Brief for Codex: Step 4, tracking upgrade (auto-split runs vs lifts, vertical, day totals)

Read first: CLAUDE.md, AGENTS.md, docs/SECURITY.md. Look at the existing GPS section in `index.html` (`ensureWatch`, `onPos`, track/trkStart/trkDist/trkDescent, the Track run button, save-to-log) and the Log rendering (`renderLog`, `fc_log` entries). **Do not touch**: `tools/build_routes.py`, `tools/test_routes.py`, `data/build/paradiski-graph.json` (another agent is creating them), the weather code, or the map vector code except to read lift lines from it.

## Goal
One "Track day" session (rename the button text; keep the same button) that, while the screen is on, automatically splits the GPS trace into **lift rides** and **runs**, and shows live: current state (On lift / Skiing / Stopped), runs so far, total vertical skied, distance skied, top speed, lift rides. "Save to log" stores the day summary.

## Design
- Put the analysis in a **new file `track.js`** (plain script, no modules, defines `window.FCTrack = { analyse(points, opts) , ... }`), loaded by `index.html` with `<script src="track.js">` before the main script, so it can be unit-tested in node. Pure functions, no DOM.
- Points: `{lat, lon, alt, acc, t}` (alt may be null). Drop points with accuracy > 50 m; drop jumps implying > 130 km/h.
- Smooth altitude (median over ~20 s window) before using it; GPS altitude is noisy.
- **Lift** = sustained ascent (smoothed vertical speed > +0.3 m/s over ≥ 60 s) at < 30 km/h; boost confidence if the points lie within 40 m of a lift line when lift geometry is available (`opts.lifts` = array of polylines [[lat,lon],...]; in the app, take them from the Paradiski map GeoJSON features with `properties.k==="lift"` if loaded; otherwise ascent rule only, so Whistler etc. still work).
- **Run** = contiguous non-lift stretch with ≥ 30 m smoothed descent. **Stopped** = < 2 km/h for > 60 s (does not end a run unless > 5 min).
- If altitude is missing entirely, fall back to: on a lift line = lift, else moving = skiing; show vertical as "—".
- Per run: start/end time, vertical drop, distance, duration, top speed, avg speed. Totals: runs, vertical, distance, top speed, lift rides, time skiing.

## Robustness
- Persist the live session to a **new** key `fc_track_live` (points thinned to ≥ 5 s or ≥ 10 m apart) every ~30 s, so an iOS reload/tab kill doesn't lose the day; on load, if one exists from today, offer "Resume tracking / Save / Discard" (use buttons in the tracker card, not alert/confirm). Remove the key when saved/discarded. Don't touch other `fc_` keys.
- Log entries: keep the existing entry shape and text summary (existing renderLog must show old and new entries); add an optional `track: { totals, runs:[...] }` field. Show per-run lines in the log entry only if present.
- All text via `esc()`/textContent; numbers via Number().
- Keep the screen-on caveat text.

## Tests (required): `tools/test_tracking.mjs`
Run with `node tools/test_tracking.mjs`; it loads `track.js` (e.g. `vm.runInNewContext` with a fake `window`) and checks synthetic days: (1) 3 × [chairlift up 400 m in 8 min → ski down 400 m in 5 min with noisy alt ±8 m] ⇒ 3 runs, 3 lifts, vertical ≈ 1200 m ±10%; (2) a car drive down a valley road (fast, long, descending ~300 m) ⇒ flagged as > 100 km/h spikes dropped / or reasonable output, document what happens; (3) a flat walk ⇒ 0 runs; (4) no altitude at all; (5) GPS jump outliers; (6) gondola ride with lift geometry provided. Print a table; exit non-zero on failure.

## sw.js
Add `./track.js` to `SHELL_FILES` and bump `VERSION` to `v5`.

## Done when
`node --check` passes for track.js, sw.js and the main inline script; `node tools/test_tracking.mjs` passes. Do NOT commit or push. Finish with files changed, test output summary, known gaps.
