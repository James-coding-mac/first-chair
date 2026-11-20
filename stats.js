/* Season stats and the shareable day card. Pure functions: no DOM, network or storage,
   so they can be tested in node (tools/test_stats.mjs). */
(function(root){
  'use strict';
  const num = v => (typeof v === 'number' && Number.isFinite(v)) ? v : null;

  /* entries: fc_log entries; resort filter: id or null for all */
  function seasonStats(entries, resort){
    const list = (Array.isArray(entries) ? entries : []).filter(e => e && typeof e === 'object' && (!resort || e.resort === resort));
    const days = new Set(), perResort = {};
    const s = { days: 0, perResort, trackedDays: 0, runs: 0, vertical: 0, distance: 0, topSpeed: 0,
                bestDay: null, liftRides: 0 };
    for(const e of list){
      const day = typeof e.date === 'string' ? e.date : null;
      if(day) days.add(day + '|' + (e.resort || ''));
      perResort[e.resort || '?'] = (perResort[e.resort || '?'] || 0) + 1;
      const t = e.track && e.track.totals;
      if(!t) continue;
      s.trackedDays++;
      s.runs += num(t.runs) || 0;
      s.liftRides += num(t.liftRides) || 0;
      s.distance += num(t.distance) || 0;
      s.topSpeed = Math.max(s.topSpeed, num(t.topSpeed) || 0);
      const v = num(t.vertical);
      if(v !== null){
        s.vertical += v;
        if(!s.bestDay || v > s.bestDay.vertical) s.bestDay = { date: day, resort: e.resort || null, vertical: v };
      }
    }
    s.days = days.size;
    return s;
  }

  /* data: {title, resort, date, vertical, runs, distance (m), topSpeed (km/h), liftRides, profile:[alt...]}
     Draws a 1080x1350 card. No user notes, no map tiles (privacy; tainted canvas). */
  function drawDayCard(ctx, data){
    const W = 1080, H = 1350, d = data || {};
    const navy = '#16283C', glacier = '#3D7FB8', red = '#C0392B', snow = '#F2F6F9';
    const fmt = (v, digits) => (num(v) === null ? '—' : Number(v).toFixed(digits || 0));
    ctx.fillStyle = navy; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = red; ctx.fillRect(0, 0, W, 14);
    ctx.fillStyle = snow; ctx.textBaseline = 'alphabetic';
    ctx.font = '700 64px "Barlow Condensed", sans-serif';
    ctx.fillText('FIRST CHAIR', 80, 150);
    ctx.font = '600 40px "Barlow Condensed", sans-serif';
    ctx.fillStyle = '#9DB0C3';
    ctx.fillText(String(d.resort || '').toUpperCase().slice(0, 40), 80, 215);
    ctx.fillText(String(d.date || '').slice(0, 40), 80, 265);
    ctx.fillStyle = snow;
    ctx.font = '700 260px "Barlow Condensed", sans-serif';
    ctx.fillText(fmt(d.vertical), 80, 560);
    ctx.font = '600 48px "Barlow Condensed", sans-serif';
    ctx.fillStyle = glacier;
    ctx.fillText('METRES SKIED VERTICAL', 86, 630);
    const cells = [['RUNS', fmt(d.runs)], ['KM SKIED', fmt(num(d.distance) === null ? null : d.distance / 1000, 1)],
                   ['TOP KM/H', fmt(d.topSpeed)], ['LIFTS', fmt(d.liftRides)]];
    cells.forEach(([label, value], i) => {
      const x = 80 + (i % 2) * 470, y = 760 + Math.floor(i / 2) * 200;
      ctx.fillStyle = snow; ctx.font = '700 110px "Barlow Condensed", sans-serif'; ctx.fillText(value, x, y);
      ctx.fillStyle = '#9DB0C3'; ctx.font = '600 36px "Barlow Condensed", sans-serif'; ctx.fillText(label, x + 4, y + 50);
    });
    const prof = (Array.isArray(d.profile) ? d.profile : []).filter(v => num(v) !== null);
    if(prof.length > 1){
      const lo = Math.min(...prof), hi = Math.max(...prof), span = hi - lo || 1;
      const x0 = 80, x1 = W - 80, y0 = 1230, h = 120;
      ctx.beginPath();
      prof.forEach((v, i) => {
        const x = x0 + (x1 - x0) * i / (prof.length - 1), y = y0 - h * (v - lo) / span;
        if(i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      });
      ctx.strokeStyle = glacier; ctx.lineWidth = 6; ctx.stroke();
    }
    ctx.fillStyle = '#9DB0C3'; ctx.font = '500 28px Inter, sans-serif';
    ctx.fillText('Tracked with First Chair · GPS estimates', 80, H - 50);
  }

  root.FCStats = { seasonStats, drawDayCard };
})(typeof window === 'undefined' ? globalThis : window);
