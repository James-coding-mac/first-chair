/* Sun position and sunlit slopes. Pure functions, no DOM (tested by tools/test_sun.mjs).
   Solar position from the standard low-precision astronomical formulas (mean anomaly, ecliptic
   longitude, declination, sidereal time); good to well under 1 degree, plenty for "is this slope sunny". */
(function(root){
  'use strict';
  const rad = Math.PI / 180, DAY = 86400000, J1970 = 2440588, J2000 = 2451545, OBLIQ = 23.4397 * rad;
  const toDays = date => date.valueOf() / DAY - 0.5 + J1970 - J2000;

  function sunCoords(d){
    const M = rad * (357.5291 + 0.98560028 * d);                       // mean anomaly
    const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
    const L = M + C + rad * 102.9372 + Math.PI;                        // ecliptic longitude
    return { dec: Math.asin(Math.sin(OBLIQ) * Math.sin(L)),
             ra: Math.atan2(Math.sin(L) * Math.cos(OBLIQ), Math.cos(L)) };
  }

  /* azimuth: degrees clockwise from north; altitude: degrees above the horizon */
  function position(date, lat, lon){
    const d = toDays(date), phi = lat * rad, c = sunCoords(d);
    const H = rad * (280.16 + 360.9856235 * d) + lon * rad - c.ra;    // local hour angle
    const alt = Math.asin(Math.sin(phi) * Math.sin(c.dec) + Math.cos(phi) * Math.cos(c.dec) * Math.cos(H));
    const azS = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(c.dec) * Math.cos(phi)); // from south
    return { azimuth: ((azS / rad) + 180 + 360) % 360, altitude: alt / rad };
  }

  /* sunrise/sunset (sun centre at -0.833 deg) found by scanning the day in 1-minute steps (robust, cheap) */
  function times(date, lat, lon){
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    let rise = null, set = null, prev = position(start, lat, lon).altitude;
    for(let m = 1; m <= 1440; m++){
      const t = new Date(start.valueOf() + m * 60000), a = position(t, lat, lon).altitude;
      if(prev < -0.833 && a >= -0.833 && !rise) rise = t;
      if(prev >= -0.833 && a < -0.833) set = t;
      prev = a;
    }
    return { sunrise: rise, sunset: set };
  }

  /* How directly the sun hits a slope: > 0 lit, <= 0 in self-shadow.
     aspect: compass direction the slope faces (downhill), slope: degrees. */
  function incidence(sun, aspect, slope){
    const a = sun.altitude * rad, s = slope * rad;
    return Math.sin(a) * Math.cos(s) + Math.cos(a) * Math.sin(s) * Math.cos((sun.azimuth - aspect) * rad);
  }
  function isLit(sun, aspect, slope){
    if(sun.altitude <= 2) return false;
    if(aspect === null || !Number.isFinite(slope)) return sun.altitude > 20;   // unknown aspect: only a high sun
    return incidence(sun, aspect, slope) > 0.15;
  }

  /* Aspect/slope of a line from its two end elevations: faces the downhill direction. */
  function lineAspect(a, b, eleA, eleB){
    const kx = Math.cos(a[0] * rad) * 111320, ky = 110540;
    const dx = (b[1] - a[1]) * kx, dy = (b[0] - a[0]) * ky, len = Math.hypot(dx, dy), drop = eleA - eleB;
    if(len < 150 || Math.abs(drop) < 20) return { aspect: null, slope: null };
    const down = drop > 0 ? Math.atan2(dx, dy) : Math.atan2(-dx, -dy);      // bearing of descent
    return { aspect: ((down / rad) + 360) % 360, slope: Math.atan(Math.abs(drop) / len) / rad };
  }

  const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const compass = deg => COMPASS[Math.round(((deg % 360) + 360) % 360 / 45) % 8];

  root.FCSun = { position, times, incidence, isLit, lineAspect, compass };
})(typeof window === 'undefined' ? globalThis : window);
