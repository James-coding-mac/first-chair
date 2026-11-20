#!/usr/bin/env python3
"""Check graph invariants and print ten deterministic route comparisons.

Run: python3 tools/test_routes.py
No off-piste routing. Unknown connector grades are allowed under every maximum-grade filter. Destination snapping is reported, not routed.
"""
import heapq
import json
import math
import os
import sys
import unittest

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_routes import (  # noqa: E402
    ROOT, OUT, GRADES, KINDS, SECTORS, BASE_NAME, build_graph, duration_seconds,
    haversine, largest_scc, load_source, nearest_node, piste_grade,
    selected_ways, source_context,
)


def dijkstra(graph, source, max_grade=None):
    limit = GRADES.index(max_grade) if max_grade is not None else None
    if limit is not None and limit > GRADES.index('black'):
        raise ValueError('Maximum grade must be green, blue, red or black')
    adj = [[] for _ in graph['nodes']]
    for i, edge in enumerate(graph['edges']):
        if edge[2] == KINDS.index('piste'):
            if edge[3] == GRADES.index('offpiste'):
                continue
            if limit is not None and edge[3] != GRADES.index('unknown') and edge[3] > limit:
                continue
        adj[edge[0]].append(i)
    distances, previous = [math.inf] * len(adj), [None] * len(adj)
    distances[source] = 0
    queue = [(0, source)]
    while queue:
        cost, node = heapq.heappop(queue)
        if cost != distances[node]:
            continue
        for edge_id in adj[node]:
            edge = graph['edges'][edge_id]
            candidate = cost + edge[6]
            if candidate < distances[edge[1]]:
                distances[edge[1]] = candidate
                previous[edge[1]] = edge_id
                heapq.heappush(queue, (candidate, edge[1]))
    return distances, previous


def route_to(graph, previous, source, destination):
    path = []
    node = destination
    while node != source:
        edge_id = previous[node]
        if edge_id is None:
            return None
        path.append(edge_id)
        node = graph['edges'][edge_id][0]
    return path[::-1]


def route_steps(graph, path):
    # Collapse by kind/name, retaining every grade encountered in that group.
    groups = []
    for edge_id in path:
        edge = graph['edges'][edge_id]
        kind, name = graph['kinds'][edge[2]], graph['names'][edge[4]] or '[unnamed]'
        grade = graph['grades'][edge[3]] if edge[3] >= 0 else '-'
        if groups and groups[-1][0:2] == [kind, name]:
            groups[-1][2].add(grade)
            groups[-1][3] += edge[6]
        else:
            groups.append([kind, name, {grade}, edge[6]])
    return [(kind, name, '/'.join(sorted(grades, key=lambda g: GRADES.index(g) if g in GRADES else -1)),
             round(seconds / 60, 1)) for kind, name, grades, seconds in groups]


def spread(items, count, origin):
    """Farthest-point sampling, independent of reachability; don't hide failures."""
    remaining = sorted(items, key=lambda item: str(item['osm']))
    chosen, anchors = [], [origin]
    while remaining and len(chosen) < count:
        item = max(remaining, key=lambda item: min(haversine(item['at'], point) for point in anchors))
        chosen.append(item)
        anchors.append(item['at'])
        remaining.remove(item)
    if len(chosen) != count:
        raise ValueError('Not enough destinations for the requested coverage')
    return chosen


def load_resort():
    # Parse the generated JSON assignment; never execute JavaScript.
    text = (ROOT / 'data/build/paradiski.js').read_text(encoding='utf-8')
    marker = 'window.FC_PARADISKI = '
    return json.loads(text.split(marker, 1)[1].strip().rstrip(';'))


