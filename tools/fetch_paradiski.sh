#!/bin/bash
# Download Paradiski pistes, lifts, food/drink places, services (ski shops, pharmacies, ATMs, toilets,
# doctors, defibrillators), village names, ski-area outlines and anything named Bellecôte from OpenStreetMap (Overpass API) into data/raw/. Then run tools/build_paradiski.py.
# Data © OpenStreetMap contributors, ODbL. Public Overpass servers are often busy: tries each server,
# three rounds, with a pause between rounds.
cd "$(dirname "$0")/.." && mkdir -p data/raw
B='45.44,6.60,45.65,6.92'
Q="[out:json][timeout:180];(
way[\"piste:type\"=\"downhill\"]($B);
way[\"aerialway\"]($B);
nwr[\"amenity\"~\"restaurant|cafe|bar|fast_food\"]($B);
node[\"place\"~\"village|hamlet|town|suburb|neighbourhood|locality\"]($B);
way[\"landuse\"=\"winter_sports\"]($B);
nwr[\"name\"~\"Bellec[oô]te\",i]($B);
nwr[\"shop\"~\"^(ski|sports)$\"]($B);
nwr[\"amenity\"~\"^(pharmacy|atm|toilets|doctors|clinic)$\"]($B);
node[\"emergency\"=\"defibrillator\"]($B);
);out geom;"
OUT=data/raw/paradiski-overpass.json
for round in 1 2 3; do
  for u in https://overpass-api.de/api/interpreter https://overpass.private.coffee/api/interpreter https://overpass.kumi.systems/api/interpreter; do
    curl -sf -m 240 -A "first-chair-personal/0.1" "$u" --data-urlencode "data=$Q" -o "$OUT.tmp" \
      && python3 -I -c 'import json,sys;json.load(open(sys.argv[1]))["elements"]' "$OUT.tmp" 2>/dev/null \
      && mv "$OUT.tmp" "$OUT" && echo "ok: $u" && exit 0
    echo "busy: $u" >&2
  done
  [ $round -lt 3 ] && sleep 30
done
rm -f "$OUT.tmp"; echo "all Overpass servers failed; old $OUT left untouched" >&2; exit 1
