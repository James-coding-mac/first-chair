# Charts and hourly summit integration — 20 November 2026

Implemented `docs/sessions/briefs/codex-integrate-charts-hourly.md`. No commit or push.

Files changed: `charts.js`, `hourly.js`, `index.html`, `sw.js`, `tools/test_charts.mjs`, `tools/test_hourly.mjs`, `docs/STATUS.md`, and this note. Existing Qwen output and brief files were left untouched.

- Extracted Qwen's modules, keeping browser IIFEs and pure string renderers with no DOM access or dependencies.
- Charts: fixed sampling exceeding 600 points; calculate/smooth speeds before sampling so long paths retain local speeds; keep first speed zero; validate coordinates, timestamps, altitude, dimensions and run intervals; reject non-increasing chart times; preserve missing-altitude line breaks through sampling; validate clock input and wrap multiple days; clamp haversine rounding; inset final time label. SVG interpolations contain numbers or fixed text/colours only.
- Hourly: guarded missing options, arrays and malformed times; old freezing-only caches show “No hourly forecast cached.”; normalised negative compass angles; numeric-check weather codes before the emoji callback; validate displayed times; require the caller's esc function (fail closed if absent), escaping every cell including callback output. No raw forecast strings enter HTML.
- Log entries with two or more path points get an accessible expand/collapse button. Runs convert milliseconds to seconds relative to t0; start clock uses Europe/Paris. Insert generated markup only after checking the `<svg` prefix.
- Weather uses the last weather point (the existing generated village/summit ordering) for the hourly table and extra request fields. Cache key/shape and existing weather validation stay compatible. A details toggle retains its open state during refresh; the compact table scrolls horizontally and uses light/dark amber/red warnings.
- SW v28 precaches both modules. No existing harness required new stubs.

Verification: all `node tools/test_*.mjs` (10 suites), `python3 tools/test_scrape_status.py`, `python3 tools/test_fetch_avalanche.py`; charts/hourly/SW and inline-script syntax; `git diff --check`. New tests cover numeric speeds, cap, invalid dt, empty/single/many points, altitude gaps, shading, sampling cap, hostile inputs, Paris labels and toggle/prefix guard; hourly time indexing, thresholds, missing arrays, escaped callback content and real weather renderer with old/new caches.

Remaining: browser/mobile visual QA and real iPhone installed-PWA/offline transition checks; live Open-Meteo request was not exercised. Claude review before commit.
