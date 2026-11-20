Write ONE browser JavaScript file named hourly.js (vanilla, no modules, no libraries, ES2019, 'use strict' in an IIFE). Output ONLY the file in a single ```js block.

It defines window.FCHourly = { table(data, opts) } returning an HTML STRING (no DOM access; must run in node).
data = an Open-Meteo forecast response containing:
  data.current.time ("YYYY-MM-DDTHH:MM"), data.hourly.time (array "YYYY-MM-DDTHH:00"), and hourly arrays (same length, any value may be null):
  temperature_2m (°C), wind_speed_10m (km/h), wind_gusts_10m (km/h), wind_direction_10m (deg), visibility (m), freezing_level_height (m), snowfall (cm), weather_code (WMO int)
opts = { hours: 12, esc: function(s) -> HTML-escaped string, emoji: function(code) -> string }

Output: a <table class="hourly"> with one row per hour starting at the current hour (match data.current.time truncated to the hour against hourly.time; if not found start at index 0), up to opts.hours rows. Columns: Time ("14:00"), weather emoji (opts.emoji(code)), Temp ("-8°"), Wind ("35 W" = speed + 8-point compass of direction), Gusts ("70"), Visibility ("2.5 km" or "<1 km" if < 1000 m, "—" if null), Freezing ("2,350 m" with thousands separator), Snow ("1.2 cm" or "" if 0/null).
- Add class "warn" to the Gusts cell when gusts >= 60 and class "bad" when >= 80 (lift closures likely). Add class "warn" to Visibility when < 1000 m.
- Header row with <th> labels: Time, (empty for emoji), °C, Wind km/h, Gusts, Vis, 0°C level, Snow.
- Every value derived from data must be numeric-checked (Number.isFinite) and rendered via String(Math.round(x)) etc.; pass the final cell text through opts.esc before inserting. Never insert raw strings from data.
- If data or data.hourly is missing or has no rows, return '<p class="muted">No hourly forecast cached.</p>'.
Also export FCHourly.compass(deg) -> "N","NE",... and FCHourly.startIndex(data) for testing.
