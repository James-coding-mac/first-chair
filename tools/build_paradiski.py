#!/usr/bin/env python3
"""Build the Paradiski resort data for First Chair from OpenStreetMap.

Input : data/raw/paradiski-overpass.json  (from tools/fetch_paradiski.sh)
Output: data/build/paradiski.js            (sets window.FC_PARADISKI, loaded by index.html)

Nothing here is typed from memory: every name, grade and coordinate comes from OSM tags/geometry.
Every record is marked verified:false until James checks it against the official 2026-27 piste map.
Data (c) OpenStreetMap contributors, ODbL.

Run: python3 tools/build_paradiski.py
"""
import collections
import json
import math
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw", "paradiski-overpass.json")
OUT = os.path.join(ROOT, "data", "build", "paradiski.js")
ELEVATIONS = os.path.join(ROOT, "data", "raw", "elevations.json")
MAP_OUT = os.path.join(ROOT, "data", "build", "paradiski-map.geojson")   # offline map layer (Step 2)

# OSM ski-area outlines (landuse=winter_sports) -> app sector ids. Names must match OSM exactly.
SECTORS = {"La Plagne": "LP", "Les Arcs / Peisey-Vallandry": "LA"}
BASE_NAME = "Plagne Bellecôte"   # trip base (docs/DECISIONS.md); coordinates come from OSM

# French OSM convention: green=novice, blue=easy, red=intermediate, black=advanced.
GRADE = {"novice": "green", "easy": "blue", "intermediate": "red", "advanced": "black", "expert": "black"}
OFFPISTE_GRADES = {"freeride", "extreme"}
GRADE_ORDER = ["green", "blue", "red", "black", "offpiste"]

LIFT_TYPES = {"chair_lift": "Chairlift", "gondola": "Gondola", "cable_car": "Cable car",
              "mixed_lift": "Mixed lift", "drag_lift": "Drag lift", "t-bar": "T-bar",
              "j-bar": "J-bar", "platter": "Button lift", "rope_tow": "Rope tow",
              "magic_carpet": "Magic carpet"}
FOOD_TYPES = {"restaurant": "Restaurant", "cafe": "Café", "bar": "Bar", "fast_food": "Snack / fast food"}

# names key favourites/notes in a JS object, so they must not collide with Object.prototype members
RESERVED = {"__proto__", "constructor", "prototype", "hasOwnProperty", "isPrototypeOf",
            "propertyIsEnumerable", "toString", "toLocaleString", "valueOf", "__defineGetter__",
            "__defineSetter__", "__lookupGetter__", "__lookupSetter__"}
SAME_PLACE_M = 50    # same-named restaurants closer than this are one place mapped twice
SIMPLIFY_M = 4       # map lines: drop points that bend the line by less than this
SPLIT_M = 400        # same-named piste segments further apart than this are different runs
NEAR_SKI_M = 300     # a restaurant must be this close to a piste or lift to be listed
VILLAGE_M = 350      # ...and counts as "village" if this close to a village/hamlet point


def haversine(a, b):
    r, to_r = 6371000, math.radians
    dlat, dlon = to_r(b[0] - a[0]), to_r(b[1] - a[1])
    s = math.sin(dlat / 2) ** 2 + math.cos(to_r(a[0])) * math.cos(to_r(b[0])) * math.sin(dlon / 2) ** 2
    return 2 * r * math.asin(math.sqrt(s))


def in_poly(pt, poly):
    """Ray casting; pt and poly vertices are (lat, lon)."""
    y, x = pt
    inside = False
    j = len(poly) - 1
    for i in range(len(poly)):
        yi, xi = poly[i]
        yj, xj = poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def geom(e):
    if e["type"] == "node":
        return [(e["lat"], e["lon"])]
    if e["type"] == "way":
        return [(p["lat"], p["lon"]) for p in e.get("geometry", [])]
    pts = []  # relation: all member geometry
    for m in e.get("members", []):
        pts += [(p["lat"], p["lon"]) for p in m.get("geometry", [])]
        if "lat" in m:
            pts.append((m["lat"], m["lon"]))
    return pts


def centroid(pts):
    return (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))


def path_len(pts):
    return sum(haversine(pts[i], pts[i + 1]) for i in range(len(pts) - 1))