def validate_graph(graph):
    assert graph['v'] == 1 and graph['grades'] == GRADES and graph['kinds'] == KINDS
    assert len(graph['names']) == len(set(graph['names']))
    for node in graph['nodes']:
        assert len(node) == 3 and all(math.isfinite(x) for x in node)
    for edge in graph['edges']:
        a, b, kind, grade, name, length, seconds, line = edge
        assert 0 <= a < len(graph['nodes']) and 0 <= b < len(graph['nodes']) and a != b
        assert 0 <= kind < len(KINDS) and 0 <= name < len(graph['names'])
        assert (0 <= grade < len(GRADES)) if kind == 0 else grade == -1
        assert math.isfinite(length) and length >= 0 and math.isfinite(seconds) and seconds >= 0
        if kind == 2:
            assert line == []
            climb = max(0, graph['nodes'][b][2] - graph['nodes'][a][2])
            assert abs(seconds - length - climb * 6) <= .101
            assert climb <= 40
        else:
            assert len(line) >= 4 and len(line) % 2 == 0
            assert line[:2] == graph['nodes'][a][:2] and line[-2:] == graph['nodes'][b][:2]
        if kind == 0 and length >= 200.05:
            assert graph['nodes'][b][2] - graph['nodes'][a][2] <= 15
        assert all(math.isfinite(x) and round(x, 5) == x for x in line)
        if kind == 1:
            assert seconds >= 120


