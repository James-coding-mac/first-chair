# Step 4 — day tracking (20 November 2026)

Implemented the tracking brief; not committed or pushed. Awaiting Claude review.

## Files
- `track.js`: pure `window.FCTrack` analysis, point filtering/thinning and lift-line proximity.
- `index.html`: Track day controls, live state/totals, recovery, save summary with optional run records, backward-compatible log rendering.
- `sw.js`: v5 shell, precaches track.js.
- `tools/test_tracking.mjs`: synthetic analysis tests and tracker handler/storage tests.
- `docs/STATUS.md` and this session note.

Weather, map vector rendering and route-graph work were not modified. Lift geometry is read from the existing loaded GeoJSON. No dependencies, external hosts or storage migrations added. Only the new fc_track_live key and the existing log save destination are written by the tracking changes.

## Behaviour and assumptions
- Coordinates/accuracy/timestamps are validated; accuracy above 50 m and implied speeds above 130 km/h are rejected. The retained trace is thinned to at least 5 seconds OR 10 metres between points.
- Altitude uses a centred 20-second median, followed by a 40-second trend for robust ascent classification. At least 60 seconds of ascent above 0.3 m/s at below 30 km/h is required. Nearby lift geometry increases the reported confidence; ascent alone works without geometry.
- A non-lift stretch counts once its smoothed peak-to-trough drop reaches 30 m. This avoids adding every GPS oscillation to vertical. It is conservative on undulating runs; totals can adjust as the smoothing window fills and lifts are confirmed.
- Stops below 2 km/h for over 60 seconds show Stopped; only stops over five minutes split runs. Short stops remain part of run duration/average speed. Gaps over two minutes and explicit resume boundaries split segments and contribute no interpolated distance/time.
- With no altitude, moving points near a lift line (below 30 km/h) count as lift travel; other moving stretches count as runs, with unknown vertical. Partial altitude loss is not interpolated and can undercount vertical.
- Recovery persists every 30 seconds, on stop, pagehide and visibility loss. Storage failure is shown inline. A killed tab can lose up to the last persistence interval. A session retains its starting resort and local calendar date. Today's sessions offer Resume / Save / Discard; older sessions offer Save / Discard with Resume disabled. Save writes the log before clearing recovery; a stable entry id prevents duplicate retries.
- Saved runs contain start/end timestamps, vertical, distance, duration, top speed and average speed. Existing text-only log entries continue to render.

## Validation
`node tools/test_tracking.mjs`: all 12 analysis cases pass, plus UI/storage handler checks.

- Three noisy lift/run cycles: 3 runs, 3 lifts, 1,167 m vertical (target 1,200 m ±10%).
- Valley drive at 110 km/h: 1 run, approximately 295 m vertical. Documented limitation: this algorithm cannot distinguish downhill driving from skiing below the rejection threshold; stop tracking before driving.
- Flat noisy walk: zero runs/lifts.
- No altitude: moving fallback produces a run and null vertical.
- Injected GPS jump and poor accuracy fix: both dropped; day totals preserved.
- Gondola with geometry: one lift, geometry confidence; also verified without altitude.
- Short/long pauses, stopped state, reload gap, invalid fixes and empty trace pass.
- In-memory UI tests: start, persistence, reload, resume, stop, failed-save retention, successful save/cleanup, old log rendering, stale-session discard.
- `node --check` passes for track.js, sw.js and the extracted main inline script; `git diff --check` passes.

## Remaining device checks
No browser layout, iPhone GPS, real walk/drive or offline service-worker install test was performed. Claude should review, then James should check screen-on tracking, GPS permission denial, reload recovery, log details and offline launch on the iPhone. GPS noise can still inflate horizontal distance/speed; small drops, shallow/slow lifts and parallel lift/piste geometry can be misclassified. No background tracking is promised.