def simplify(pts, tol_m):
    """Douglas-Peucker on a local flat projection; keeps first/last point.
    Closed rings (first == last) are split at the point farthest from the start and each half
    simplified, otherwise every distance is measured from a zero-length line and the ring collapses."""
    if len(pts) < 3:
        return pts
    if pts[0] == pts[-1]:
        far = max(range(1, len(pts) - 1), key=lambda i: haversine(pts[0], pts[i]))
        return simplify(pts[:far + 1], tol_m)[:-1] + simplify(pts[far:], tol_m)
    k = math.cos(math.radians(pts[0][0]))
    xy = [(p[1] * 111320 * k, p[0] * 110540) for p in pts]
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        (ax, ay), (bx, by) = xy[a], xy[b]
        dx, dy = bx - ax, by - ay
        norm = math.hypot(dx, dy) or 1e-9
        best, idx = 0, None
        for i in range(a + 1, b):
            d = abs(dy * (xy[i][0] - ax) - dx * (xy[i][1] - ay)) / norm
            if d > best:
                best, idx = d, i
        if idx is not None and best > tol_m:
            keep[idx] = True
            stack += [(a, idx), (idx, b)]
    return [p for p, kp in zip(pts, keep) if kp]


def feature(pts, props, area=False):
    coords = [[round(p[1], 5), round(p[0], 5)] for p in simplify(pts, SIMPLIFY_M)]
    if len({tuple(c) for c in coords}) < 2:
        return None   # collapsed to a point: nothing to draw
    if area and len(coords) >= 4:
        if coords[0] != coords[-1]:
            coords.append(coords[0])
        geometry = {"type": "Polygon", "coordinates": [coords]}
    else:
        geometry = {"type": "LineString", "coordinates": coords}
    return {"type": "Feature", "properties": props, "geometry": geometry}


def r5(p):
    return [round(p[0], 5), round(p[1], 5)]


class Grid:
    """Coarse spatial index of points, for 'is anything within N metres' questions."""
    CELL = 0.005  # ~550 m in lat, ~390 m in lon here

    def __init__(self):
        self.cells = collections.defaultdict(list)

    def add(self, pt, item=None):
        self.cells[(int(pt[0] / self.CELL), int(pt[1] / self.CELL))].append((pt, item))

    def nearest(self, pt, max_m):
        cy, cx = int(pt[0] / self.CELL), int(pt[1] / self.CELL)
        rings = int(max_m / 380) + 1   # a cell is ~390 m wide east-west at this latitude
        best, best_d = None, max_m
        for dy in range(-rings, rings + 1):
            for dx in range(-rings, rings + 1):
                for q, item in self.cells.get((cy + dy, cx + dx), ()):
                    d = haversine(pt, q)
                    if d <= best_d:
                        best, best_d = (q, item), d
        return best, best_d


