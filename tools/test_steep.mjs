// node tools/test_steep.mjs : slope maths for the steepness layer
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL('../steep.js', import.meta.url), 'utf8'), ctx);
const S = ctx.window.FCSteep;
const near = (a, b, t, m) => assert.ok(Math.abs(a - b) <= t, `${m}: ${a} vs ${b}`);

// planes with known gradient: rise r metres per pixel of size m => slope atan(r/m)
const plane = (r, dir) => { const e = new Float32Array(65536); for(let y = 0; y < 256; y++) for(let x = 0; x < 256; x++) e[y*256 + x] = 2000 + r * (dir === 'x' ? x : y); return e; };
for(const deg of [0, 20, 30, 35, 40, 50]){
  const r = 10 * Math.tan(deg * Math.PI / 180);
  near(S.slopes(plane(r, 'x'), 10)[128*256 + 128], deg, 0.01, `east-west ${deg}°`);
  near(S.slopes(plane(r, 'y'), 10)[128*256 + 128], deg, 0.01, `north-south ${deg}°`);
}
// bands
assert.equal(S.band(29.9), null);
assert.deepEqual([...S.band(32)], [241, 196, 15]);
assert.deepEqual([...S.band(37)], [230, 126, 34]);
assert.deepEqual([...S.band(42)], [192, 57, 43]);
assert.deepEqual([...S.band(60)], [123, 79, 184]);
// terrarium decode: 2000 m = 32768 + 2000 = 34768 = 135*256 + 208 + 0/256
const rgba = new Uint8ClampedArray(65536 * 4); for(let p = 0; p < 65536; p++){ rgba[p*4] = 135; rgba[p*4+1] = 208; rgba[p*4+2] = 0; }
near(S.decode(rgba)[0], 2000, 0.01, 'terrarium decode');
// tile latitude (Web Mercator): equator at the middle row, top edge of the world = 85.0511°
near(S.tileLat(0.5, 0), 0, 1e-9, 'equator');
near(S.tileLat(0, 1), 85.0511, 1e-4, 'top edge');
near(S.tileLat(1462.5, 12), 45.675, 0.01, 'z12 row 1462 (Paradiski north edge)');
console.log('PASS: steepness slope maths (Horn), bands, terrarium decode, tile latitude');
