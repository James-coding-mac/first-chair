Write TWO Python 3.9 files (stdlib only: urllib, json, datetime, argparse, pathlib, unittest). Output exactly two fenced code blocks: first ```python for tools/fetch_avalanche.py, then ```python for tools/test_fetch_avalanche.py. No other text.

Context: Météo-France publishes a public daily index of avalanche bulletins (BERA) as JSON at
  https://donneespubliques.meteofrance.fr/donnees_libres/Pdf/BRA/bra.YYYYMMDD.json
Example content (a list):
  [{"massif": "HAUTE-TARENTAISE", "heures": ["20251215152046"]}, {"massif": "VANOISE", "heures": ["20251215152049"]}, {"massif": "QUEYRAS", "heures": ["20251215144946"]}]
Each "heures" value is a timestamp YYYYMMDDHHMMSS (French local time). The bulletin PDF for a massif and timestamp is:
  https://donneespubliques.meteofrance.fr/donnees_libres/Pdf/BRA/BRA.<MASSIF>.<heure>.pdf
Outside the season (or before today's publication) the index URL returns an HTTP 302 redirect to an HTML page, or HTML instead of JSON.

tools/fetch_avalanche.py:
- MASSIFS = ("HAUTE-TARENTAISE", "VANOISE"); OUTPUT = repo_root/data/status/avalanche.json where repo_root = Path(__file__).resolve().parents[1].
- UA = 'first-chair-personal/0.1 (+https://github.com/james-coding-mac/first-chair)'. Do NOT follow redirects (use a custom HTTPRedirectHandler that raises); timeout 30 s; max 1 MB response.
- function index_url(date) -> str; pdf_url(massif, heure) -> str.
- function parse_index(raw_text) -> dict {massif: latest_heure} for the MASSIFS only; raise ValueError if not a JSON list of dicts; ignore malformed entries; latest = max of valid 14-digit heures.
- function collect(fetch, today) -> dict: try today's index, then yesterday's (so a bulletin issued yesterday afternoon still shows in the morning). Result:
  {"v":1, "fetched_at": "<UTC ISO, seconds, Z suffix>", "source": "Météo-France BERA (donneespubliques.meteofrance.fr)",
   "massifs": {"HAUTE-TARENTAISE": {"issued": "2025-12-15T15:20:46", "pdf": "<url>"} | null, "VANOISE": ... },
   "ok": bool, "error": str|null}
  issued is the heure formatted as ISO local time without timezone. If both days fail: ok false, massifs all null, error = short message. `fetch(url)` returns text or raises.
- main(): runs collect with a real fetcher (urllib, the no-redirect opener), `today` = date.today(); if the new result has ok false and an existing OUTPUT file has ok true and its massifs non-null, keep the old massifs but set ok false/error and keep old fetched_at (so the app shows the age). Write atomically (temp file then replace), json indent 2, ensure_ascii False, sort_keys True. Print one summary line. Always exit 0.
tools/test_fetch_avalanche.py (unittest, no network): import fetch_avalanche after inserting its directory into sys.path (so it works with `python3 -I`). Tests: parse_index picks latest heure per massif and ignores others/malformed; non-list JSON raises; collect uses today when available; falls back to yesterday when today's fetch raises; both fail -> ok False and null massifs; pdf_url format; issued ISO formatting.
Style: 4-space indent, short docstrings, no print in library functions except main.
