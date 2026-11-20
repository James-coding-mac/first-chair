#!/usr/bin/env python3
"""Offline regression tests; fixtures are captured or explicitly synthetic."""
import copy
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # works under python3 -I too
import scrape_status as s  # noqa: E402

FIX = s.ROOT / 'tests/fixtures/status'
NOW = datetime(2026, 11, 20, 12, tzinfo=timezone.utc)


def read(name):
    return (FIX / name).read_text()


def catalog():
    return json.loads((s.ROOT / 'data/build/paradiski.js').read_text().split('= ', 1)[1].strip().rstrip(';'))


def fetch(url):
    return read({'lumi_static': 'lumi_static.json', 'lumi_dynamic': 'lumi_dynamic.json',
                 'lp_static': 'lp_static.json', 'lp_dynamic': 'lp_dynamic.json',
                 'lp_live': 'lp_live.json', 'la_detail': 'la_detail.html'}[next(k for k, v in s.URLS.items() if v == url)])


def fetch_no_lumi(url):
    if url in (s.URLS['lumi_static'], s.URLS['lumi_dynamic']):
        raise OSError('lumiplan down')
    return fetch(url)


def states(matches):
    return {k: v['state'] for k, v in matches.items()}


class Parsing(unittest.TestCase):
    def test_lp_structure_and_preseason(self):
        out = s.parse_lp(read('lp_static.json'), read('lp_dynamic.json'))
        self.assertIs(out['season'], False)
        self.assertEqual(len(out['lifts']), 76)
        self.assertEqual(len(out['pistes']), 220)
        self.assertEqual({v for k in ('lifts', 'pistes') for _, v in out[k]}, {'closed'})
        self.assertEqual(out['summary']['lifts_open'], 0)

    def test_lp_partly_open(self):
        out = s.parse_lp(read('lp_static.json'), read('lp_dynamic_synthetic_open.json'))
        self.assertIs(out['season'], True)
        self.assertEqual(out['summary']['lifts_open'], 1)
        self.assertEqual(out['summary']['pistes']['green'][0], 1)

    def test_lp_live(self):
        closed = s.parse_lp_live(read('lp_live.json'))
        self.assertEqual(closed['summary']['pistes']['green'], [0, 0])
        self.assertIsNone(closed['season'])
        self.assertEqual(s.parse_lp_live(read('lp_live_synthetic_open.json'))['summary']['pistes']['green'], [1, 10])

    def test_la_detail_and_live(self):
        for name in ('la_live', 'la_detail'):
            out = s.parse_la(read(name + '.html'), NOW)
            self.assertEqual(out['summary']['lifts_open'], 0)
            self.assertEqual(out['summary']['lifts_total'], 52)
            opened = s.parse_la(read(name + '_synthetic_open.html'), NOW)
            self.assertEqual(opened['summary']['lifts_open'], 2)
            self.assertIs(opened['season'], True)
        out = s.parse_la(read('la_detail.html'), NOW)
        self.assertIs(out['season'], False)
        self.assertEqual(len(out['lifts']), 52)
        self.assertEqual({state for _, state in out['lifts']}, {'unknown'})
        out = s.parse_la(read('la_detail_synthetic_open.html'), NOW)
        self.assertEqual(sum(state == 'open' for _, state in out['lifts']), 2)

    def test_zero_not_preseason(self):
        raw = read('lp_dynamic.json').replace('OUT_OF_PERIOD', 'CLOSED')
        self.assertIsNone(s.parse_lp(read('lp_static.json'), raw)['season'])
        self.assertIsNone(s.parse_la(read('la_detail.html'), NOW.replace(year=2027))['season'])

    def test_missing_unknown_and_scheduled(self):
        dynamic = json.loads(read('lp_dynamic.json'))
        del dynamic['poi'][0]['lifts'][0]['openingStatus']
        dynamic['poi'][0]['lifts'][1]['openingStatus'] = 'SCHEDULED'
        out = s.parse_lp(read('lp_static.json'), json.dumps(dynamic))
        self.assertEqual(out['lifts'][0][1], 'unknown')
        self.assertEqual(out['lifts'][1][1], 'scheduled')
        self.assertIsNone(out['summary']['lifts_open'])
        self.assertEqual(s.status('SCHEDULED', 'pistes'), 'unknown')
        self.assertEqual(s.status('new-enum', 'lifts'), 'unknown')

    def test_malformed(self):
        for raw in ('', '{}', '[]', '<html>unavailable</html>'):
            with self.subTest(raw=raw):
                with self.assertRaises((ValueError, KeyError, IndexError, TypeError)):
                    s.parse_lp_live(raw)
                with self.assertRaises(ValueError):
                    s.parse_la(raw, NOW)
                with self.assertRaises((ValueError, AttributeError)):
                    s.parse_lp(raw, raw)
        with self.assertRaises(ValueError):
            s.ratio('53/52')

    def test_research_fixtures_do_not_become_status(self):
        self.assertIn('installOpenings', read('lp_detail.html'))
        self.assertIn('datas_dynamics.json', read('lp_openings.js'))
        with self.assertRaises(ValueError):
            s.parse_la(read('lumiplan.html'), NOW)


