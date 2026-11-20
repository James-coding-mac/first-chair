# Brief for Codex: fix the 11 findings in docs/sessions/codex-review-2-findings.md

Read CLAUDE.md, AGENTS.md, docs/SECURITY.md and the findings file. Fix all 11, minimal and in the existing style (match surrounding code; no refactors, no new dependencies). Specific decisions (from Claude, the reviewer):
1. scrape_status.py: lift ownership = the sector being matched; only LIFT_ALIASES targets may override to their own catalog sector. Add a test with a same-named lift in both sectors (e.g. "Arpette").
2. Season detection: `season_open` = true if any item OPEN; false only if every item is OUT_OF_PERIOD; otherwise null (in season but closed, e.g. storm/night). In index.html, `statusLive()` = statusData exists and `season_open !== false`; `statusFresh()` unchanged otherwise. Update the status card wording for null ("Lifts reported closed"). Tests for all-CLOSED vs all-OUT_OF_PERIOD.
3. steep.js: on tile load error draw a light grey diagonal-hatch tile (so missing data never looks like gentle terrain) and have the legend show "grey hatch = no data (needs signal)".
4. Add `parisMinutes()` (Intl.DateTimeFormat timeZone "Europe/Paris", h23) and use it wherever "now" is compared with lift closing times (last-lift-home and the route last-lift warnings). Leave display of other times alone.
5. Last-lift-home: if `statusData.fetched_at` is older than 24 h or missing, keep the deadline but add a clear line "Closing times from <date> — may have changed".
6. Route closures: block lifts whose status is "scheduled" as well as "closed".
7–8. map3d.js: generation counter so close() during loading cancels; on any load/terrain error remove the instance; on library load failure reset loadPromise and remove the failed <script>/<link> so a later tap retries.
9. rotate.js: wrap map.fitBounds so padding includes the rotor margins ((D-W)/2, (D-H)/2) so fitted content stays inside the visible container.
10. renderLog (and any code reading stored track data: season stats, pistes skied, replay, share): skip non-object entries in track.runs/rides/path instead of throwing.
11. Replay: clock origin = validated `entry.track.t0` (number), falling back to entry.id then date 09:00.
Bump `VERSION` in sw.js. Keep all existing tests passing (node tools/test_*.mjs, python3 tools/test_scrape_status.py, python3 tools/test_routes.py) and add tests where the code is testable. If test harnesses that slice index.html need stubs for new helpers, add them. Do NOT commit or push. Finish with files changed, tests run, anything you couldn't do.
