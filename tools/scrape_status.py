#!/usr/bin/env python3
"""Public resort status snapshots. Python 3.9+, stdlib only; no retries or JS execution."""
import argparse
import copy
from datetime import datetime, timezone
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import unicodedata
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'data/status/paradiski.json'
UA = 'first-chair-personal/0.1 (+https://github.com/james-coding-mac/first-chair)'
LUMI = 'https://public.lumiplay.link/interactive-map/v1/map/e6302a83-ce5b-4717-bab8-4f282b1083d7/'  # Paradiski
URLS = {
    'lumi_static': LUMI + 'staticPoiData?lang=fr',
    'lumi_dynamic': LUMI + 'dynamicPoiData?lang=fr',
    'lp_static': 'https://ouvertures.la-plagne.com/datas_statics.json',
    'lp_dynamic': 'https://ouvertures.la-plagne.com/datas_dynamics.json',
    'lp_live': 'https://www.la-plagne.com/encart-live/ajax',
    'la_detail': 'https://www.lesarcs.com/fr/guide-pratique-les-arcs/domaines-et-remontees-mecaniques',
}
COLORS = ('green', 'blue', 'red', 'black')


class Node:
    def __init__(self, tag='', attrs=()):
        self.tag, self.attrs, self.children = tag, dict(attrs), []

    def text(self):
        return ' '.join(c.text() if isinstance(c, Node) else c for c in self.children).strip()

    def find(self, cls=None, **attrs):
        found = []
        if (cls is None or cls in self.attrs.get('class', '').split()) and all(self.attrs.get(k) == v for k, v in attrs.items()):
            found.append(self)
        for child in self.children:
            if isinstance(child, Node):
                found.extend(child.find(cls, **attrs))
        return found


class Document(HTMLParser):
    def __init__(self, raw):
        super().__init__(convert_charrefs=True)
        self.root = Node()
        self.stack = [self.root]
        self.feed(raw)
        self.close()

    def handle_starttag(self, tag, attrs):
        n = Node(tag, attrs)
        self.stack[-1].children.append(n)
        if tag not in ('area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'):
            self.stack.append(n)

    def handle_startendtag(self, tag, attrs):
        self.stack[-1].children.append(Node(tag, attrs))

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                break

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def empty_summary():
    return {'lifts_open': None, 'lifts_total': None, 'pistes': {c: [None, None] for c in COLORS}}


def result(summary=None, season=None):
    return {'summary': summary or empty_summary(), 'season': season, 'lifts': [], 'pistes': []}


def ratio(text):
    m = re.fullmatch(r'\s*(\d+)\s*/\s*(\d+)\s*', text)
    if not m or int(m[1]) > int(m[2]):
        raise ValueError('Invalid opening count: ' + text[:80])
    return [int(m[1]), int(m[2])]


def status(raw, kind):
    value = str(raw or '').upper()
    if value == 'OPEN':
        return 'open'
    if value in ('CLOSED', 'OUT_OF_PERIOD'):
        return 'closed'
    if kind == 'lifts' and value == 'SCHEDULED':
        return 'scheduled'
    return 'unknown'


def parse_lp_live(raw):
    commands = json.loads(raw)
    doc = Document(commands[0]['data']).root
    summary = empty_summary()
    for fr, en in zip(('Vert', 'Bleu', 'Rouge', 'Noir'), COLORS):
        matches = [n for n in doc.find('jauge-piste') if n.find('couleur-piste') and n.find('couleur-piste')[0].text() == fr]
        if len(matches) != 1:
            raise ValueError('Missing/duplicate La Plagne colour: ' + fr)
        summary['pistes'][en] = ratio(matches[0].find('nombre-piste')[0].text())
    # Zero counts alone do not establish whether the season has started.
    return result(summary, True if any(v[0] for v in summary['pistes'].values()) else None)