class Matching(unittest.TestCase):
    def test_normalization_and_no_guessing(self):
        cat = catalog()['lifts']
        item = next(x for x in cat if x['mtn'] == 'LP' and 'é' in x['name'])
        source = 'TSD ' + item['name'].upper().replace('É', 'E') + '.'
        matches, missing = s.match_names([(source, 'open')], cat, 'lifts', 'LP')
        self.assertEqual(states(matches), {item['name']: 'open'})
        self.assertEqual(missing, [])
        _, missing = s.match_names([(source + 'unmatched suffix', 'open')], cat, 'lifts', 'LP')
        self.assertEqual(len(missing), 1)
        duplicate = dict(item, name=item['name'] + '!')
        matches, missing = s.match_names([(source, 'open')], cat + [duplicate], 'lifts', 'LP')
        self.assertEqual(matches, {})
        self.assertEqual(len(missing), 1)

    def test_sector_and_conflict(self):
        item = next(x for x in catalog()['lifts'] if x['mtn'] == 'LP')
        matches, _ = s.match_names([(item['name'], 'open'), (item['name'], 'closed')], [item], 'lifts', 'LP')
        self.assertEqual(matches[item['name']]['state'], 'unknown')
        matches, missing = s.match_names([(item['name'], 'open')], [item], 'lifts', 'LA')
        self.assertEqual(matches, {})
        self.assertEqual(len(missing), 1)


class Collection(unittest.TestCase):
    def test_live_fixture_snapshot(self):
        out = s.collect(catalog(), None, fetch, NOW)
        self.assertIs(out['season_open'], False)
        self.assertTrue(all(x['ok'] for x in out['sources']))
        self.assertEqual(len(out['lifts']), len({x['mtn'] + '|' + x['name'] for x in catalog()['lifts']}))
        self.assertEqual(len(out['pistes']), len(catalog()['runs']))
        self.assertNotIn('open', out['lifts'].values())

    def test_all_fail_preserves_timestamp_and_data(self):
        old = s.collect(catalog(), None, fetch, NOW)
        def fail(url):
            raise OSError('offline')
        out = s.collect(catalog(), old, fail, NOW + timedelta(hours=1))
        for k in ('fetched_at', 'lifts', 'pistes', 'summary', 'season_open', 'unmatched'):
            self.assertEqual(out[k], old[k])
        self.assertTrue(all(not x['ok'] and x['error'] for x in out['sources']))
        self.assertIsNone(s.collect(catalog(), None, fail, NOW)['fetched_at'])

    def test_partial_failure_clears_stale_status(self):
        old = s.collect(catalog(), None, fetch, NOW)
        for k in old['lifts']:
            old['lifts'][k] = 'open'
        def partial(url):
            if url == s.URLS['la_detail']:
                return '<html>maintenance</html>'
            return fetch_no_lumi(url)
        out = s.collect(catalog(), old, partial, NOW)
        self.assertIsNone(out['season_open'])
        # the Vanoise Express pair is also in La Plagne's own feed, so it may keep a real status
        self.assertTrue(all(out['lifts']['LA|' + x['name']] == 'unknown' for x in catalog()['lifts']
                            if x['mtn'] == 'LA' and not x['name'].startswith('Vanoise Express')))
        self.assertFalse(out['sources'][-1]['ok'])

    def test_lp_fallback(self):
        def partial(url):
            return '{}' if url == s.URLS['lp_dynamic'] else fetch_no_lumi(url)
        out = s.collect(catalog(), None, partial, NOW)
        self.assertEqual(out['summary']['LP']['pistes']['green'], [0, 0])
        self.assertEqual([x['ok'] for x in out['sources']], [False, False, False, False, True, True])

    def test_commit_gate(self):
        old = s.collect(catalog(), None, fetch, NOW)
        new = copy.deepcopy(old)
        new['fetched_at'] = (NOW + timedelta(minutes=15)).isoformat()
        # pre-season fixture: unchanged data only re-committed daily
        self.assertFalse(s.should_commit(old, new, NOW + timedelta(minutes=61)))
        self.assertTrue(s.should_commit(old, new, NOW + timedelta(hours=24, minutes=1)))
        # in season: hourly
        new['season_open'] = True
        old_in = dict(old, season_open=True)
        self.assertFalse(s.should_commit(old_in, new, NOW + timedelta(minutes=60)))
        self.assertTrue(s.should_commit(old_in, new, NOW + timedelta(minutes=61)))
        new['summary']['LP']['lifts_open'] = 1
        self.assertTrue(s.should_commit(old, new, NOW))
        self.assertFalse(s.should_commit(old, old, NOW + timedelta(hours=2)))
        self.assertTrue(s.should_commit(None, old, NOW))


