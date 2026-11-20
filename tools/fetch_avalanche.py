#!/usr/bin/env python3
"""Latest Météo-France avalanche bulletin (BERA) links for the Paradiski massifs -> data/status/avalanche.json.
Public keyless index; bulletins are PDFs. Written by local Qwen from docs/sessions/briefs/qwen-avalanche.md, reviewed by Claude.
Run: python3 tools/fetch_avalanche.py (the status GitHub workflow runs it)."""
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, date, timedelta, timezone
from pathlib import Path

MASSIFS = ("HAUTE-TARENTAISE", "VANOISE")
OUTPUT = Path(__file__).resolve().parents[1] / "data" / "status" / "avalanche.json"
UA = "first-chair-personal/0.1 (+https://github.com/james-coding-mac/first-chair)"
MAX_SIZE = 1_000_000


class NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    """Raise on redirects instead of following them."""
    def http_error_301(self, req, fp, code, msg, headers):
        raise urllib.error.HTTPError(req.full_url, code, msg, headers, fp)
    def http_error_302(self, req, fp, code, msg, headers):
        raise urllib.error.HTTPError(req.full_url, code, msg, headers, fp)


def index_url(d):
    """Return the daily index URL for a given date."""
    return f"https://donneespubliques.meteofrance.fr/donnees_libres/Pdf/BRA/bra.{d:%Y%m%d}.json"


def pdf_url(massif, heure):
    """Return the PDF URL for a massif and timestamp."""
    return f"https://donneespubliques.meteofrance.fr/donnees_libres/Pdf/BRA/BRA.{massif}.{heure}.pdf"


def parse_index(raw_text):
    """Parse index JSON and return {massif: latest_heure} for MASSIFS."""
    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON: {e}") from e
    if not isinstance(data, list):
        raise ValueError("Index is not a JSON list")
    result = {}
    for entry in data:
        if not isinstance(entry, dict):
            continue
        massif = entry.get("massif")
        heures = entry.get("heures")
        if massif not in MASSIFS or not isinstance(heures, list):
            continue
        for h in heures:
            if isinstance(h, str) and len(h) == 14 and h.isdigit():
                if massif not in result or h > result[massif]:
                    result[massif] = h
    return result


def collect(fetch, today):
    """Fetch today/yesterday index and return structured result dict."""
    result = {
        "v": 1,
        "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "Météo-France BERA (donneespubliques.meteofrance.fr)",
        "massifs": {m: None for m in MASSIFS},
        "ok": False,
        "error": None
    }
    error_msg = None
    parsed = None
    for d in (today, today - timedelta(days=1)):
        try:
            raw = fetch(index_url(d))
            parsed = parse_index(raw)
            break
        except Exception as e:
            error_msg = str(e)
    if parsed is None:
        result["error"] = error_msg or "Failed to fetch index"
        return result
    result["ok"] = True
    for m in MASSIFS:
        heure = parsed.get(m)
        if heure:
            issued = datetime.strptime(heure, "%Y%m%d%H%M%S").isoformat()
            result["massifs"][m] = {"issued": issued, "pdf": pdf_url(m, heure)}
    return result


def _real_fetch(url):
    """Fetch URL text with custom opener, timeout, and size limit."""
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    opener = urllib.request.build_opener(NoRedirectHandler)
    with opener.open(req, timeout=30) as resp:
        data = resp.read(MAX_SIZE + 1)
        if len(data) > MAX_SIZE:
            raise ValueError("Response exceeds 1 MB limit")
        return data.decode("utf-8")


def main():
    """Run collection, handle fallback, write atomically, print summary."""
    new_data = collect(_real_fetch, date.today())
    if not new_data["ok"] and OUTPUT.exists():
        try:
            with open(OUTPUT, "r", encoding="utf-8") as f:
                old_data = json.load(f)
            if old_data.get("ok") and all(v is not None for v in old_data.get("massifs", {}).values()):
                new_data["massifs"] = old_data["massifs"]
                new_data["fetched_at"] = old_data["fetched_at"]
        except Exception:
            pass
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = OUTPUT.with_suffix(".tmp")
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(new_data, f, indent=2, ensure_ascii=False, sort_keys=True)
        f.write("\n")
    os.replace(tmp_path, OUTPUT)
    status = "ok" if new_data["ok"] else f"failed ({new_data['error']})"
    print(f"Avalanche fetch: {status}")
    sys.exit(0)


if __name__ == "__main__":
    main()
