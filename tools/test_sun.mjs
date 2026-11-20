// node tools/test_sun.mjs : sun position, sunrise/sunset, slope aspect and lighting
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

process.env.TZ = 'Europe/Paris';
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL('../sun.js', import.meta.url), 'utf8'), ctx);
const S = ctx.window.FCSun;
const lat = 45.5, lon = 6.7, near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);

// 1. Winter solstice: noon altitude = 90 - lat - 23.44 = 21.06 deg. Find the day's max by scanning.
let best = { altitude: -90 }, bestT = null;
for (let m = 0; m < 1440; m++) {
  const t = new Date(Date.UTC(2026, 11, 21, 0, m)), p = S.position(t, lat, lon);
  if (p.altitude > best.altitude) { best = p; bestT = t; }
}
near(best.altitude, 21.06, 0.4, 'solstice noon altitude');
near(best.azimuth, 180, 1.5, 'solar noon azimuth (due south)');
// solar noon at 6.7 E on 21 Dec ≈ 12:00 UTC - 26.8 min (longitude) + ~1.7 min (equation of time) ≈ 11:35 UTC
near(bestT.getUTCHours() * 60 + bestT.getUTCMinutes(), 11 * 60 + 35, 4, 'solar noon minute (UTC)');

// 2. Equinox: noon altitude ≈ 90 - 45.5 = 44.5 deg
let eq = -90;
for (let m = 0; m < 1440; m += 2) eq = Math.max(eq, S.position(new Date(Date.UTC(2027, 2, 20, 0, m)), lat, lon).altitude);
near(eq, 44.5, 0.8, 'equinox noon altitude');

// 3. Sunrise/sunset 13 Dec 2026, independent check with the hour-angle equation:
//    cos H0 = (sin(-0.833) - sin(phi) sin(dec)) / (cos(phi) cos(dec)), dec ≈ -23.2 deg
const dec = -23.2 * Math.PI / 180, phi = lat * Math.PI / 180;
const H0 = Math.acos((Math.sin(-0.833 * Math.PI / 180) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec))) * 180 / Math.PI;
const noonUTC = 12 * 60 - lon * 4 - 6;               // equation of time ≈ +6 min on 13 Dec (sun early)
const { sunrise, sunset } = S.times(new Date(2026, 11, 13, 12), lat, lon);
near(sunrise.getUTCHours() * 60 + sunrise.getUTCMinutes(), noonUTC - H0 * 4, 4, 'sunrise (UTC min)');
near(sunset.getUTCHours() * 60 + sunset.getUTCMinutes(), noonUTC + H0 * 4, 4, 'sunset (UTC min)');

// 4. Aspect: a line running downhill to the south faces south; uphill drawing direction too.
const a = [45.50, 6.70], b = [45.497, 6.70];          // ~330 m south
let asp = S.lineAspect(a, b, 2100, 1950);
near(asp.aspect, 180, 1, 'south-facing aspect'); near(asp.slope, Math.atan(150 / 331.6) * 180 / Math.PI, 1, 'slope');
asp = S.lineAspect(b, a, 1950, 2100);
near(asp.aspect, 180, 1, 'aspect independent of drawing direction');
assert.equal(S.lineAspect(a, [45.4995, 6.70], 2000, 1990).aspect, null, 'short/flat => unknown');

// 5. Lighting: low midwinter sun from the south lights a south slope, not a steep north slope.
const noonSun = { azimuth: 180, altitude: 21 };
assert.equal(S.isLit(noonSun, 180, 25), true, 'south slope lit at noon');
assert.equal(S.isLit(noonSun, 0, 30), false, 'steep north slope in its own shadow at noon');
assert.equal(S.isLit({ azimuth: 120, altitude: 1 }, 120, 20), false, 'sun at the horizon');
assert.equal(S.isLit({ azimuth: 180, altitude: 30 }, null, null), true, 'unknown aspect, high sun');
assert.equal(S.compass(359), 'N'); assert.equal(S.compass(135), 'SE');
console.log('PASS: sun position (solstice/equinox/noon), sunrise/sunset, aspect, lighting');
