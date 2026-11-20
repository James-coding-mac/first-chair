# Brief for Codex: Feature E, pistes skied today

Read first: CLAUDE.md, AGENTS.md, docs/DECISIONS.md. Paradiski only (needs the map GeoJSON). Edit track.js, index.html, tools/test_tracking.mjs, sw.js (VERSION bump) only.

## Goal
When a Track day session is analysed, match each **run** (from FCTrack.analyse) to the named pistes it followed, using the Paradiski map GeoJSON piste lines (`properties.k==="piste"`, `n` = name, `g` = grade).
- Matching: for each run, sample its points every ~20 m; a piste counts as skied if ≥ 60% of a ≥ 150 m stretch of the run lies within 25 m of that piste's line AND the movement direction roughly follows the line (angle < 60°). Unnamed pieces don't count. Return per run an ordered list of piste names (collapsed), and for the day a set of names.
- Pure function in track.js: `FCTrack.matchPistes(runs, pisteLines)`; spatial grid index for speed (≥ 1,300 lines).
- Tests: synthetic run following a real piste line from the GeoJSON (take one from the file) ⇒ matched; parallel piste 60 m away ⇒ not matched; lift ride ⇒ nothing; run crossing a piste perpendicular ⇒ not matched.

## UI
- Tracker summary + log entry: "Pistes: Geisha, Roc du Diable, …" per run (store in the log entry's `track.runs[i].pistes` — optional field, old entries fine).
- Map: a layer "Skied today" (in the layers menu) highlighting today's skied pistes (thicker, glow/outline) from the current/latest saved session.
- Runs tab: a "Skied" filter pill and a small ✓ badge on runs whose name was skied on any logged day (Paradiski run names = runs[].name in paradiski.js; note runs may carry a "(village)" suffix — match on the base name before " (").
- Season counter on the Log stats card if present: "Pistes skied: 23 / 293".

## Done when
node --check passes; tracking/route tests pass. Do NOT commit/push. Report files, tests, gaps.
