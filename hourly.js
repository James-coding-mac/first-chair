(function() {
  'use strict';

  const FCHourly = {};

  FCHourly.compass = function(deg) {
    if (!Number.isFinite(deg)) return '';
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return dirs[Math.round(((deg % 360 + 360) % 360) / 45) % 8];
  };

  FCHourly.startIndex = function(data) {
    if (!data || !data.current || !data.hourly || !Array.isArray(data.hourly.time) || typeof data.current.time !== "string") return 0;
    const target = data.current.time.slice(0, 13);
    const idx = data.hourly.time.findIndex(function(t) { return typeof t === "string" && t === target + ":00"; });
    return idx === -1 ? 0 : idx;
  };

  FCHourly.table = function(data, opts = {}) {
    opts = opts || {};
    if (!data || !data.hourly || !Array.isArray(data.hourly.time) || data.hourly.time.length === 0 || !Array.isArray(data.hourly.temperature_2m)) {
      return '<p class="muted">No hourly forecast cached.</p>';
    }

    const h = Number.isFinite(opts.hours) ? Math.max(0, Math.floor(opts.hours)) : 12;
    // Escaping is supplied by the caller; fail closed without it.
    if (typeof opts.esc !== 'function') return '<p class="muted">No hourly forecast cached.</p>';
    const esc = opts.esc;
    const emojiFn = opts.emoji || function() { return ''; };
    const start = FCHourly.startIndex(data);
    const times = data.hourly.time;
    const temps = Array.isArray(data.hourly.temperature_2m) ? data.hourly.temperature_2m : [];
    const winds = Array.isArray(data.hourly.wind_speed_10m) ? data.hourly.wind_speed_10m : [];
    const gusts = Array.isArray(data.hourly.wind_gusts_10m) ? data.hourly.wind_gusts_10m : [];
    const dirs = Array.isArray(data.hourly.wind_direction_10m) ? data.hourly.wind_direction_10m : [];
    const vis = Array.isArray(data.hourly.visibility) ? data.hourly.visibility : [];
    const freeze = Array.isArray(data.hourly.freezing_level_height) ? data.hourly.freezing_level_height : [];
    const snow = Array.isArray(data.hourly.snowfall) ? data.hourly.snowfall : [];
    const codes = Array.isArray(data.hourly.weather_code) ? data.hourly.weather_code : [];

    let html = '<table class="hourly"><thead><tr><th>Time</th><th></th><th>°C</th><th>Wind km/h</th><th>Gusts</th><th>Vis</th><th>0°C level</th><th>Snow</th></tr></thead><tbody>';

    for (let i = 0; i < h; i++) {
      const idx = start + i;
      if (idx >= times.length) break;

      const t = typeof times[idx] === "string" && /^\d{4}-\d{2}-\d{2}T[0-2]\d:[0-5]\d$/.test(times[idx]) ? times[idx].slice(11, 16) : "—";
      const code = Number.isFinite(codes[idx]) ? codes[idx] : null;
      const temp = Number.isFinite(temps[idx]) ? temps[idx] : null;
      const wind = Number.isFinite(winds[idx]) ? winds[idx] : null;
      const gust = Number.isFinite(gusts[idx]) ? gusts[idx] : null;
      const dir = Number.isFinite(dirs[idx]) ? dirs[idx] : null;
      const v = Number.isFinite(vis[idx]) ? vis[idx] : null;
      const frz = Number.isFinite(freeze[idx]) ? freeze[idx] : null;
      const snw = Number.isFinite(snow[idx]) ? snow[idx] : null;

      const cellTime = esc(t);
      const cellEmoji = esc(code === null ? '—' : String(emojiFn(code) || ''));
      const cellTemp = temp !== null ? esc(String(Math.round(temp)) + '°') : esc('\u2014');
      const windStr = (wind !== null && dir !== null) ? String(Math.round(wind)) + ' ' + FCHourly.compass(dir) : '\u2014';
      const cellWind = esc(windStr);

      const gustStr = gust !== null ? String(Math.round(gust)) : '\u2014';
      const gustClass = gust !== null && gust >= 80 ? 'bad' : (gust !== null && gust >= 60 ? 'warn' : '');
      const cellGusts = '<td class="' + gustClass + '">' + esc(gustStr) + '</td>';

      let visStr = '\u2014';
      let visClass = '';
      if (v !== null) {
        if (v < 1000) {
          visStr = '<1 km';
          visClass = 'warn';
        } else {
          visStr = (v / 1000).toFixed(1) + ' km';
        }
      }
      const cellVis = '<td class="' + visClass + '">' + esc(visStr) + '</td>';

      const frzStr = frz !== null ? String(Math.round(frz)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' m' : '\u2014';
      const cellFreeze = esc(frzStr);

      const snwStr = (snw !== null && snw > 0) ? snw.toFixed(1) + ' cm' : '';
      const cellSnow = esc(snwStr);

      html += '<tr><td>' + cellTime + '</td><td>' + cellEmoji + '</td><td>' + cellTemp + '</td><td>' + cellWind + '</td>' + cellGusts + cellVis + '<td>' + cellFreeze + '</td><td>' + cellSnow + '</td></tr>';
    }

    html += '</tbody></table>';
    return html;
  };

  window.FCHourly = FCHourly;
})();
