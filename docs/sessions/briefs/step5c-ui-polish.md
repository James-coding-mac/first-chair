# Brief for Codex: Step 5c, premium UI ("polished lift-signage")

Read first: CLAUDE.md (Design language), AGENTS.md, docs/DECISIONS.md → UI. This is a **visual/layout** pass on `index.html` (CSS + markup + small render-template changes). **No behaviour changes**: every feature, id the JS relies on, localStorage key, and event must keep working. Don't touch track.js, route.js, the data files, tools/scrape_status.py, .github/, tests/fixtures/. Another agent is creating the scraper files right now.

## Direction
Keep the identity — Barlow Condensed uppercase headings, Inter body, navy `#16283C`, glacier `#3D7FB8`, Peak 2 Peak red `#C0392B`, snow `#F2F6F9`, difficulty symbols ● ■ ◆ ◆◆ — but make it feel like a premium iOS app (think Apple Weather / Slopes level of finish).

## Design system (define as CSS custom properties, then use them everywhere)
- Spacing scale 4/8/12/16/24/32; radius 12 (controls) / 18 (cards) / 999 (pills).
- Surfaces: `--bg` snow, `--card` white, `--card-2` #F7FAFC, hairline borders `rgba(22,40,60,.08)`, shadow `0 1px 2px rgba(22,40,60,.06), 0 8px 24px rgba(22,40,60,.06)`.
- Type scale: display 34/38 Barlow 700; title 22 Barlow 700 uppercase letter-spacing .04em; section label 12 Barlow 600 uppercase .12em in `--ink-2`; body 15/22 Inter; meta 13 Inter `--ink-2`; big numbers use `font-variant-numeric: tabular-nums`.
- **Dark mode** via `@media (prefers-color-scheme: dark)`: bg #0B1622, card #12202F, card-2 #182A3C, ink #E8EEF4, ink-2 #9DB0C3, borders rgba(255,255,255,.08); keep grade colours legible (black grade = #E8EEF4 outline style in dark). Leaflet controls/popups themed too. Also set `<meta name="theme-color">` for both schemes.

## Components
- **Header**: sticky, navy (stays navy in dark), safe-area aware; "FIRST CHAIR" wordmark left; resort switcher restyled as a pill button with chevron (keep the native `<select>` underneath for accessibility; style it, don't replace its logic); a compact live condition chip on the right (current village temp + today's snow if weather is cached — read from the existing weather caches; hide if none).
- **Bottom tab bar**: frosted (`backdrop-filter: blur(20px)`, translucent bg), safe-area padding, **inline SVG icons** (simple 24px stroke icons you draw: map, runs (mountain/slope), eat (fork+knife), log (notebook)) replacing emoji; active tab in glacier blue with label; 44px min touch targets.
- **Map tab**: map becomes the hero — taller (`min(62vh, 560px)`), rounded 18, edge-to-edge on phones (16px gutter); Locate / Track buttons become **floating pill buttons overlaid on the bottom of the map** (keep the same ids/handlers; move the elements); the Route-to search + filter chips become a clean card with a proper search field (icon, 44px, rounded 12) and segmented pills.
- **Weather card**: large-number layout — village/summit temps 40px tabular, labels as section labels, wind/gust/freezing as small icon rows (inline SVG or simple glyphs, no emoji in the main numbers), 3-day forecast as a tidy row; keep the emoji weather icons only in the small forecast cells (or replace with simple SVGs if quick).
- **Lists (runs/eats/log)**: cards become inset grouped lists (iOS settings style): one card per group, rows separated by hairlines, 52px min row height, chevron/expand affordance; difficulty markers as coloured badges (filled circle/square/diamond, double diamond) with the grade colour; UNVERIFIED tag smaller and subtler (amber outline pill); star rating and favourite with proper tap targets; expanded row body animates (max-height/opacity transition ≤ 200 ms; respect `prefers-reduced-motion`).
- **Chips/filters**: horizontally scrollable pill row with no visible scrollbar; selected = navy (glacier in dark) filled.
- **Buttons**: primary = glacier blue filled, 48px, radius 12, Barlow uppercase; secondary = card-2 with hairline; destructive text in red.
- **Tracker card / route step list / log entries**: consistent cards; route steps as a vertical timeline (small grade/lift icon in a dot, line between steps, time right-aligned tabular).
- Empty states: short friendly line, muted.
- Overall: max-width 640 px centred on desktop; 16 px side gutter; no horizontal scroll at 360 px width.

## Accessibility & performance
Contrast ≥ 4.5:1 for text; focus-visible rings; no new fonts or external hosts (Barlow/Inter already loaded); no images (inline SVG only); keep the page light.

## sw.js
Bump VERSION to v7.

## Done when
`node --check` on sw.js and the main inline script; existing tests still pass (`node tools/test_tracking.mjs`, `node tools/test_route_js.mjs`); you've checked there are no references to removed ids. Do NOT commit/push. Finish with a summary of changes, anything you couldn't do, and a list of ids/classes you renamed (should be none for JS-used ones).