def parse_la(raw, now):
    doc = Document(raw).root
    summary = empty_summary()
    cells = doc.find(**{'data-kpi': 'lifts'})
    if len(cells) != 1:
        raise ValueError('Missing/duplicate Les Arcs lift summary')
    summary['lifts_open'], summary['lifts_total'] = ratio(cells[0].find('live_tile-grid_column-value')[0].text())
    out = result(summary)
    for item in doc.find('LiveSkiLiftItem'):
        kind = {'lift': 'lifts', 'trail': 'pistes'}.get(item.attrs.get('data-item-type'))
        names, states = item.find('LiveSkiLiftItem-name'), item.find('LiveSkiLiftItem-status')
        if not kind or len(names) != 1 or not names[0].text():
            raise ValueError('Malformed Les Arcs item')
        raw_status = states[0].attrs.get('data-status') if len(states) == 1 else None
        out[kind].append((names[0].text(), status(raw_status, kind)))
    if summary['lifts_open'] or any(s == 'open' for k in ('lifts', 'pistes') for _, s in out[k]):
        out['season'] = True
    else:
        # Explicit dated announcement, not the HTML's misleading data-is-open flag.
        m = re.search(r'Ouverture du Domaine de Montagne dès le (\d{1,2}) décembre (\d{4})', doc.text())
        if m and now < datetime(int(m[2]), 12, int(m[1]), tzinfo=timezone.utc):
            out['season'] = False
    return out


def parse_lp(static_raw, dynamic_raw):
    static, dynamic = json.loads(static_raw), json.loads(dynamic_raw)
    if not isinstance(static.get('poi'), list) or not static['poi'] or not isinstance(dynamic.get('poi'), list) or not dynamic['poi']:
        raise ValueError('Missing La Plagne POI arrays')
    index = {}
    for sector in dynamic['poi']:
        for field in ('lifts', 'trails'):
            for item in sector[field]:
                key = (sector['id'], field, item['id'])
                if key in index:
                    raise ValueError('Duplicate dynamic ID')
                index[key] = item.get('openingStatus')
    out, raw_states = result(), []
    grouped = {c: [] for c in COLORS}
    seen = set()
    for sector in static['poi']:
        for field, kind in (('lifts', 'lifts'), ('trails', 'pistes')):
            for item in sector[field]:
                key = (sector['id'], field, item['id'])
                if key in seen or not isinstance(item['name'], str) or not item['name'].strip():
                    raise ValueError('Duplicate static ID or missing name')
                seen.add(key)
                raw_state = index.get(key)
                state = status(raw_state, kind)
                raw_states.append(raw_state)
                out[kind].append((item['name'].strip(), state))
                if field == 'trails' and item.get('trailType') == 'DOWNHILL_SKIING' and item.get('trailLevel', '').lower() in grouped:
                    grouped[item['trailLevel'].lower()].append(state)
    if not raw_states or not (seen & index.keys()):
        raise ValueError('No joined La Plagne records')
    def counts(states):
        return [None if 'unknown' in states else states.count('open'), len(states)]
    out['summary']['lifts_open'], out['summary']['lifts_total'] = counts([s for _, s in out['lifts']])
    out['summary']['pistes'] = {c: counts(s) for c, s in grouped.items()}
    out['season'] = True if 'OPEN' in raw_states else False if all(s == 'OUT_OF_PERIOD' for s in raw_states) else None
    return out


LUMI_SECTOR = {'Les Arcs': 'LA', 'Peisey-Vallandry': 'LA', 'La Plagne': 'LP'}
LUMI_TRAILS = ('DOWNHILL_SKIING', 'SNOWPARK', 'BOARDERCROSS', 'SLALOM_STADIUM')
# The two Vanoise Express cabins run as a pair between the sectors; OSM numbers them, Lumiplan
# names them by departure village. OSM way 48061002 "Vanoise Express 1" runs LP -> LA.
LIFT_ALIAS_NAMES = {'Vanoise Express Montchavin': 'Vanoise Express 1', 'Vanoise Express Peisey': 'Vanoise Express 2'}


def lumi_closes(static_item, dynamic_item):
    times = dynamic_item.get('openingTimesReal') or static_item.get('openingTimesTheoretic') or []
    ends = [t.get('endTime') for t in times if isinstance(t, dict) and isinstance(t.get('endTime'), str)
            and re.fullmatch(r'\d{2}:\d{2}', t['endTime'])]
    return max(ends) if ends else None


