#!/usr/bin/env python3
"""Build the offline directed route graph. Python 3.9+, standard library only.

Run from any directory: python3 tools/build_routes.py
OSM names/topology are unverified. No network access or changes to resort data.
"""
import collections
import json
import math
import os
from pathlib import Path
import re
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_paradiski import (  # noqa: E402
    BASE_NAME, GRADE, OFFPISTE_GRADES, SECTORS, LIFT_TYPES,
    haversine, in_poly, geom, simplify,
)

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'data/raw/paradiski-overpass.json'
ELEVATIONS = ROOT / 'data/raw/elevations.json'
OUT = ROOT / 'data/build/paradiski-graph.json'
GRADES = ['green', 'blue', 'red', 'black', 'offpiste', 'unknown']
KINDS = ['piste', 'lift', 'walk']
PISTE_SPEED = dict(zip(GRADES, [18, 25, 30, 30, 25, 18]))  # km/h
LIFT_SPEED = {'cable_car': 8, 'gondola': 5, 'chair_lift': 4.5,
              'mixed_lift': 4.5, 'drag_lift': 3, 't-bar': 3, 'j-bar': 3,
              'platter': 3, 'rope_tow': 2, 'magic_carpet': 0.6}  # m/s


def duration_seconds(value):
    """OSM minutes, mm:ss or PTxM; None means use the type's speed."""
    if value is None:
        return None
    value = str(value).strip()
    try:
        if re.fullmatch(r'\d+:\d{2}', value):
            minutes, seconds = map(int, value.split(':'))
            if seconds >= 60:
                return None
            result = minutes * 60 + seconds
        elif re.fullmatch(r'PT\d+(?:\.\d+)?M', value):
            result = float(value[2:-1]) * 60
        else:
            result = float(value) * 60
        return result if math.isfinite(result) and result > 0 else None
    except ValueError:
        return None


def path_length(pts):
    return sum(haversine(a, b) for a, b in zip(pts, pts[1:]))


def piste_grade(tags):
    difficulty = tags.get('piste:difficulty')
    if difficulty in OFFPISTE_GRADES or tags.get('piste:grooming') == 'backcountry':
        return 'offpiste'
    return GRADE.get(difficulty, 'unknown')


def load_source():
    with RAW.open(encoding='utf-8') as stream:
        elements = json.load(stream)['elements']
    with ELEVATIONS.open(encoding='utf-8') as stream:
        elevations = json.load(stream)
    return elements, elevations


def source_context(elements):
    polygons = {}
    base = None
    for element in elements:
        tags = element.get('tags', {})
        if (element['type'] == 'way' and tags.get('landuse') == 'winter_sports'
                and tags.get('name') in SECTORS):
            polygons[SECTORS[tags['name']]] = geom(element)
        if base is None and tags.get('place') and tags.get('name') == BASE_NAME:
            pts = geom(element)
            base = [sum(p[i] for p in pts) / len(pts) for i in (0, 1)]
    if set(polygons) != set(SECTORS.values()) or base is None:
        raise ValueError('Missing OSM sector outlines or base place')
    return polygons, base