class GraphTests(unittest.TestCase):
    def test_duration_formats(self):
        for value, expected in [('2.5', 150), ('04:35', 275), ('PT2.5M', 150),
                                (None, None), ('4:99', None), ('no', None),
                                ('nan', None), ('inf', None), ('-1', None)]:
            self.assertEqual(duration_seconds(value), expected)

    def test_grade_mapping(self):
        self.assertEqual(piste_grade({'piste:difficulty': 'easy'}), 'blue')
        for value in ('freeride', 'extreme'):
            self.assertEqual(piste_grade({'piste:difficulty': value}), 'offpiste')
        self.assertEqual(piste_grade({'piste:grooming': 'backcountry'}), 'offpiste')
        self.assertEqual(piste_grade({}), 'unknown')

    @staticmethod
    def fixture(points, tags, elevations, extra=None):
        # Synthetic coordinates and unnamed ways, not invented resort records.
        def way(ident, ids, coords, attrs):
            return {'type': 'way', 'id': ident, 'nodes': ids,
                    'geometry': [dict(lat=p[0], lon=p[1]) for p in coords], 'tags': attrs}
        elements = [way(100 + i, [100, 101, 102, 103, 100],
                        [(-1, -1), (-1, 1), (1, 1), (1, -1), (-1, -1)],
                        {'landuse': 'winter_sports', 'name': name}) for i, name in enumerate(SECTORS)]
        elements.append({'type': 'node', 'id': 999, 'lat': 0, 'lon': 0,
                         'tags': {'place': 'hamlet', 'name': BASE_NAME}})
        elements.append(way(1, list(range(len(points))), points, tags))
        if extra:
            elements.extend(extra)
        return build_graph(elements, {str(i): value for i, value in enumerate(elevations)})

    def test_piste_direction_and_flat_thresholds(self):
        tags = {'piste:type': 'downhill', 'piste:difficulty': 'easy'}
        for elevations, expected in [([100, 126], [(1, 0)]), ([100, 125], []),
                                     ([100, 115], [(0, 1)]), ([100, 116], []),
                                     ([100, 104], [(0, 1), (1, 0)]), ([100, 105], [(0, 1)])]:
            graph, _ = self.fixture([(0, 0), (0, .002)], tags, elevations)
            self.assertEqual([tuple(e[:2]) for e in graph['edges']], expected)
        for rise in (16, 25, 26, 50):
            graph, _ = self.fixture([(0, 0), (0, .001)], tags, [100, 100 + rise])
            self.assertEqual([e[:2] for e in graph['edges']], [[0, 1]])
        graph, _ = self.fixture([(0, 0), (0, .004)], tags, [100, 100])
        self.assertEqual(len(graph['edges']), 1)

    def test_lift_wait_and_direction(self):
        graph, _ = self.fixture([(0, 0), (0, .001)],
                               {'aerialway': 'chair_lift', 'aerialway:duration': 'PT2M'}, [100, 200])
        self.assertEqual(graph['edges'][0][:4], [0, 1, 1, -1])
        self.assertEqual(graph['edges'][0][6], 240)

    def test_cable_car_runs_both_ways(self):
        graph, _ = self.fixture([(0, 0), (0, .003)],
                               {'aerialway': 'cable_car', 'aerialway:duration': '2'}, [100, 150])
        self.assertEqual([e[:2] for e in graph['edges']], [[0, 1], [1, 0]])
        self.assertEqual([e[6] for e in graph['edges']], [240, 240])

    def test_area_has_at_most_six_nearest_exits(self):
        points = [(0, i * .001) for i in range(9)]
        shared = {'type': 'way', 'id': 2, 'nodes': list(range(9)),
                  'geometry': [dict(lat=p[0], lon=p[1]) for p in points],
                  'tags': {'piste:type': 'downhill'}}
        graph, info = self.fixture(points, {'piste:type': 'downhill', 'area': 'yes'},
                                  [100] * 9, [shared])
        self.assertEqual(info['stats']['area_edges'], 54)
        area_edges = graph['edges'][:54]
        for node in range(9):
            expected = sorted((n for n in range(9) if n != node),
                              key=lambda n: (haversine(points[node], points[n]), n))[:6]
            self.assertEqual([e[1] for e in area_edges if e[0] == node], expected)

    def test_dangling_end_link(self):
        extra = {'type': 'way', 'id': 2, 'nodes': [2, 3],
                 'geometry': [{'lat': 0, 'lon': .0023}, {'lat': 0, 'lon': .004}],
                 'tags': {'piste:type': 'downhill'}}
        graph, info = self.fixture([(0, 0), (0, .002)], {'piste:type': 'downhill'},
                                  [200, 100, 105, 50], [extra])
        self.assertEqual(info['stats']['dangling_end_links'], 1)
        self.assertEqual([e[:2] for e in graph['edges'] if e[2] == 2], [[1, 2]])

    def test_walk_rejects_uphill_transfer(self):
        lift = {'type': 'way', 'id': 2, 'nodes': [2, 3],
                'geometry': [{'lat': .0002, 'lon': 0}, {'lat': .0002, 'lon': .002}],
                'tags': {'aerialway': 'chair_lift'}}
        graph, _ = self.fixture([(0, 0), (0, .002)], {'piste:type': 'downhill'},
                               [200, 150, 100, 120], [lift])
        walks = [e for e in graph['edges'] if e[2] == 2]
        self.assertTrue(walks)
        self.assertTrue(all(graph['nodes'][e[1]][2] - graph['nodes'][e[0]][2] <= 40 for e in walks))
        self.assertTrue(any(e[0] == 3 and e[1] == 1 for e in walks))
        self.assertFalse(any(e[0] == 2 for e in walks))
        validate_graph(graph)

    def test_walk_climb_boundary_and_penalty(self):
        lift = {'type': 'way', 'id': 2, 'nodes': [2, 3],
                'geometry': [{'lat': .0002, 'lon': 0}, {'lat': .0002, 'lon': .01}],
                'tags': {'aerialway': 'chair_lift'}}
        for rise in (40, 41):
            graph, _ = self.fixture([(0, 0), (0, .002)], {'piste:type': 'downhill'},
                                    [100 + rise, 50, 100, 300], [lift])
            uphill = [e for e in graph['edges'] if e[:3] == [2, 0, 2]]
            self.assertEqual(bool(uphill), rise == 40)
            if uphill:
                self.assertAlmostEqual(uphill[0][6] - uphill[0][5], 240, delta=.1)
            validate_graph(graph)

    def test_missing_elevation_fails(self):
        with self.assertRaisesRegex(ValueError, 'elevation'):
            self.fixture([(0, 0), (0, .001)], {'piste:type': 'downhill'}, [100])

    def test_shared_node_split_and_walk_limit(self):
        for offset, walk_count, missing in [(.0005, 4, 0), (.002, 2, 1)]:
            lift = {'type': 'way', 'id': 2, 'nodes': [1, 3],
                    'geometry': [{'lat': 0, 'lon': .001}, {'lat': offset, 'lon': .001}],
                    'tags': {'aerialway': 'chair_lift'}}
            graph, info = self.fixture([(0, 0), (0, .001), (0, .002)],
                                      {'piste:type': 'downhill'}, [300, 200, 100, 200], [lift])
            self.assertEqual([e[:2] for e in graph['edges'] if e[2] == 0], [[0, 1], [1, 2]])
            walks = [e for e in graph['edges'] if e[2] == 2]
            self.assertEqual(len(walks), walk_count)
            self.assertEqual(len(info['unlinked']), missing)
            for edge in walks:
                self.assertEqual(edge[5], edge[6])  # walking speed is 1 m/s
                self.assertLessEqual(edge[5], 150)

    def test_area_only_connects_downhill(self):
        shared = {'type': 'way', 'id': 2, 'nodes': [0, 1, 2],
                  'geometry': [{'lat': 0, 'lon': 0}, {'lat': 0, 'lon': .001},
                               {'lat': .001, 'lon': .001}],
                  'tags': {'piste:type': 'downhill'}}
        graph, info = self.fixture([(0, 0), (0, .001), (.001, .001)],
                                  {'piste:type': 'downhill', 'area': 'yes'},
                                  [300, 200, 100], [shared])
        self.assertEqual(info['stats']['area_edges'], 3)
        self.assertEqual({tuple(e[:2]) for e in graph['edges'][:3]},
                         {(a, b) for a in range(3) for b in range(3) if a < b})
        for edge in graph['edges'][:3]:
            self.assertAlmostEqual(edge[5], haversine(graph['nodes'][edge[0]], graph['nodes'][edge[1]]), delta=.05)

    def test_abandoned_piste_is_not_a_connection(self):
        abandoned = {'type': 'way', 'id': 2, 'nodes': [1, 3],
                     'geometry': [{'lat': 0, 'lon': .001}, {'lat': .001, 'lon': .001}],
                     'tags': {'piste:type': 'downhill', 'piste:abandoned': 'yes'}}
        graph, _ = self.fixture([(0, 0), (0, .001), (0, .002)],
                               {'piste:type': 'downhill'}, [300, 200, 100, 300], [abandoned])
        self.assertEqual(len(graph['nodes']), 2)
        self.assertEqual(len(graph['edges']), 1)

    def test_scc(self):
        self.assertEqual(largest_scc([[1], [0, 2], [3], [2], []]), 2)
        self.assertEqual(largest_scc([]), 0)

    def test_dijkstra_excludes_offpiste_allows_unknown_at_blue(self):
        def edge(a, b, grade, seconds):
            return [a, b, 0, GRADES.index(grade), 0, 1, seconds, []]
        graph = {'nodes': [None] * 5, 'edges': [edge(0, 1, 'offpiste', 1),
                 edge(0, 2, 'red', 4), edge(0, 3, 'blue', 2),
                 edge(3, 2, 'blue', 3), edge(0, 4, 'unknown', 1)]}
        all_dist, _ = dijkstra(graph, 0)
        blue_dist, prev = dijkstra(graph, 0, 'blue')
        self.assertEqual(all_dist, [0, math.inf, 4, 2, 1])
        self.assertEqual(blue_dist, [0, math.inf, 5, 2, 1])
        self.assertEqual(route_to(graph, prev, 0, 2), [2, 3])
        self.assertIsNone(route_to(graph, prev, 0, 1))