class RobotsAndNetwork(unittest.TestCase):
    def test_full_policies(self):
        for filename, path in [('lp_robots.txt', '/encart-live/ajax'), ('la_robots.txt', url_path(s.URLS['la_detail']))]:
            self.assertTrue(s.robots_allowed(read(filename), path))
            self.assertFalse(s.robots_allowed(read(filename), '/admin/private'))
        self.assertFalse(s.robots_allowed(read('lp_robots.txt'), '/anything?ref=test'))
        with self.assertRaises(ValueError):
            s.robots_allowed(read('lumiplan_robots.txt'), '/interactive-map/Paradiski/fr')
        self.assertTrue(s.robots_allowed('User-agent: *\nDisallow: /\nAllow: /ok$', '/ok'))
        self.assertFalse(s.robots_allowed('User-agent: *\nDisallow: /\nAllow: /ok$', '/okay'))
        self.assertFalse(s.robots_allowed('User-agent: *\nAllow: /\nUser-agent: first-chair-personal\nDisallow: /', '/'))

    def test_fetch_once_and_no_redirects(self):
        fetcher = s.Fetcher()
        with patch.object(fetcher.opener, 'open', side_effect=OSError('offline')) as request:
            for _ in range(2):
                with self.assertRaises(OSError):
                    fetcher.get(s.URLS['lp_dynamic'])
            self.assertEqual(request.call_count, 1)
            self.assertEqual(request.call_args[0][0].get_header('User-agent'), s.UA)
        with self.assertRaises(ValueError):
            s.NoRedirect().redirect_request(None, None, 302, '', {}, 'https://other.invalid')

    def test_robots_404_allowed_but_403_denied(self):
        for code, allowed in [(404, True), (403, False)]:
            fetcher = s.Fetcher()
            with patch.object(fetcher, 'get', side_effect=[HTTPError('url', code, '', {}, None), 'body']) as get:
                if allowed:
                    self.assertEqual(fetcher(s.URLS['lp_dynamic']), 'body')
                    self.assertEqual(get.call_count, 2)
                else:
                    with self.assertRaises(HTTPError):
                        fetcher(s.URLS['lp_dynamic'])
                    self.assertEqual(get.call_count, 1)


def url_path(url):
    return s.urlsplit(url).path