def main():
    if not os.path.exists(RAW):
        sys.exit("missing %s: run tools/fetch_paradiski.sh first" % RAW)
    els = json.load(open(RAW, encoding="utf-8"))["elements"]
    tags = lambda e: e.get("tags", {})

    # --- sectors (ski-area outlines) and the base ---
    polys = {}
    for e in els:
        t = tags(e)
        if t.get("landuse") == "winter_sports" and t.get("name") in SECTORS and e["type"] == "way":
            polys[SECTORS[t["name"]]] = geom(e)
    missing = set(SECTORS.values()) - set(polys)
    if missing:
        sys.exit("ski-area outline(s) missing from OSM data: %s" % missing)

    def sector_of(pts):
        """Sector containing most of these points (None if outside both)."""
        votes = collections.Counter()
        step = max(1, len(pts) // 20)
        for p in pts[::step]:
            for sid, poly in polys.items():
                if in_poly(p, poly):
                    votes[sid] += 1
        return votes.most_common(1)[0][0] if votes else None

    base = [e for e in els if tags(e).get("name") == BASE_NAME and tags(e).get("place")]
    if not base:
        sys.exit("no OSM place named %r" % BASE_NAME)
    base_pt = centroid(geom(base[0]))

    villages = Grid()   # resort villages/hamlets inside the ski areas, for "zone" labels
    for e in els:
        t = tags(e)
        if t.get("place") in ("village", "hamlet", "town", "suburb", "neighbourhood") and t.get("name"):
            p = centroid(geom(e))
            if sector_of([p]):
                villages.add(p, t["name"])

    def zone_of(pt):
        hit, d = villages.nearest(pt, 3000)
        if not hit:
            return ""
        return ("near " if d > VILLAGE_M else "") + hit[1]

    # --- lifts ---
    ski_pts = Grid()
    lifts, dropped_lifts = [], 0
    map_lifts, map_pistes = [], []
    for e in els:
        t = tags(e)
        kind = t.get("aerialway")
        if e["type"] != "way" or kind not in LIFT_TYPES:
            continue
        pts = geom(e)
        sid = sector_of(pts)
        if not sid:
            continue
        for p in pts:
            ski_pts.add(p)
        f = feature(pts, {"k": "lift", "n": t.get("name", ""), "t": LIFT_TYPES[kind]})
        if f:
            map_lifts.append(f)
        if not t.get("name"):
            dropped_lifts += 1
            continue
        lifts.append({
            "name": t["name"], "mtn": sid, "type": LIFT_TYPES[kind],
            "seats": t.get("aerialway:occupancy") or None,
            "len_m": round(path_len(pts)),
            "top_node": str(e["nodes"][-1]) if e.get("nodes") else None,
            "bottom": r5(pts[0]), "top": r5(pts[-1]),   # OSM draws aerialways bottom -> top
            "osm": e["id"], "source": "osm", "verified": False,
        })

    # --- pistes -> runs ---
    segs = collections.defaultdict(list)   # (sector, name) -> [segment]
    unnamed = outside = 0
    for e in els:
        t = tags(e)
        if t.get("piste:type") != "downhill" or e["type"] != "way" or t.get("piste:abandoned") == "yes":
            continue
        pts = geom(e)
        if len(pts) < 2:
            continue
        sid = sector_of(pts)
        if not sid:
            outside += 1
            continue
        for p in pts:
            ski_pts.add(p)
        name = (t.get("piste:name") or t.get("name") or "").strip()
        g = t.get("piste:difficulty")
        backcountry = t.get("piste:grooming") == "backcountry"
        grade = "offpiste" if (g in OFFPISTE_GRADES or backcountry) else GRADE.get(g)
        is_area = t.get("area") == "yes" or (pts[0] == pts[-1] and len(pts) > 3)
        # the map gets every segment, named or not (unnamed ones are the links between runs)
        f = feature(pts, {"k": "piste", "g": grade or "unknown", "n": name}, area=is_area)
        if f:
            map_pistes.append(f)
        if not name:
            unnamed += 1
            continue
        segs[(sid, name)].append({
            "id": e["id"], "pts": pts, "grade": grade, "area": is_area,
            "len": 0 if is_area else path_len(pts),
            "groomed": t.get("piste:grooming") in ("classic", "mogul", "classic+skating"),
            "moguls": t.get("piste:grooming") == "mogul",
            "lit": t.get("piste:lit") == "yes" or t.get("lit") == "yes",
        })

    def close(a, b):
        sa, sb = a["pts"][:: max(1, len(a["pts"]) // 15)], b["pts"][:: max(1, len(b["pts"]) // 15)]
        return any(haversine(p, q) < SPLIT_M for p in sa + [a["pts"][-1]] for q in sb + [b["pts"][-1]])

    runs = []
    for (sid, name), group in segs.items():
        # single-link clustering: segments near each other are the same run
        parent = list(range(len(group)))
        find = lambda i: i if parent[i] == i else find(parent[i])
        for i in range(len(group)):
            for j in range(i + 1, len(group)):
                if find(i) != find(j) and close(group[i], group[j]):
                    parent[find(i)] = find(j)
        clusters = collections.defaultdict(list)
        for i, s in enumerate(group):
            clusters[find(i)].append(s)
        for cl in clusters.values():
            by_grade = collections.Counter()
            for s in cl:
                by_grade[s["grade"]] += s["len"] or 1
            grades = [g for g in by_grade if g]
            if not grades:
                continue  # no difficulty in OSM: can't place it honestly
            main = max(grades, key=lambda g: by_grade[g])
            all_pts = [p for s in cl for p in s["pts"]]
            mid = centroid(all_pts)
            length = sum(s["len"] for s in cl)
            bits = ["≈%.1f km mapped" % (length / 1000) if length >= 100 else "short / area only"]
            others = sorted(set(grades) - {main}, key=GRADE_ORDER.index)
            if others:
                bits.append("parts graded " + ", ".join(others))
            if main == "offpiste":
                bits.append("ungroomed off-piste route: not patrolled or made safe")
            elif any(s["moguls"] for s in cl):
                bits.append("moguls")
            elif any(s["groomed"] for s in cl):
                bits.append("groomed")
            if any(s["lit"] for s in cl):
                bits.append("floodlit")
            runs.append({
                "name": name, "mtn": sid, "diff": main, "zone": zone_of(mid), "lift": "",
                "note": "From OpenStreetMap: " + "; ".join(bits) + ".",
                "at": r5(mid), "osm": sorted(s["id"] for s in cl),
                "source": "osm", "verified": False,
            })

    # names are the key for favourites/notes, so they must be unique within the resort:
    # add the place label, then the sector, and only then a number
    sector_names = {v: k for k, v in SECTORS.items()}

    def dedupe(items, label):
        count = collections.Counter(i["name"] for i in items)
        dups = [i for i in items if count[i["name"]] > 1]
        orig = {id(i): i["name"] for i in dups}
        for i in dups:
            if label(i):
                i["name"] = "%s (%s)" % (orig[id(i)], label(i))
        count = collections.Counter(i["name"] for i in items)
        for i in dups:
            if count[i["name"]] > 1:
                i["name"] = "%s (%s)" % (orig[id(i)], sector_names[i["mtn"]])
        count = collections.Counter(i["name"] for i in items)
        seen = collections.Counter()
        for i in dups:
            if count[i["name"]] > 1:
                seen[i["name"]] += 1
                i["name"] = "%s #%d" % (i["name"], seen[i["name"]])

    runs.sort(key=lambda r: (r["mtn"], r["name"].lower(), r["osm"][0]))
    dedupe(runs, lambda r: r["zone"].replace("near ", ""))
    lifts.sort(key=lambda l: (l["mtn"], l["name"].lower(), l["osm"]))
    # lifts aren't keys for saved data, so same-named lifts (e.g. a chair and a drag) stay as OSM names them

    # --- restaurants ---
    lift_tops = Grid()
    for l in lifts:
        lift_tops.add(tuple(l["top"]), l["name"])
    eats, far_from_ski = [], 0
    for e in els:
        t = tags(e)
        kind = t.get("amenity")
        if kind not in FOOD_TYPES or not t.get("name") or "scolaire" in t["name"].lower():
            continue
        p = centroid(geom(e))
        sid = sector_of([p])
        if not sid:
            continue
        if not ski_pts.nearest(p, NEAR_SKI_M)[0]:
            far_from_ski += 1
            continue
        # village = close to a village point, or has a street address and isn't far from one
        vhit, vd = villages.nearest(p, 1000)
        in_village = bool(vhit) and (vd <= VILLAGE_M or bool(t.get("addr:street")))
        top, _ = lift_tops.nearest(p, 400)
        if in_village:
            area = vhit[1]
            short = area
        elif top:
            area = "On the mountain, by the top of the %s lift" % top[1]
            short = "top of " + top[1]
        else:
            short = zone_of(p) or sector_names[sid]
            area = "On the mountain, " + short
        bits = [FOOD_TYPES[kind]]
        if t.get("cuisine"):
            bits.append(t["cuisine"].replace("_", " ").replace(";", ", "))
        desc = " · ".join(bits) + "."
        if t.get("opening_hours"):
            desc += " Hours (OSM): " + t["opening_hours"] + "."
        if t.get("phone"):
            desc += " Tel " + t["phone"] + "."
        if t.get("website"):
            desc += " " + t["website"]
        eats.append({
            "name": t["name"], "loc": "vil" if in_village else "mtn", "area": area,
            "mtn": sid, "short": short, "desc": desc.strip(), "at": r5(p),
            "osm": "%s/%d" % (e["type"], e["id"]), "source": "osm", "verified": False,
        })
    # one place mapped twice (e.g. a node and a building a few metres apart): keep the richer record
    eats.sort(key=lambda x: -len(x["desc"]))
    merged = []
    for x in eats:
        if not any(m["name"] == x["name"] and haversine(m["at"], x["at"]) < SAME_PLACE_M for m in merged):
            merged.append(x)
    eats = merged
    eats.sort(key=lambda x: (x["loc"] != "mtn", x["mtn"], x["name"].lower(), x["osm"]))
    dedupe(eats, lambda x: x["short"])
    for item in runs + eats:
        if item["name"] in RESERVED:
            item["name"] += " (OSM)"
    for x in eats:
        del x["short"]

    resort = {
        "name": "Paradiski",
        "diffSystem": "eu_off",
        "map": {"center": r5(base_pt), "zoom": 13},
        "mapData": "data/build/paradiski-map.geojson",
        "base": {"name": BASE_NAME, "at": r5(base_pt), "osm": "%s/%d" % (base[0]["type"], base[0]["id"])},
        "mountains": [{"id": "LP", "name": "La Plagne"}, {"id": "LA", "name": "Les Arcs / Peisey"}],
        "dataNote": "Generated from OpenStreetMap (© OSM contributors, ODbL). NOT yet checked against "
                    "the official 2026–27 piste map: names and grades may be wrong or missing.",
        "runs": runs, "lifts": lifts, "eats": eats,
    }
    if os.path.exists(ELEVATIONS):
        elevations = json.load(open(ELEVATIONS, encoding="utf-8"))
        elevations = {k: v for k, v in elevations.items()
                      if isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)}
        elevated = Grid()
        for e in els:
            if e["type"] == "node" and str(e["id"]) in elevations:
                elevated.add((e["lat"], e["lon"]), elevations[str(e["id"])])
            elif e["type"] == "way":
                for node, point in zip(e.get("nodes", []), e.get("geometry", [])):
                    if str(node) in elevations:
                        elevated.add((point["lat"], point["lon"]), elevations[str(node)])
        village, _ = elevated.nearest(base_pt, 400)
        candidates = [lift for lift in lifts if lift["top_node"] in elevations]
        if candidates:
            summit = max(candidates, key=lambda lift: elevations[lift["top_node"]])
            resort["weatherPoints"] = [
                {"label": "Village · " + BASE_NAME, "at": r5(base_pt),
                 "ele": village[1] if village else None},
                {"label": "Summit · top of " + summit["name"], "at": summit["top"],
                 "ele": elevations[summit["top_node"]]},
            ]
        else:
            print("NOTE: no lift-top elevations; skipping weatherPoints.")
    else:
        print("NOTE: elevations.json missing; skipping weatherPoints.")
    for lift in lifts:
        del lift["top_node"]  # internal lookup only; preserve the public lift records

    # saved favourites/notes/ratings are keyed on these names: warn if a rebuild drops any
    gone = []
    if os.path.exists(OUT):
        old_txt = open(OUT, encoding="utf-8", errors="replace").read()
        old = json.loads(old_txt[old_txt.index("= ") + 2:].rstrip().rstrip(";"))
        for kind in ("runs", "eats"):
            new_names = {i["name"] for i in resort[kind]}
            gone += ["%s: %s" % (kind, i["name"]) for i in old[kind] if i["name"] not in new_names]

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    body = ("/* GENERATED by tools/build_paradiski.py from OpenStreetMap data — do not edit by hand.\n"
            "   © OpenStreetMap contributors, ODbL. All records verified:false. */\n"
            "window.FC_PARADISKI = " + json.dumps(resort, ensure_ascii=False, separators=(",", ":")) + ";\n")
    with open(OUT, "wb") as f:
        f.write(body.encode("utf-8", "replace"))   # a broken character in OSM becomes "?" instead of a crash

    # areas first so lines draw on top of them; lifts last so they sit above pistes
    map_pistes.sort(key=lambda f: f["geometry"]["type"] != "Polygon")
    geo = {"type": "FeatureCollection",
           "attribution": "© OpenStreetMap contributors, ODbL",
           "features": map_pistes + map_lifts}
    with open(MAP_OUT, "wb") as f:
        f.write(json.dumps(geo, ensure_ascii=False, separators=(",", ":")).encode("utf-8", "replace"))

    grades = collections.Counter(r["diff"] for r in runs)
    print("base %s: %s" % (BASE_NAME, r5(base_pt)))
    print("runs %d %s | unnamed segments skipped %d, outside Paradiski %d"
          % (len(runs), dict(grades), unnamed, outside))
    print("lifts %d (unnamed skipped %d)" % (len(lifts), dropped_lifts))
    print("eats %d (mtn %d, vil %d) | food >%dm from any piste/lift skipped %d"
          % (len(eats), sum(e["loc"] == "mtn" for e in eats), sum(e["loc"] == "vil" for e in eats),
             NEAR_SKI_M, far_from_ski))
    print("wrote %s (%.0f KB)" % (os.path.relpath(OUT, ROOT), os.path.getsize(OUT) / 1024))
    print("wrote %s (%.0f KB): %d piste segments, %d lifts"
          % (os.path.relpath(MAP_OUT, ROOT), os.path.getsize(MAP_OUT) / 1024, len(map_pistes), len(map_lifts)))
    print("If this changed the file, bump VERSION in sw.js so phones fetch the new data.")
    if gone:
        print("WARNING: %d names from the previous build are gone; any notes/favourites saved on them "
              "will no longer show:" % len(gone))
        for g in gone[:40]:
            print("   " + g)


if __name__ == "__main__":
    main()