def main():
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(GraphTests)
    if not unittest.TextTestRunner(verbosity=1, stream=sys.stdout).run(suite).wasSuccessful():
        return 1
    graph = json.loads(OUT.read_text(encoding='utf-8'))
    validate_graph(graph)
    elements, elevations = load_source()
    rebuilt, info = build_graph(elements, elevations)
    assert rebuilt == graph, 'Graph is stale: rerun tools/build_routes.py'
    resort = load_resort()
    base = nearest_node(graph['nodes'], info['base'])
    restaurants = []
    for sector, count in [('LP', 3), ('LA', 2)]:
        restaurants += spread([item for item in resort['eats'] if item['loc'] == 'mtn'
                               and item['mtn'] == sector], count, info['base'])
    lift_targets = [dict(lift, at=graph['nodes'][lift['top']]) for lift in info['lifts'] if lift['sector'] == 'LA']
    destinations = [('restaurant', item, nearest_node(graph['nodes'], item['at'])) for item in restaurants]
    destinations += [('lift top', item, item['top']) for item in spread(lift_targets, 5, info['base'])]
    unrestricted = dijkstra(graph, base)
    blue = dijkstra(graph, base, 'blue')
    print('\nGraph invariants and deterministic rebuild passed.')
    print('Base node %d, %.1f m from %s. All routes exclude off-piste.' %
          (base, haversine(info['base'], graph['nodes'][base]), BASE_NAME))
    print('Unknown grades (connectors/links) are allowed under every filter; their difficulty is unverified. Times exclude base/destination snapping distances.')
    failures, changed, blue_failures = 0, 0, 0
    for number, (kind, item, target) in enumerate(destinations, 1):
        sector = item.get('mtn', item.get('sector'))
        print('\n%d. %s %s [%s, OSM %s] -> node %d (snap %.1f m)' %
              (number, kind, item['name'] or '[unnamed]', sector, item['osm'], target,
               haversine(item['at'], graph['nodes'][target])))
        paths = []
        for label, (distance, previous) in [('All piste grades', unrestricted), ('Max blue', blue)]:
            path = route_to(graph, previous, base, target)
            paths.append(path)
            if path is None:
                print('  %s: FAIL — UNREACHABLE' % label)
                if label == 'Max blue':
                    blue_failures += 1
                else:
                    failures += 1
            else:
                assert abs(sum(graph['edges'][i][6] for i in path) - distance[target]) < .001
                print('  %s: PASS %s; total %.1f min' % (label, route_steps(graph, path), distance[target] / 60))
                for i in path:
                    edge = graph['edges'][i]
                    rise = graph['nodes'][edge[1]][2] - graph['nodes'][edge[0]][2]
                    if edge[2] == 2:
                        assert rise <= 40, 'FAIL: walk climbs >40 m'
                    elif edge[2] == 0 and edge[5] >= 200.05:
                        assert rise <= 15, 'FAIL: long piste climbs >15 m'
        if paths[1] is None:
            if paths[0] is None:
                print('  Blue blockers: no all-grades route exists either.')
            else:
                needed = [(graph['names'][graph['edges'][i][4]] or '[unnamed]',
                           GRADES[graph['edges'][i][3]], graph['edges'][i][6])
                          for i in paths[0] if graph['edges'][i][2] == 0
                          and GRADES[graph['edges'][i][3]] in ('red', 'black', 'unknown')]
                print('  Edges on cheapest all-grades route (name, grade, seconds; unknown is allowed): %s' %
                      sorted(needed, key=lambda item: (item[2], item[0])))
        differs = paths[0] != paths[1]
        changed += differs
        print('  Comparison: %s' % ('DIFFERS' if differs else 'same result'))
    print('\nSummary: %d/10 routes reachable; %d/10 with blue limit; %d comparisons differ.' %
          (10 - failures, 10 - blue_failures, changed))
    print('Unreachable destinations are data/connectivity findings, not permission to invent links.')
    # Surface cross-sector lift connectivity from geometry rather than typed lift names.
    polygons, _ = source_context(elements)
    print('\nCross-sector lifts (endpoint sectors from OSM polygons):')
    from build_routes import sector_of
    for way, pts, _, _, lift in selected_ways(elements, polygons):
        if lift:
            start, end = sector_of([pts[0]], polygons), sector_of([pts[-1]], polygons)
            if start and end and start != end:
                print('  %s (way %s): %s -> %s' % (way.get('tags', {}).get('name', '[unnamed]'), way['id'], start, end))
    return 0


if __name__ == '__main__':
    sys.exit(main())
