# Brief for Codex: Step 6a, lift/piste open-status scraper (no app UI yet)

Read first: CLAUDE.md, AGENTS.md, docs/SECURITY.md, docs/DATA-SOURCES.md. **Only create/edit**: `tools/scrape_status.py`, `tools/test_scrape_status.py`, `tests/fixtures/status/*`, `data/status/paradiski.json`, `.github/workflows/status.yml`, and a short section in `docs/DATA-SOURCES.md`. Another agent is editing index.html, sw.js, route.js and tools/build_paradiski.py — do not touch them. Python 3.9 stdlib only (urllib, html.parser, json, re). You have network access for research and fixtures.

## Context
The season opens 12 Dec 2026 (James's trip starts then); right now everything is closed, so the scraper must be built from the page/feed **structure** and fixtures, and must handle "all closed" and "season not started" correctly.

Known sources (verify each; respect robots.txt — fetch and check the full file for Disallow rules covering the paths; identify with `User-Agent: first-chair-personal/0.1 (+https://github.com/james-coding-mac/first-chair)`; never more than one request per source per run):
1. La Plagne live panel: `https://www.la-plagne.com/encart-live/ajax` (Drupal AJAX JSON; HTML in `[0].data`; currently shows open pistes by colour "Vert 0/0 …" and weather). Find the "Infos piste détaillées" target for per-lift/per-piste detail.
2. Les Arcs live page: `https://www.lesarcs.com/fr/les-arcs-en-direct` ("Remontées ouvertes 0/52", "Pistes ouvertes", a "Détails" link → find the per-lift page).
3. Lumiplan interactive map for Paradiski: `https://lumiplay.link/interactive-map/Paradiski/fr` (JS app). Inspect its JS bundle/network calls to find the JSON it loads with per-lift/per-piste status. Use it only if it's a plain public GET without keys/tokens or anti-bot measures; if it needs a token or a signed request, do NOT use it and say so.
Prefer the most structured source; fall back to the others for summaries.

## Output `data/status/paradiski.json`
```
{ "v":1, "fetched_at":"<ISO UTC>", "season_open": true|false|null,
  "sources":[{"id","url","ok":bool,"error":str|null}],
  "summary":{"LP":{"lifts_open":n,"lifts_total":n,"pistes":{"green":[o,t],"blue":[o,t],"red":[o,t],"black":[o,t]}}, "LA":{...}},
  "lifts":{"<OSM lift name>":"open"|"closed"|"scheduled"|"unknown"},
  "pistes":{"<OSM run name>":"open"|"closed"|"unknown"},
  "unmatched":{"lifts":[source names...],"pistes":[...]} }
```
Match source names to the names in `data/build/paradiski.js` (lifts[].name, runs[].name; read it as JSON after `= `): case/accent/punctuation-insensitive, strip prefixes like "TS"/"TSD"/"TC"/"TK"/"Télésiège", report anything unmatched — never guess a match below an exact normalised match unless it's unique. Missing values = "unknown", never invent "open".
If every source fails, keep the previous file's lifts/pistes but set `sources[].ok=false` and keep the old `fetched_at` (the app shows age). Exit 0 so the Action doesn't spam failures, but print errors.

## Tests
Save the current responses as fixtures (`tests/fixtures/status/`) and write `tools/test_scrape_status.py` (unittest) covering: parsing each fixture, "all closed / pre-season", a hand-made "partly open" variant of each fixture (edit the fixture HTML/JSON to mark a few lifts open, clearly named `*_synthetic_open.*`), name matching, a failed source, and malformed input. No network in tests.

## GitHub Action `.github/workflows/status.yml`
- `schedule`: every 15 min 07:00–17:00 UTC (cron), plus `workflow_dispatch`.
- `permissions: contents: write` only. Steps: checkout, setup-python 3.x (pinned major action versions), run the scraper, then commit `data/status/paradiski.json` **only if** lifts/pistes/summary changed or the committed `fetched_at` is older than 60 min; commit as `github-actions[bot]` with message `status: update Paradiski lift/piste status`; `git pull --rebase` before push; concurrency group so runs don't overlap.
- Note in DATA-SOURCES.md: sources, what's scraped, frequency, robots.txt result, and that terms must be re-checked before any public launch.

## Done when
`python3 tools/test_scrape_status.py` passes; a live run of `python3 tools/scrape_status.py` writes a valid file (all closed pre-season). Do NOT commit/push. Finish with: chosen sources + robots.txt findings, whether Lumiplan was usable, match stats, known gaps.