def parse_lumi(static_raw, dynamic_raw):
    """Lumiplan Paradiski feed -> {'LP': result, 'LA': result}; records carry extra detail."""
    static, dynamic = json.loads(static_raw), json.loads(dynamic_raw)
    if not isinstance(static.get('items'), list) or not isinstance(dynamic.get('items'), list):
        raise ValueError('Missing Lumiplan item arrays')
    dyn = {str(i.get('id')): i for i in dynamic['items'] if isinstance(i, dict)}
    items = {str(i['data']['id']): i['data'] for i in static['items']
             if isinstance(i, dict) and isinstance(i.get('data'), dict) and 'id' in i['data']}
    sector_of = {}
    for resort in static.get('resorts', []):
        sid = LUMI_SECTOR.get(resort.get('name'))
        for sector in resort.get('sectors', []) if sid else []:
            for item_id in sector.get('itemIds', []):
                sector_of[str(item_id)] = sid
    out = {sid: result() for sid in ('LP', 'LA')}
    raw_states = {sid: [] for sid in out}
    for item_id, item in items.items():
        sid, d = sector_of.get(item_id), dyn.get(item_id, {})
        name = item.get('name')
        if not sid or not isinstance(name, str) or not name.strip():
            continue
        kind = 'lifts' if item.get('type') == 'LIFT' else 'pistes' if (
            item.get('type') == 'TRAIL' and item.get('trailType') in LUMI_TRAILS) else None
        if not kind:
            continue
        raw = d.get('openingStatus')
        rec = {'name': name.strip(), 'state': status(raw, kind), 'closes': lumi_closes(item, d),
               'dep': item.get('departureAltitude'), 'arr': item.get('arrivalAltitude'),
               'level': str(item.get('trailLevel') or '').lower() or None,
               'grooming': d.get('groomingStatus') if isinstance(d.get('groomingStatus'), str) else None,
               'message': d.get('message') if isinstance(d.get('message'), str) else None,
               # queue time: the map config says waits are shown in MINUTES, but the field only appears
               # in season, so take the first numeric field whose name mentions "wait"
               'wait': next((round(v) for k, v in sorted(d.items()) if 'wait' in k.lower()
                             and isinstance(v, (int, float)) and not isinstance(v, bool) and 0 <= v < 240), None)}
        out[sid][kind].append(rec)
        raw_states[sid].append(raw)
    for sid, p in out.items():
        if not p['lifts'] and not p['pistes']:
            raise ValueError('No Lumiplan records for ' + sid)
        lifts = [r['state'] for r in p['lifts']]
        p['summary']['lifts_open'], p['summary']['lifts_total'] = lifts.count('open'), len(lifts)
        for c in COLORS:
            st = [r['state'] for r in p['pistes'] if r['level'] == c]
            p['summary']['pistes'][c] = [st.count('open'), len(st)]
        rs = raw_states[sid]
        p['season'] = True if 'OPEN' in rs else False if rs and all(s in ('OUT_OF_PERIOD', 'CLOSED') for s in rs) else None
    return out


ROMAN = {'i': '1', 'ii': '2', 'iii': '3', 'iv': '4', 'v': '5'}
ARTICLES = {'le', 'la', 'les', 'l', 'du', 'de', 'des', 'd'}


def normalize(name, lift=False):
    """Comparable key: accents, case, punctuation, trailing dots, our '(village)'/'#2' suffixes,
    articles, Roman numerals, plural 's' and lift-type prefixes are ignored."""
    name = re.sub(r'\s*(\([^)]*\))?\s*(#\d+)?\s*$', '', name.strip())
    name = ''.join(c for c in unicodedata.normalize('NFKD', name.casefold()) if not unicodedata.combining(c))
    tokens = re.sub(r'[^a-z0-9]+', ' ', name).split()
    if lift:
        while tokens and re.fullmatch(r'(tsd|ts|tc|tk|tph|tlc|telepherique|telecabine|telesiege|teleski|funiculaire)\d*', tokens[0]):
            tokens = tokens[1:]
    tokens = [ROMAN.get(t, t) for t in tokens if t not in ARTICLES] or tokens
    tokens = [t[:-1] if len(t) > 3 and t.endswith('s') else t for t in tokens]
    return ''.join(tokens)