def sector_of(pts, polygons):
    # Match build_paradiski's sampled sector vote exactly: it selects the sector
    # with most inside samples, and rejects a way only if there are no votes.
    votes = collections.Counter()
    for point in pts[::max(1, len(pts) // 20)]:
        for sector, polygon in polygons.items():
            if in_poly(point, polygon):
                votes[sector] += 1
    return votes.most_common(1)[0][0] if votes else None


def selected_ways(elements, polygons):
    result = []
    for element in elements:
        tags = element.get('tags', {})
        piste = tags.get('piste:type') == 'downhill' and tags.get('piste:abandoned') != 'yes'
        lift = tags.get('aerialway') in LIFT_TYPES
        if element['type'] != 'way' or not (piste or lift):
            continue
        pts = geom(element)
        if len(pts) < 2:
            continue
        if len(element.get('nodes', [])) != len(pts):
            raise ValueError('Way %s has mismatched nodes/geometry' % element['id'])
        sector = sector_of(pts, polygons)
        if sector:
            result.append((element, pts, sector, piste, lift))
    return sorted(result, key=lambda item: item[0]['id'])


def nearest_node(nodes, point, candidates=None):
    candidates = range(len(nodes)) if candidates is None else candidates
    return min(candidates, key=lambda n: (haversine(point, nodes[n]), n))


def build_graph(elements, elevations):
    polygons, base = source_context(elements)
    ways = selected_ways(elements, polygons)
    uses, coordinates, endpoints, piste_ids = collections.Counter(), {}, set(), set()
    for way, pts, _, piste, _ in ways:
        ids = way['nodes']
        uses.update(set(ids))  # a closed ring alone does not make a shared node
        coordinates.update(zip(ids, pts))
        endpoints.update((ids[0], ids[-1]))
        if piste:
            piste_ids.update(ids)
    graph_ids = sorted(endpoints | {node for node, count in uses.items() if count >= 2})
    if not graph_ids:
        raise ValueError('No piste/lift graph nodes inside the sectors')
    nodes = []
    for node in graph_ids:
        elevation = elevations.get(str(node))
        if not isinstance(elevation, (int, float)) or not math.isfinite(elevation):
            raise ValueError('Missing/invalid elevation for OSM node %s' % node)
        nodes.append([round(v, 5) for v in coordinates[node]] + [elevation])
    index = {node: i for i, node in enumerate(graph_ids)}
    names, name_index, edges = [], {}, []
    stats = collections.Counter(dem_dropped_edges=0, reversed_pieces=0)
    lifts, warnings = [], []

    def add_edge(a, b, kind, grade, name, pts, length, seconds):
        if a == b:
            return
        # Short piste pieces trust OSM: the coarse DEM cannot orient them.
        if kind == 'piste' and length >= 200 and nodes[index[b]][2] - nodes[index[a]][2] > 15:
            stats['dem_dropped_edges'] += 1
            return
        if name not in name_index:
            name_index[name] = len(names)
            names.append(name)
        flat = [] if kind == 'walk' else [round(value, 5) for point in simplify(pts, 4) for value in point]
        edges.append([index[a], index[b], KINDS.index(kind),
                      GRADES.index(grade) if grade else -1, name_index[name],
                      round(length, 1), round(seconds, 1), flat])

    for way, pts, sector, piste, lift in ways:
        ids, tags = way['nodes'], way.get('tags', {})
        if piste:
            grade = piste_grade(tags)
            speed = PISTE_SPEED[grade] / 3.6
            name = (tags.get('piste:name') or tags.get('name') or '').strip()
            if tags.get('area') == 'yes' or (pts[0] == pts[-1] and len(pts) > 3):
                ring_nodes = sorted(set(ids) & set(index))
                for a in ring_nodes:
                    eligible = [b for b in ring_nodes if b != a
                                and nodes[index[b]][2] <= nodes[index[a]][2] + 5]
                    stats['area_uphill_excluded'] += len(ring_nodes) - 1 - len(eligible)
                    nearest = sorted(eligible, key=lambda b: (haversine(coordinates[a], coordinates[b]), b))[:6]
                    for b in nearest:
                        if a != b:
                            line = [coordinates[a], coordinates[b]]
                            length = haversine(*line)
                            add_edge(a, b, 'piste', grade, name, line, length, length / speed)
                            stats['area_edges'] += 1
            else:
                cuts = [i for i, node in enumerate(ids) if node in index]
                for start, end in zip(cuts, cuts[1:]):
                    a, b = ids[start], ids[end]
                    line = pts[start:end + 1]
                    length = path_length(line)
                    delta = nodes[index[b]][2] - nodes[index[a]][2]
                    if length >= 200 and delta > 25:
                        a, b, line = b, a, line[::-1]
                        stats['reversed_pieces'] += 1
                    add_edge(a, b, 'piste', grade, name, line, length, length / speed)
                    if abs(delta) < 5 and length < 300:
                        add_edge(b, a, 'piste', grade, name, line[::-1], length, length / speed)
                        stats['flat_links'] += 1
        if lift:
            length = path_length(pts)
            duration = duration_seconds(tags.get('aerialway:duration'))
            if 'aerialway:duration' in tags and duration is None:
                warnings.append('Invalid duration on lift way %s; using type speed' % way['id'])
            seconds = duration if duration is not None else length / LIFT_SPEED[tags['aerialway']]
            name = tags.get('name', '')
            add_edge(ids[0], ids[-1], 'lift', None, name, pts, length, seconds + 120)
            if tags['aerialway'] == 'cable_car':
                add_edge(ids[-1], ids[0], 'lift', None, name, pts[::-1], length, seconds + 120)
                stats['reverse_cable_car_edges'] += 1
            lifts.append({'osm': way['id'], 'name': name, 'sector': sector,
                          'bottom': index[ids[0]], 'top': index[ids[-1]],
                          'ends': (ids[0], ids[-1])})

    piste_nodes = {index[node] for node in piste_ids if node in index}
    lift_ends = {index[node] for lift in lifts for node in lift['ends']}
    walk_done = set()

    def walk(a, b):
        if (a, b) in walk_done:
            return
        distance = haversine(coordinates[graph_ids[a]], coordinates[graph_ids[b]])
        add_edge(graph_ids[a], graph_ids[b], 'walk', None, '', [], distance,
                 distance + max(0, nodes[b][2] - nodes[a][2]) * 6)
        walk_done.add((a, b))

    # Choose the nearest eligible neighbour in each direction. A steep downhill
    # transfer can be valid even when its reverse would exceed the climb cap.
    for lift in lifts:
        own_ends = {index[node] for node in lift['ends']}
        for node in lift['ends']:
            current = index[node]
            # Nearest piste and nearest other lift end are separate targets:
            # parallel cable cars must not select only each other and stay isolated.
            for pool in (piste_nodes, lift_ends):
                candidates = sorted((n for n in pool if n not in own_ends),
                                    key=lambda n: (haversine(nodes[current], nodes[n]), n))
                candidates = [n for n in candidates if haversine(nodes[current], nodes[n]) <= 150]
                for outbound in (True, False):
                    for other in candidates:
                        a, b = (current, other) if outbound else (other, current)
                        if nodes[b][2] - nodes[a][2] <= 40:
                            walk(a, b)
                            break

    outgoing = {edge[0] for edge in edges}
    for node in sorted(endpoints & piste_ids):
        current = index[node]
        if uses[node] != 1 or current in outgoing:
            continue
        candidates = [n for n in range(len(nodes)) if n != current
                      and nodes[n][2] <= nodes[current][2] + 5
                      and haversine(nodes[current], nodes[n]) <= 50]
        if candidates:
            walk(current, nearest_node(nodes, nodes[current], candidates))
            stats['dangling_end_links'] += 1

    # Report missing external connections, not the lift's own ride edge.
    unlinked = []
    for lift in lifts:
        own_ends = {lift['bottom'], lift['top']}
        missing = []
        for label in ('bottom', 'top'):
            current = lift[label]
            connected = any((e[0] == current and e[1] not in own_ends)
                            or (e[1] == current and e[0] not in own_ends) for e in edges)
            if not connected:
                missing.append(label)
        if missing:
            unlinked.append((lift, missing))
    graph = {'v': 1, 'attribution': '© OpenStreetMap contributors, ODbL; elevation Copernicus DEM via Open-Meteo',
             'grades': GRADES, 'kinds': KINDS, 'names': names, 'nodes': nodes, 'edges': edges}
    return graph, {'base': base, 'lifts': lifts, 'unlinked': unlinked, 'warnings': warnings, 'stats': stats}


def adjacency(graph, safe=False):
    result = [[] for _ in graph['nodes']]
    for edge in graph['edges']:
        if safe and edge[2] == 0 and graph['grades'][edge[3]] == 'offpiste':
            continue
        result[edge[0]].append(edge[1])
    return result


def reachable(adj, source):
    seen, stack = {source}, [source]
    while stack:
        for other in adj[stack.pop()]:
            if other not in seen:
                seen.add(other)
                stack.append(other)
    return seen


def components(adj):
    """Iterative Kosaraju: avoid Python's recursion limit on long routes."""
    reverse = [[] for _ in adj]
    for node, others in enumerate(adj):
        for other in others:
            reverse[other].append(node)
    seen, order = set(), []
    for root in range(len(adj)):
        if root in seen:
            continue
        seen.add(root)
        stack = [(root, iter(adj[root]))]
        while stack:
            node, children = stack[-1]
            child = next(children, None)
            if child is None:
                order.append(node)
                stack.pop()
            elif child not in seen:
                seen.add(child)
                stack.append((child, iter(adj[child])))
    seen, groups = set(), []
    for root in reversed(order):
        if root in seen:
            continue
        stack, group = [root], []
        seen.add(root)
        while stack:
            node = stack.pop()
            group.append(node)
            for child in reverse[node]:
                if child not in seen:
                    seen.add(child)
                    stack.append(child)
        groups.append(group)
    return sorted(groups, key=lambda group: (-len(group), min(group)))


def largest_scc(adj):
    groups = components(adj)
    return len(groups[0]) if groups else 0


def main():
    graph, info = build_graph(*load_source())
    body = json.dumps(graph, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n'
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(body, encoding='utf-8')
    print('Nodes: %d; edges: %d %s' % (len(graph['nodes']), len(graph['edges']),
          dict(collections.Counter(KINDS[e[2]] for e in graph['edges']))))
    print('File: %s; %d bytes (%.1f KiB)' % (OUT.relative_to(ROOT), OUT.stat().st_size, OUT.stat().st_size / 1024))
    print('Largest strongly connected component: %d nodes (all edges); %d (off-piste excluded)' %
          (largest_scc(adjacency(graph)), largest_scc(adjacency(graph, safe=True))))
    base = nearest_node(graph['nodes'], info['base'])
    reached = reachable(adjacency(graph, safe=True), base)
    count = sum(lift['top'] in reached for lift in info['lifts'])
    total = len(info['lifts'])
    print('Base %s: node %d, %.1f m away; lift tops reachable without off-piste: %d/%d (%.1f%%)' %
          (BASE_NAME, base, haversine(info['base'], graph['nodes'][base]), count, total, 100 * count / total if total else 0))
    print('Unreachable lift tops:')
    for lift in info['lifts']:
        if lift['top'] not in reached:
            print('  %s (way %s) at %.5f, %.5f' %
                  (lift['name'] or '[unnamed]', lift['osm'], *graph['nodes'][lift['top']][:2]))
    print('Direction/area diagnostics: %s' % dict(info['stats']))
    groups = components(adjacency(graph, safe=True))
    main_group = groups[0]
    samples = {}
    for edge in graph['edges']:
        if edge[2] != 2 and graph['names'][edge[4]]:
            for node in edge[:2]:
                samples.setdefault(node, graph['names'][edge[4]])

    def describe_gap(group):
        distance, outside, inside = min(
            (haversine(graph['nodes'][a], graph['nodes'][b]), a, b)
            for a in group for b in main_group)
        rise = graph['nodes'][outside][2] - graph['nodes'][inside][2]
        reasons = []
        if distance > 150:
            reasons.append('beyond 150 m lift-transfer radius')
        if rise > 40:
            reasons.append('entry climb exceeds 40 m')
        if not reasons:
            reasons.append('directed topology / nearest-link eligibility; proximity alone does not create a link')
        print('  %d nodes; %s; node %d at %.5f, %.5f -> nearest main node %d (%s) at %.5f, %.5f; '
              '%.1f m; entry elevation difference %+.1f m; %s; %s' %
              (len(group), samples.get(outside, '[unnamed]'), outside,
               *graph['nodes'][outside][:2], inside, samples.get(inside, '[unnamed]'),
               *graph['nodes'][inside][:2], distance, rise, '; '.join(reasons),
               'reachable from base (return path missing)' if outside in reached else 'unreachable from base'))

    print('10 largest strongly connected components outside the main one (off-piste excluded):')
    print('Elevation difference is outside minus main; distances are diagnostic, not proposed links.')
    for group in groups[1:11]:
        describe_gap(group)
    if count / total < .85:
        print('Top 5 blockers for map review (largest unreachable components):')
        for group in [g for g in groups if not any(n in reached for n in g)][:5]:
            describe_gap(group)
    print('Lifts with an end lacking an external connection: %d' % len(info['unlinked']))
    for lift, missing in info['unlinked']:
        print('  %s (way %s): %s' % (lift['name'] or '[unnamed]', lift['osm'], ', '.join(missing)))
    print('Cross-sector lift exits blocked by elevation/distance (off-piste excluded):')
    polygons, _ = source_context(load_source()[0])
    piste_nodes = {n for e in graph['edges'] if e[2] == 0 and e[3] != GRADES.index('offpiste') for n in e[:2]}
    for lift in info['lifts']:
        ends = [graph['nodes'][lift[label]][:2] for label in ('bottom', 'top')]
        if sector_of([ends[0]], polygons) == sector_of([ends[1]], polygons):
            continue
        for label in ('bottom', 'top'):
            node = lift[label]
            if node not in reached or not piste_nodes:
                continue
            near = nearest_node(graph['nodes'], graph['nodes'][node], piste_nodes)
            distance = haversine(graph['nodes'][node], graph['nodes'][near])
            rise = graph['nodes'][near][2] - graph['nodes'][node][2]
            if distance > 150 or rise > 40:
                print('  %s %s at %.5f, %.5f: nearest piste %.1f m away, rise %+.1f m' %
                      (lift['name'], label, *graph['nodes'][node][:2], distance, rise))
    for warning in info['warnings']:
        print('WARNING:', warning)
    if OUT.stat().st_size >= 900000:
        print('WARNING: graph exceeds the 900 KB target')


if __name__ == '__main__':
    main()
