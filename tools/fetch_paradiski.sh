#!/bin/bash
# Download Paradiski pistes, lifts and food/drink places from OpenStreetMap (Overpass API) into data/raw/.
# Data © OpenStreetMap contributors, ODbL. Retries a second server if the first is busy.
cd "$(dirname "$0")/.." && mkdir -p data/raw
Q='[out:json][timeout:150];(way["piste:type"="downhill"](45.44,6.60,45.65,6.92);way["aerialway"](45.44,6.60,45.65,6.92);nwr["amenity"~"restaurant|cafe|bar|fast_food"](45.44,6.60,45.65,6.92););out geom;'
for u in https://overpass-api.de/api/interpreter https://overpass.private.coffee/api/interpreter; do
  curl -sf -m 200 -A "first-chair-personal/0.1" "$u" --data-urlencode "data=$Q" -o data/raw/paradiski-overpass.json \
    && python3 -c 'import json;json.load(open("data/raw/paradiski-overpass.json"))' 2>/dev/null && echo "ok: $u" && exit 0
done
echo "all Overpass servers failed" >&2; exit 1