LIFT_ALIASES = {normalize(k, True): v for k, v in LIFT_ALIAS_NAMES.items()}


def _old_normalize(name, lift=False):
    name = ''.join(c for c in unicodedata.normalize('NFKD', name.casefold()) if not unicodedata.combining(c))
    name = re.sub(r'[^a-z0-9]+', ' ', name).strip()
    if lift:
        name = re.sub(r'^(?:(?:tsd|ts|tc|tk|tph|telepherique|telecabine|telesiege|teleski)\d*\s+)+', '', name)
    return name.replace(' ', '')


def match_names(records, catalog, kind, sector, elevations=None):
    """Match source records ((name, state) tuples or dicts) to our names in one sector.
    Exact normalised-name matches only. Same-named pistes (our clusters of one piste) all take the
    status. Same-named lifts are paired by altitude when both sides have elevations; otherwise
    left unknown. Returns ({our name: record}, [unmatched source names])."""
    lift = kind == 'lifts'
    recs = [r if isinstance(r, dict) else {'name': r[0], 'state': r[1]} for r in records]
    index = {}
    for item in catalog:
        if item.get('mtn') == sector:
            index.setdefault(normalize(item['name'], lift), []).append(item['name'])
    by_key = {}
    for r in recs:
        key = normalize(r['name'], lift)
        if lift and key in LIFT_ALIASES:
            by_key.setdefault(('alias', LIFT_ALIASES[key]), []).append(r)
        else:
            by_key.setdefault(key, []).append(r)
    matched, unmatched = {}, []

    def put(target, r):
        old = matched.get(target)
        matched[target] = r if old is None or old['state'] == r['state'] else dict(r, state='unknown')

    for key, rs in by_key.items():
        if isinstance(key, tuple):
            for r in rs:
                put(key[1], r)
            continue
        ours = index.get(key, [])
        if not ours:
            unmatched.extend(r['name'] for r in rs)
        elif not lift or len(ours) == 1:
            for target in ours:
                for r in rs:
                    put(target, r)
        elif elevations and all(o in elevations for o in ours) and all(
                isinstance(r.get('dep'), (int, float)) and isinstance(r.get('arr'), (int, float)) for r in rs):
            pairs = sorted((abs(r['dep'] - elevations[o][0]) + abs(r['arr'] - elevations[o][1]), i, o)
                           for i, r in enumerate(rs) for o in ours)
            used_r, used_o = set(), set()
            for cost, i, o in pairs:
                if i in used_r or o in used_o or cost > 300:
                    continue
                used_r.add(i); used_o.add(o); put(o, rs[i])
            unmatched.extend(r['name'] for i, r in enumerate(rs) if i not in used_r)
        else:
            unmatched.extend(r['name'] for r in rs)
    return matched, unmatched


def robots_allowed(raw, path):
    """Robots groups, wildcard/$ paths and longest matching rule (Allow wins ties)."""
    if '<html' in raw.lower() or '<!doctype' in raw.lower():
        raise ValueError('robots.txt returned HTML')
    groups, agents, rules = [], [], []
    for line in raw.splitlines() + ['User-agent: end-of-file']:
        key, sep, value = line.split('#', 1)[0].partition(':')
        key, value = key.strip().lower(), value.strip()
        if key == 'user-agent':
            if rules:
                groups.append((agents, rules))
                agents, rules = [], []
            agents.append(value.lower())
        elif key in ('allow', 'disallow') and agents:
            rules.append((key, value))
    selected = [(max((len(a) if a != '*' else 0) for a in agents if a == '*' or a in UA.lower()), rules)
                for agents, rules in groups if any(a == '*' or a in UA.lower() for a in agents)]
    if not selected:
        return True
    best = max(score for score, _ in selected)
    matches = []
    for score, rules in selected:
        if score != best:
            continue
        for key, value in rules:
            if not value:
                continue
            pattern = re.escape(value).replace(r'\*', '.*')
            if value.endswith('$'):
                pattern = pattern[:-2] + '$'
            if re.match(pattern, path):
                matches.append((len(value.replace('*', '').rstrip('$')), key == 'allow'))
    return max(matches)[1] if matches else True


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError('Redirect refused; re-check source and robots policy')


