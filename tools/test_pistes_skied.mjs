// node tools/test_pistes_skied.mjs : FCTrack.matchPistes against real Paradiski piste lines
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL('../track.js', import.meta.url), 'utf8'), ctx);
const { matchPistes } = ctx.window.FCTrack;
const geo = JSON.parse(fs.readFileSync(new URL('../data/build/paradiski-map.geojson', import.meta.url), 'utf8'));
const lines = geo.features.filter(f => f.properties.k === 'piste' && f.properties.n && f.geometry.type === 'LineString')
  .map(f => ({ name: f.properties.n, coords: f.geometry.coordinates.map(c => [c[1], c[0]]) }));

// a real, longish named piste line
const len = l => l.coords.slice(1).reduce((s, c, i) => s + Math.hypot((c[0] - l.coords[i][0]) * 110540, (c[1] - l.coords[i][1]) * 78000), 0);
const target = lines.filter(l => len(l) > 600).sort((a, b) => len(b) - len(a))[0];
assert.ok(target, 'need a long piste line');

// densify a polyline into GPS points every ~8 m, 1 s apart, optional metre offset east
function walk(coords, offsetM = 0, t0 = 1000) {
  const pts = [];
  for (let i = 0; i + 1 < coords.length; i++) {
    const [a, b] = [coords[i], coords[i + 1]];
    const n = Math.max(1, Math.round(Math.hypot((b[0] - a[0]) * 110540, (b[1] - a[1]) * 78000) / 8));
    for (let k = 0; k < n; k++) pts.push({ lat: a[0] + (b[0] - a[0]) * k / n, lon: a[1] + (b[1] - a[1]) * k / n + offsetM / 78000 });
  }
  return pts.map((p, i) => ({ ...p, t: t0 + i * 1000 }));
}
const run = pts => ({ start: pts[0].t, end: pts[pts.length - 1].t });

// 1. following the piste => matched
let pts = walk(target.coords);
let res = matchPistes(pts, [run(pts)], lines);
assert.ok(res[0].includes(target.name), `expected ${target.name}, got ${res[0]}`);

// 2. same shape 300 m off to the side => not this piste
pts = walk(target.coords, 300);
res = matchPistes(pts, [run(pts)], lines);
assert.ok(!res[0].includes(target.name), 'offset path must not match');

// 3. crossing the piste at right angles => not matched
const mid = target.coords[Math.floor(target.coords.length / 2)], nxt = target.coords[Math.floor(target.coords.length / 2) + 1];
const dLat = nxt[0] - mid[0], dLon = nxt[1] - mid[1], norm = Math.hypot(dLat * 110540, dLon * 78000) || 1;
const perp = [-dLon * 78000 / norm, dLat * 110540 / norm];   // metres, perpendicular
const cross = [[mid[0] - perp[0] * 150 / 110540, mid[1] - perp[1] * 150 / 78000], [mid[0] + perp[0] * 150 / 110540, mid[1] + perp[1] * 150 / 78000]];
pts = walk(cross);
res = matchPistes(pts, [run(pts)], [target]);
assert.deepEqual([...res[0]], [], 'perpendicular crossing must not match');

// 4. points outside the run's time window (e.g. a lift ride) are ignored
pts = walk(target.coords);
res = matchPistes(pts, [{ start: 0, end: 10 }], lines);
assert.deepEqual([...res[0]], []);

// 5. junk input
assert.deepEqual([...matchPistes(null, null, null)], []);
assert.deepEqual([...matchPistes([], [{ start: 0, end: 1 }], [])[0]], []);
console.log(`PASS: pistes skied (follows "${target.name}", offset, perpendicular, outside run window, junk)`);

// lift rides -> lift names (same real geometry)
const { matchLifts } = ctx.window.FCTrack;
const liftLines = geo.features.filter(f => f.properties.k === 'lift' && f.properties.n && f.geometry.type === 'LineString')
  .map(f => ({ name: f.properties.n, coords: f.geometry.coordinates.map(c => [c[1], c[0]]) }));
const lift = liftLines.filter(l => len(l) > 800)[0];
let lp = walk(lift.coords);
let lr = matchLifts(lp, [run(lp)], liftLines);
assert.equal(lr[0], lift.name, `lift ride should match ${lift.name}`);
lp = walk(lift.coords, 400);
assert.notEqual(matchLifts(lp, [run(lp)], [lift])[0], lift.name, 'ride 400 m away must not match');
assert.deepEqual([...matchLifts([], [{ start: 0, end: 1 }], liftLines)], [null]);
console.log(`PASS: lift rides matched to lift names ("${lift.name}", offset, empty)`);
