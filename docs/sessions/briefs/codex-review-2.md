# Brief for Codex: independent bug + security review (read-only)

Read CLAUDE.md, AGENTS.md, docs/SECURITY.md first. Review the app code changed in `git diff ae002db..HEAD -- index.html sw.js *.js tools/*.py` (everything since the last independent review after Step 2). Do NOT edit files.

Focus, in order:
1. Security: XSS (every innerHTML / template literal with data from OSM, Lumiplan status JSON, Open-Meteo, Météo-France, imported friend stats files, URL fragment `#spot=`, user-typed wallet fields, photo metadata); URL schemes in generated links; service-worker caching (allow-list, cache poisoning, unbounded growth, opaque responses); localStorage/IndexedDB data that could break the app if malformed.
2. Correctness bugs a skier would hit: routing/closures, last-lift-home deadline maths, tracking save, rotation (rotate.js) with popups/drag/zoom, 3D (map3d.js) open/close, steepness tiles, replay, photos, friends import.
3. Offline behaviour: anything that silently breaks with no signal.

Report: max 15 findings, most severe first, each with file:line, concrete failure scenario, and a minimal fix. Say "no issue" for areas you checked and found fine (one line). Under 600 words.