class Fetcher:
    def __init__(self):
        self.cache = {}
        self.opener = build_opener(NoRedirect)

    def get(self, url):
        # Cache both successes and failures: at most one GET per endpoint per run.
        if url not in self.cache:
            try:
                with self.opener.open(Request(url, headers={'User-Agent': UA}), timeout=30) as response:
                    raw = response.read(4_000_001)
                    if len(raw) > 4_000_000:
                        raise ValueError('Response too large')
                    self.cache[url] = raw.decode('utf-8')
            except Exception as exc:
                self.cache[url] = exc
        value = self.cache[url]
        if isinstance(value, Exception):
            raise value
        return value

    def __call__(self, url):
        parts = urlsplit(url)
        robots_url = parts.scheme + '://' + parts.netloc + '/robots.txt'
        try:
            raw = self.get(robots_url)
        except HTTPError as exc:
            if exc.code not in (404, 410):
                raise
            raw = ''  # No published robots policy; other failures fail closed.
        if not robots_allowed(raw, parts.path + ('?' + parts.query if parts.query else '')):
            raise ValueError('Disallowed by robots.txt')
        return self.get(url)


def lift_elevations(catalog, graph):
    """{our lift name: (bottom m, top m)} from the nearest route-graph node to each end (DEM)."""
    if not graph:
        return {}
    nodes = graph.get('nodes', [])

    def ele(pt):
        best = min(nodes, key=lambda n: (n[0] - pt[0]) ** 2 + ((n[1] - pt[1]) * 0.7) ** 2, default=None)
        return best[2] if best and abs(best[0] - pt[0]) < 0.002 and abs(best[1] - pt[1]) < 0.003 else None

    out = {}
    for lift in catalog.get('lifts', []):
        b, t = ele(lift['bottom']), ele(lift['top'])
        if b is not None and t is not None:
            out[lift['name']] = (b, t)
    return out