class Lumiplan(unittest.TestCase):
    """Primary source: Lumiplan's public Paradiski feed (captured 20 Nov 2026, pre-season)."""

    def graph(self):
        return json.loads((s.ROOT / 'data/build/paradiski-graph.json').read_text())

    def test_preseason_all_closed_both_sectors(self):
        p = s.parse_lumi(read('lumi_static.json'), read('lumi_dynamic.json'))
        self.assertEqual(set(p), {'LP', 'LA'})
        for sid in p:
            self.assertIs(p[sid]['season'], False)
            self.assertGreater(p[sid]['summary']['lifts_total'], 40)
            self.assertEqual(p[sid]['summary']['lifts_open'], 0)
            self.assertTrue(all(r['closes'] is None or len(r['closes']) == 5 for r in p[sid]['lifts']))

    def test_synthetic_open_day(self):
        """Hand-edited copy of the dynamic feed: the first 10 lifts open, one with real hours and a message."""
        static = json.loads(read('lumi_static.json'))
        dyn = json.loads(read('lumi_dynamic.json'))
        lift_ids = [str(i['data']['id']) for i in static['items'] if i['data'].get('type') == 'LIFT'][:10]
        for d in dyn['items']:
            if str(d['id']) in lift_ids:
                d['openingStatus'], d['operating'] = 'OPEN', True
        first = next(d for d in dyn['items'] if str(d['id']) == lift_ids[0])
        first['openingTimesReal'] = [{'beginTime': '08:45', 'endTime': '16:05'}]
        first['message'] = 'Vent fort'
        p = s.parse_lumi(json.dumps(static), json.dumps(dyn))
        recs = p['LP']['lifts'] + p['LA']['lifts']
        self.assertEqual(sum(r['state'] == 'open' for r in recs), 10)
        self.assertTrue(any(r['closes'] == '16:05' and r['message'] == 'Vent fort' for r in recs))
        self.assertIn(True, (p['LP']['season'], p['LA']['season']))

    def test_collect_prefers_lumiplan_and_matches_most_lifts(self):
        out = s.collect(catalog(), None, fetch, NOW, self.graph())
        self.assertTrue(out['sources'][0]['ok'] and out['sources'][1]['ok'])
        self.assertEqual([x['id'] for x in out['sources']], ['lumi_static', 'lumi_dynamic'])
        known = sum(v != 'unknown' for v in out['lifts'].values())
        self.assertGreaterEqual(known / len(out['lifts']), 0.6)
        self.assertNotIn('open', out['lifts'].values())

    def test_vanoise_express_alias(self):
        cat = catalog()['lifts']
        m, missing = s.match_names([{'name': 'VANOISE EXPRESS MONTCHAVIN', 'state': 'closed'}], cat, 'lifts', 'LP')
        self.assertEqual(states(m), {'Vanoise Express 1': 'closed'})
        self.assertEqual(missing, [])

    def test_same_name_lifts_paired_by_altitude(self):
        cat = [{'name': 'Twin', 'mtn': 'LP'}, {'name': 'Twin (Belle Plagne)', 'mtn': 'LP'}]
        elev = {'Twin': (1800, 2000), 'Twin (Belle Plagne)': (2050, 2300)}
        recs = [{'name': 'TWIN.', 'state': 'open', 'dep': 2040, 'arr': 2310},
                {'name': 'TWIN', 'state': 'closed', 'dep': 1795, 'arr': 2010}]
        m, missing = s.match_names(recs, cat, 'lifts', 'LP', elev)
        self.assertEqual(states(m), {'Twin': 'closed', 'Twin (Belle Plagne)': 'open'})
        self.assertEqual(missing, [])
        m, missing = s.match_names(recs, cat, 'lifts', 'LP', None)   # no elevations: never guess
        self.assertEqual(m, {})
        self.assertEqual(len(missing), 2)

    def test_normalize_variants(self):
        self.assertEqual(s.normalize('BOUQUETINS'), s.normalize('Bouquetin'))
        self.assertEqual(s.normalize('COQS'), s.normalize('Les Coqs'))
        self.assertEqual(s.normalize('Transarc II', True), s.normalize('TC TRANSARC 2', True))
        self.assertEqual(s.normalize('Arpette (Arc 1800)'), s.normalize('ARPETTE'))
        self.assertEqual(s.normalize('BELLE PLAGNE.', True), s.normalize('Belle Plagne #2', True))


if __name__ == '__main__':
    unittest.main()
