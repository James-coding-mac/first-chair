(function() {
  'use strict';

  function haversine(p1, p2) {
    const R = 6371000;
    const dLat = (p2[0] - p1[0]) * Math.PI / 180;
    const dLon = (p2[1] - p1[1]) * Math.PI / 180;
    const a = Math.min(1, Math.max(0, Math.sin(dLat / 2) ** 2 + Math.cos(p1[0] * Math.PI / 180) * Math.cos(p2[0] * Math.PI / 180) * Math.sin(dLon / 2) ** 2));
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function usable(p) {
    return Array.isArray(p) && [p[0], p[1], p[3]].every(Number.isFinite) && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180;
  }

  function computeRawSpeeds(path) {
    const n = path.length;
    const speeds = new Array(n).fill(0);
    for (let i = 1; i < n; i++) {
      if (!usable(path[i]) || !usable(path[i - 1])) continue;
      const dt = path[i][3] - path[i - 1][3];
      if (dt <= 0) { speeds[i] = 0; continue; }
      const dist = haversine(path[i - 1], path[i]);
      let s = (dist / dt) * 3.6;
      if (s > 130) s = 130;
      speeds[i] = s;
    }
    return speeds;
  }

  function smooth5(arr) {
    const n = arr.length;
    const out = new Array(n);
    for (let i = 0; i < n; i++) {
      let sum = 0, count = 0;
      for (let j = Math.max(0, i - 2); j <= Math.min(n - 1, i + 2); j++) {
        sum += arr[j];
        count++;
      }
      out[i] = sum / count;
    }
    return out;
  }

  function downsample(arr, maxPts) {
    if (arr.length <= maxPts) return arr;
    const out = [];
    for (let i = 0; i < maxPts; i++) out.push(arr[Math.round(i * (arr.length - 1) / (maxPts - 1))]);
    return out;
  }

  function formatTime(t, startClock) {
    if (typeof startClock === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(startClock)) {
      const [h, m] = startClock.split(':').map(Number);
      let totalSec = h * 3600 + m * 60 + t;
      totalSec = ((totalSec % 86400) + 86400) % 86400;
      const hh = Math.floor(totalSec / 3600);
      const mm = Math.floor((totalSec % 3600) / 60);
      return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    }
    const hh = Math.floor(t / 3600);
    const mm = Math.floor((t % 3600) / 60);
    return `${hh}:${String(mm).padStart(2, '0')}`;
  }

  function dayChart(path, opts = {}) {
    opts = opts || {};
    const W = Number.isFinite(opts.width) ? Math.min(4096, Math.max(200, opts.width)) : 640;
    const H = Number.isFinite(opts.height) ? Math.min(4096, Math.max(160, opts.height)) : 220;
    const runs = Array.isArray(opts.runs) ? opts.runs : [];
    path = (Array.isArray(path) ? path : []).filter(usable);
    let lastTime = -Infinity;
    path = path.filter(p => {
      if (p[3] <= lastTime) return false;
      lastTime = p[3];
      return true;
    });
    const startClock = opts.startClock || null;
    const dark = opts.dark || false;

    if (!path || path.length < 2) {
      const textColor = dark ? '#9DB0C3' : '#4C6076';
      return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Speed and altitude" xmlns="http://www.w3.org/2000/svg"><text x="${(W / 2).toFixed(1)}" y="${(H / 2).toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-family="Inter, sans-serif" font-size="14" fill="${textColor}">Not enough GPS data for a graph</text></svg>`;
    }

    // Calculate speeds at the original resolution; sample only for rendering.
    const allSpeeds = speeds(path);
    const indices = downsample(path.map((_, i) => i), 600);
    const dsPath = indices.map(i => path[i]);
    const chartSpeeds = indices.map(i => allSpeeds[i]);

    const alts = dsPath.map(p => p[2]).filter(Number.isFinite);
    let altMin, altMax;
    if (alts.length === 0) {
      altMin = 0; altMax = 10;
    } else {
      altMin = Math.min(...alts);
      altMax = Math.max(...alts);
      if (altMin === altMax) { altMin -= 5; altMax += 5; }
      else {
        const pad = (altMax - altMin) * 0.05;
        altMin -= pad; altMax += pad;
      }
    }

    const maxSpeed = Math.max(...chartSpeeds);
    const speedMax = Math.ceil(Math.max(20, maxSpeed) / 10) * 10;

    const marginLeft = 40;
    const marginBottom = 18;
    const usableH = H - marginBottom;
    const panelH = usableH * 0.45;
    const gap = (usableH - 2 * panelH) / 3;
    const yAltTop = gap;
    const yAltBot = yAltTop + panelH;
    const ySpeedTop = yAltBot + gap;
    const ySpeedBot = ySpeedTop + panelH;
    const plotW = W - marginLeft - 18;

    const tMin = dsPath[0][3];
    const tMax = dsPath[dsPath.length - 1][3];
    const tRange = tMax - tMin || 1;

    const mapX = t => marginLeft + (t - tMin) / tRange * plotW;
    const mapYAlt = v => yAltBot - (v - altMin) / (altMax - altMin) * panelH;
    const mapYSpeed = v => ySpeedBot - v / speedMax * panelH;

    let altD = '';
    let altStarted = false;
    for (let i = 0; i < dsPath.length; i++) {
      const t = dsPath[i][3];
      const alt = dsPath[i][2];
      const x = mapX(t);
      if (!Number.isFinite(alt)) { altStarted = false; continue; }
      const y = mapYAlt(alt);
      if (!altStarted) { altD += `M${x.toFixed(1)} ${y.toFixed(1)}`; altStarted = true; }
      else if (path.slice(indices[i - 1] + 1, indices[i]).some(p => !Number.isFinite(p[2]))) { altD += ` M${x.toFixed(1)} ${y.toFixed(1)}`; }
      else { altD += ` L${x.toFixed(1)} ${y.toFixed(1)}`; }
    }

    let speedLineD = '';
    let speedAreaD = '';
    for (let i = 0; i < dsPath.length; i++) {
      const x = mapX(dsPath[i][3]);
      const y = mapYSpeed(chartSpeeds[i]);
      if (i === 0) {
        speedLineD += `M${x.toFixed(1)} ${y.toFixed(1)}`;
        speedAreaD += `M${x.toFixed(1)} ${ySpeedBot.toFixed(1)} L${x.toFixed(1)} ${y.toFixed(1)}`;
      } else {
        speedLineD += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
        speedAreaD += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
      }
    }
    speedAreaD += ` L${mapX(dsPath[dsPath.length - 1][3]).toFixed(1)} ${ySpeedBot.toFixed(1)} Z`;

    let runsSVG = '';
    for (const run of runs) {
      if (!Array.isArray(run) || !Number.isFinite(run[0]) || !Number.isFinite(run[1])) continue;
      const [s, e] = run;
      let x1 = mapX(s);
      let x2 = mapX(e);
      x1 = Math.max(marginLeft, Math.min(W, x1));
      x2 = Math.max(marginLeft, Math.min(W, x2));
      if (x2 > x1) {
        runsSVG += `<rect x="${x1.toFixed(1)}" y="${yAltTop.toFixed(1)}" width="${(x2 - x1).toFixed(1)}" height="${(ySpeedBot - yAltTop).toFixed(1)}" fill="#3D7FB8" fill-opacity="0.10"/>`;
      }
    }

    const textColor = dark ? '#9DB0C3' : '#4C6076';
    const altColor = dark ? '#E8EEF4' : '#16283C';
    const speedColor = '#C0392B';

    let yLabels = '';
    const altTicks = [altMin, (altMin + altMax) / 2, altMax];
    for (const v of altTicks) {
      const y = mapYAlt(v);
      yLabels += `<text x="${(marginLeft - 5).toFixed(1)}" y="${y.toFixed(1)}" text-anchor="end" dominant-baseline="middle" font-family="Inter, sans-serif" font-size="10" fill="${textColor}">${v.toFixed(1)}</text>`;
    }
    const speedTicks = [0, speedMax / 2, speedMax];
    for (const v of speedTicks) {
      const y = mapYSpeed(v);
      yLabels += `<text x="${(marginLeft - 5).toFixed(1)}" y="${y.toFixed(1)}" text-anchor="end" dominant-baseline="middle" font-family="Inter, sans-serif" font-size="10" fill="${textColor}">${v.toFixed(1)}</text>`;
    }

    let xLabels = '';
    for (let i = 0; i < 6; i++) {
      const t = tMin + i * tRange / 5;
      const x = mapX(t);
      const label = formatTime(t, startClock);
      xLabels += `<text x="${x.toFixed(1)}" y="${(ySpeedBot + 14).toFixed(1)}" text-anchor="middle" font-family="Inter, sans-serif" font-size="10" fill="${textColor}">${label}</text>`;
    }

    const titles = `<text x="${marginLeft.toFixed(1)}" y="${(yAltTop + 12).toFixed(1)}" font-family="Inter, sans-serif" font-size="9" letter-spacing="1" fill="${textColor}">ALTITUDE m</text>` +
      `<text x="${marginLeft.toFixed(1)}" y="${(ySpeedTop + 12).toFixed(1)}" font-family="Inter, sans-serif" font-size="9" letter-spacing="1" fill="${textColor}">SPEED km/h</text>`;

    return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Speed and altitude" xmlns="http://www.w3.org/2000/svg">` +
      runsSVG +
      `<path d="${speedAreaD}" fill="${speedColor}" fill-opacity="0.12"/>` +
      `<path d="${speedLineD}" fill="none" stroke="${speedColor}" stroke-width="1.5"/>` +
      `<path d="${altD}" fill="none" stroke="${altColor}" stroke-width="1.5"/>` +
      yLabels + xLabels + titles +
      `</svg>`;
  }

  function speeds(path) {
    if (!Array.isArray(path) || path.length === 0) return [];
    const raw = computeRawSpeeds(path);
    const result = smooth5(raw);
    result[0] = 0;
    return result;
  }

  window.FCCharts = { dayChart, speeds };
})();
