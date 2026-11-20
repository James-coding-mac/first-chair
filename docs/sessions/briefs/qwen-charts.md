Write ONE browser JavaScript file named charts.js (vanilla, no modules, no libraries, ES2019, 'use strict' inside an IIFE). Output ONLY the file in a single ```js block.

It defines window.FCCharts = { dayChart(path, opts) } returning an SVG markup STRING (no DOM access, so it can run in node).

Input:
- path: array of points [lat, lon, alt|null, t] where t = seconds since the start of the day's tracking (increasing). Points are >= ~15 m apart. May be empty or have 1 point.
- opts: { width: 640, height: 220, runs: [[startSec, endSec], ...] (optional; shade these intervals light blue #3D7FB8 at 0.10 opacity), startClock: "09:12" (optional label for t=0), dark: false }

Output: an SVG string with viewBox "0 0 width height", width="100%", role="img", aria-label="Speed and altitude".
- Two stacked panels sharing the time axis: top = altitude (m), bottom = speed (km/h). Each panel ~45% of height with small gaps; left margin 40 px for y labels, bottom margin 18 px for x labels.
- Altitude: line #16283C (dark mode: #E8EEF4), stroke-width 1.5; skip null altitudes (break the line). Y range = min..max of altitudes, padded 5%.
- Speed: computed between consecutive points: haversine distance / dt * 3.6, ignore dt <= 0, cap at 130 km/h; smooth with a centred 5-point moving average; line #C0392B stroke-width 1.5; area fill #C0392B opacity 0.12 under it. Y range 0..max(20, maxSpeed) rounded up to a multiple of 10.
- Y labels: 3 ticks per panel (min, mid, max) as text, font-size 10, fill #4C6076 (dark: #9DB0C3), font-family Inter, sans-serif. Panel titles "ALTITUDE m" and "SPEED km/h" at top-left of each panel, font-size 9, letter-spacing 1.
- X labels: up to 6 evenly spaced ticks as elapsed "h:mm" (or clock time if startClock given: add elapsed to it, wrap at 24h).
- Downsample to at most 600 points (keep first/last) before drawing, for speed.
- All numbers rounded to 1 decimal in the SVG. No external fonts, no scripts, no event handlers, no user text in the SVG except numbers and the fixed titles.
- If fewer than 2 usable points: return an SVG with a centred text "Not enough GPS data for a graph".
Include a small exported helper FCCharts.speeds(path) -> array of km/h (same length as path, first = 0) so it can be tested.