def collect(catalog, previous, fetch, now, graph=None):
    sources, parsed = [], {}
    def get(source_id):
        entry = {'id': source_id, 'url': URLS[source_id], 'ok': False, 'error': None}
        sources.append(entry)
        try:
            return fetch(entry['url']), entry
        except Exception as exc:
            entry['error'] = str(exc)
            return None, entry
    lumi_s, lse = get('lumi_static')
    lumi_d, lde = get('lumi_dynamic')
    if lumi_s is not None and lumi_d is not None:
        try:
            parsed.update(parse_lumi(lumi_s, lumi_d))
            lse['ok'] = lde['ok'] = True
        except Exception as exc:
            lse['error'] = lde['error'] = 'Parse: ' + str(exc)
    static = dynamic = None
    if 'LP' not in parsed:
        static, se = get('lp_static')
        dynamic, de = get('lp_dynamic')
    if 'LP' in parsed:
        pass
    elif static is not None and dynamic is not None:
        try:
            parsed['LP'] = parse_lp(static, dynamic)
            se['ok'] = de['ok'] = True
        except Exception as exc:
            se['error'] = de['error'] = 'Parse: ' + str(exc)
    else:
        for entry in (se, de):
            entry['error'] = entry['error'] or 'Cannot join static/dynamic feed: companion unavailable'
    if 'LP' not in parsed:
        raw, entry = get('lp_live')
        if raw is not None:
            try:
                parsed['LP'] = parse_lp_live(raw)
                entry['ok'] = True
            except Exception as exc:
                entry['error'] = 'Parse: ' + str(exc)
    raw, entry = (None, None) if 'LA' in parsed else get('la_detail')
    if raw is not None:
        try:
            parsed['LA'] = parse_la(raw, now)
            entry['ok'] = True
        except Exception as exc:
            entry['error'] = 'Parse: ' + str(exc)
    if not parsed and previous:
        out = copy.deepcopy(previous)
        out['sources'] = sources
        return out
    out = {'v': 1, 'fetched_at': now.isoformat().replace('+00:00', 'Z') if parsed else None,
           'season_open': None, 'sources': sources, 'summary': {}, 'lifts': {}, 'pistes': {},
           'unmatched': {'lifts': [], 'pistes': []}}
    seasons = [p['season'] for p in parsed.values()]
    out['season_open'] = True if True in seasons else False if len(seasons) == 2 and all(s is False for s in seasons) else None
    elevations = lift_elevations(catalog, graph)
    out['lift_info'], out['piste_info'] = {}, {}
    # Lift names can repeat across sectors (e.g. "Arpette" in both), so lifts are keyed
    # "<sector>|<name>"; run names are already unique across Paradiski.
    sector_of = {i['name']: i['mtn'] for i in catalog['lifts']}
    for kind, field in (('lifts', 'lifts'), ('pistes', 'runs')):
        found = {}
        for sector in ('LP', 'LA'):
            p = parsed.get(sector, result())
            out['summary'][sector] = p['summary']
            matches, unmatched = match_names(p[kind], catalog[field], kind, sector, elevations)
            out['unmatched'][kind].extend(unmatched)
            for name, r in matches.items():
                # aliases (Vanoise Express) may name a lift in the other sector
                owner = sector_of.get(name, sector) if kind == 'lifts' else sector
                found[(owner, name)] = r
        info = out['lift_info' if kind == 'lifts' else 'piste_info']
        for item in catalog[field]:
            r = found.get((item['mtn'], item['name']))
            key = item['mtn'] + '|' + item['name'] if kind == 'lifts' else item['name']
            out[kind][key] = r['state'] if r else 'unknown'
            extra = {k: r.get(k) for k in ('closes', 'grooming', 'message', 'wait') if r and r.get(k) is not None}
            if extra:
                info[key] = extra
    for kind in ('lifts', 'pistes'):
        out['unmatched'][kind] = sorted(set(out['unmatched'][kind]))
    return out


def should_commit(old, new, now):
    if not old or any(old.get(k) != new.get(k) for k in ('lifts', 'pistes', 'summary', 'lift_info', 'piste_info')):
        return True
    try:
        age = (now - datetime.fromisoformat(old['fetched_at'].replace('Z', '+00:00'))).total_seconds()
    except (KeyError, TypeError, ValueError):
        return old != new
    # unchanged data: refresh the timestamp hourly in season, daily while everything is closed
    return age > (3600 if new.get('season_open') else 86400) and old != new


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--commit-check', nargs=2, metavar=('OLD', 'NEW'))
    args = parser.parse_args()
    now = datetime.now(timezone.utc).replace(microsecond=0)
    if args.commit_check:
        old_path, new_path = map(Path, args.commit_check)
        old = json.loads(old_path.read_text()) if old_path.exists() else None
        print('true' if should_commit(old, json.loads(new_path.read_text()), now) else 'false')
        return
    catalog = json.loads((ROOT / 'data/build/paradiski.js').read_text().split('= ', 1)[1].strip().rstrip(';'))
    previous = json.loads(OUTPUT.read_text()) if OUTPUT.exists() else None
    graph_path = ROOT / 'data/build/paradiski-graph.json'
    graph = json.loads(graph_path.read_text()) if graph_path.exists() else None
    out = collect(catalog, previous, Fetcher(), now, graph)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    temp = OUTPUT.with_suffix('.tmp')
    temp.write_text(json.dumps(out, ensure_ascii=False, indent=2, sort_keys=True) + '\n')
    temp.replace(OUTPUT)
    for source in out['sources']:
        print(source['id'] + ': ' + ('OK' if source['ok'] else source['error']))
    for kind in ('lifts', 'pistes'):
        known = sum(s != 'unknown' for s in out[kind].values())
        print('{}: {}/{} known statuses; {} unmatched source names'.format(kind, known, len(out[kind]), len(out['unmatched'][kind])))
    print('season_open:', out['season_open'])


if __name__ == '__main__':
    main()
