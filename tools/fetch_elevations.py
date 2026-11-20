#!/usr/bin/env python3
"""Look up terrain elevation for every piste/lift junction and end point in the Paradiski OSM data.

Input : data/raw/paradiski-overpass.json
Output: data/raw/elevations.json   {"<osm node id>": metres}   (gitignored; re-run to refresh)

Source: Open-Meteo elevation API (Copernicus DEM, ~90 m; free, no key). Only points not already
in the output are fetched, 100 per request. Each point counts against Open-Meteo's per-minute
limit, so it paces itself and backs off on HTTP 429. Takes several minutes; safe to re-run.
Run: python3 tools/fetch_elevations.py
"""
import collections
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw", "paradiski-overpass.json")
OUT = os.path.join(ROOT, "data", "raw", "elevations.json")
API = "https://api.open-meteo.com/v1/elevation"


def main():
    els = json.load(open(RAW, encoding="utf-8"))["elements"]
    ways = [e for e in els if e["type"] == "way" and e.get("nodes") and
            (e.get("tags", {}).get("piste:type") == "downhill" or e.get("tags", {}).get("aerialway"))]
    use = collections.Counter(n for w in ways for n in w["nodes"])
    wanted = {}
    for w in ways:
        for i, n in enumerate(w["nodes"]):
            # graph nodes: way ends, plus any point shared by two or more ways (a junction)
            if i in (0, len(w["nodes"]) - 1) or use[n] > 1:
                g = w["geometry"][i]
                wanted[str(n)] = (g["lat"], g["lon"])
    have = json.load(open(OUT)) if os.path.exists(OUT) else {}
    todo = [k for k in wanted if k not in have]
    print("%d graph points, %d already cached, fetching %d" % (len(wanted), len(have), len(todo)))
    for i in range(0, len(todo), 100):
        chunk = todo[i:i + 100]
        q = urllib.parse.urlencode({
            "latitude": ",".join("%.5f" % wanted[k][0] for k in chunk),
            "longitude": ",".join("%.5f" % wanted[k][1] for k in chunk)})
        req = urllib.request.Request(API + "?" + q, headers={"User-Agent": "first-chair-personal/0.1"})
        for attempt in range(6):
            try:
                data = json.load(urllib.request.urlopen(req, timeout=60))
                break
            except urllib.error.HTTPError as err:
                if err.code != 429:
                    raise
                print("  rate-limited, waiting 65 s")
                time.sleep(65)
        else:
            sys.exit("still rate-limited; re-run later (progress is saved)")
        if len(data.get("elevation", [])) != len(chunk):
            sys.exit("unexpected reply: %s" % str(data)[:200])
        have.update({k: round(v) for k, v in zip(chunk, data["elevation"])})
        with open(OUT, "w") as f:
            json.dump(have, f)
        print("  %d/%d" % (min(i + 100, len(todo)), len(todo)))
        time.sleep(12)   # ~500 points a minute, under the free limit
    print("saved %d elevations to %s" % (len(have), os.path.relpath(OUT, ROOT)))


if __name__ == "__main__":
    main()
