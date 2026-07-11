# First Chair — ski resort companion app

## Who I am
James — engineering student, first app project. I know Whistler Blackcomb (worked a season there), Tignes–Val d'Isère, and the Three Valleys well. Treat me as a capable beginner: explain decisions, challenge weak ideas, give concrete recommendations rather than option lists, and ask clarifying questions before big changes.

## What this is
A personal ski resort companion web app. v2 is built, deployed and in use:
- Single self-contained `index.html` (no build step, no framework) + `icon.png`
- Vanilla JS, CSS in the file, data in a `RESORTS` object at the top of the script
- Multi-resort: Whistler Blackcomb (NA grades), Tignes–Val d'Isère and the Three Valleys (EU grades), chosen via a header switcher
- Real piste map (Leaflet + OpenSnowMap tiles over OpenStreetMap), recentred per resort — needs a data signal; the other tabs work offline
- Searchable/filterable run directory with per-resort favourites and notes, restaurant directory with star ratings and notes, and a day log (one timeline, entries tagged by resort)
- All user data persists in `localStorage` (keys prefixed `fc_`), namespaced per resort since v2 (migration guarded by `fc_schema`)
- Weather: current conditions + 3-day snowfall per resort (Open-Meteo, free/no key), cached for offline
- GPS: "Locate me" dot on the map, plus a Track-run session (distance/time/top speed/approx descent) you can save to the log — foreground/screen-on only
- Installable PWA with an offline app shell (service worker `sw.js` + `manifest.json`); viewed map tiles are cached so previously seen areas render offline
- Deployed via GitHub Pages; used on iPhone via Safari "Add to Home Screen"

## Design language (keep consistent)
- Lift-signage aesthetic: Barlow Condensed uppercase for headings, Inter for body
- Palette: snow `#F2F6F9`, ink navy `#16283C`, glacier blue `#3D7FB8`, Peak 2 Peak red `#C0392B`
- North American difficulty markers: ● green ■ blue ◆ black ◆◆ double black (French resorts use green/blue/red/black — handle both)
- Mobile-first, bottom tab bar, max-width 640px on desktop

## Status & next steps
Done (v2):
1. ✅ Real piste map — Leaflet + OpenSnowMap tiles over OpenStreetMap, recentred per resort. (The old tappable-lift queue-time notes were dropped in the process, by decision.)
2. ✅ Multi-resort — Whistler Blackcomb, Tignes–Val d'Isère, Three Valleys with a header switcher. The French run/restaurant lists were seeded from memory and still need checking/extending against the official maps — same "written from memory" caveat as the WB starter data.
4. ✅ localStorage export/restore — Backup card at the bottom of the Log tab (exports every `fc_` key to a JSON file, restores with guards).

Done (v3):
5. ✅ Installable offline PWA — `manifest.json` + `sw.js` (precache shell, network-first navigation, capped tile cache).
6. ✅ Weather + 3-day snowfall per resort via Open-Meteo, cached in `fc_weather` for offline.
7. ✅ GPS locate + run tracking (distance/time/top speed/approx descent) → save summary to the log.

Still open:
3. Deploy stays GitHub Pages — static files only, no server, no accounts. Data stays local to the device for now (multi-user/sync is a possible future phase).
- French run/restaurant data still needs James's review against the official maps.

## Deploy / workflow
- Repo: https://github.com/james-coding-mac/first-chair (public). Working copy lives at `~/Downloads/Skiing App`.
- Loop: edit `index.html` on the Mac → `git push` → GitHub Pages rebuilds → refresh on iPhone. Live at https://james-coding-mac.github.io/first-chair/
- Auth is HTTPS + a Personal Access Token in the macOS keychain (set up once). Push from a real interactive Terminal, not an automated shell.
- Pages serves branch `main`, folder `/ (root)`.

## Hard constraints
- Must remain deployable as static files on GitHub Pages
- No copyrighted piste map artwork in the public repo
- Don't break existing localStorage keys without migrating them — my logged data lives there
- Test locally before every push
