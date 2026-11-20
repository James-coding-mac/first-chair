// node tools/test_stats.mjs : season stats + day card drawing (no browser needed)
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL('../stats.js', import.meta.url), 'utf8'), ctx);
const { seasonStats, drawDayCard } = ctx.window.FCStats;

// empty / junk
let s = seasonStats([]);
assert.equal(s.days, 0); assert.equal(s.vertical, 0); assert.equal(s.bestDay, null);
assert.equal(seasonStats(null).days, 0);
assert.equal(seasonStats([null, 5, 'x']).days, 0);

// old entries (no track) count as days only
const old = [{ id: 1, date: '2026-01-02', resort: 'wb', cond: 'Powder', notes: 'x' },
             { id: 2, date: '2026-01-03', resort: 'wb', cond: 'Icy', notes: '' }];
s = seasonStats(old);
assert.equal(s.days, 2); assert.equal(s.trackedDays, 0); assert.equal(s.perResort.wb, 2);

// mixed: tracked days, a duplicate day entry, null vertical, resort filter
const mixed = old.concat([
  { id: 3, date: '2026-12-13', resort: 'pdk', track: { totals: { runs: 12, vertical: 4100, distance: 38000, topSpeed: 84.2, liftRides: 13 } } },
  { id: 4, date: '2026-12-14', resort: 'pdk', track: { totals: { runs: 9, vertical: 5200, distance: 41000, topSpeed: 91, liftRides: 10 } } },
  { id: 5, date: '2026-12-14', resort: 'pdk', notes: 'same day, manual entry' },
  { id: 6, date: '2026-12-15', resort: 'pdk', track: { totals: { runs: 3, vertical: null, distance: 4000, topSpeed: 'x', liftRides: 2 } } },
]);
s = seasonStats(mixed);
assert.equal(s.days, 5);                       // 2 wb + 3 distinct pdk days
assert.equal(s.trackedDays, 3);
assert.equal(s.runs, 24); assert.equal(s.vertical, 9300); assert.equal(s.distance, 83000);
assert.equal(s.topSpeed, 91); assert.equal(s.liftRides, 25);
assert.deepEqual({ ...s.bestDay }, { date: '2026-12-14', resort: 'pdk', vertical: 5200 });
assert.equal(seasonStats(mixed, 'wb').trackedDays, 0);
assert.equal(seasonStats(mixed, 'pdk').days, 3);

// drawing: stub context records calls; must not throw with full, partial or empty data
const calls = [];
const stub = new Proxy({}, { get: (t, k) => k in t ? t[k] : (...a) => calls.push([k, a]), set: (t, k, v) => (t[k] = v, true) });
drawDayCard(stub, { resort: 'Paradiski', date: 'Sun 13 Dec 2026', vertical: 4100, runs: 12, distance: 38000, topSpeed: 84, liftRides: 13, profile: [2000, 1800, 2400, 1600] });
assert.ok(calls.some(([k, a]) => k === 'fillText' && a[0] === '4100'));
assert.ok(calls.some(([k]) => k === 'stroke'));
drawDayCard(stub, {});
drawDayCard(stub, null);
assert.ok(calls.some(([k, a]) => k === 'fillText' && a[0] === '—'));
console.log('PASS: season stats (empty, old entries, mixed, filter) and day card drawing');
