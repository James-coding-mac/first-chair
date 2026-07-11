# First Chair — ski resort companion app

## Who I am
James — engineering student, first app project. I know Whistler Blackcomb (worked a season there), Tignes–Val d'Isère, and the Three Valleys well. Treat me as a capable beginner: explain decisions, challenge weak ideas, give concrete recommendations rather than option lists, and ask clarifying questions before big changes.

## What this is
A personal ski resort companion web app. v1 is built and working:
- Single self-contained `index.html` (no build step, no framework) + `icon.png`
- Vanilla JS, CSS in the file, data in plain JS arrays at the top of the script
- Features: stylised tappable SVG map of Whistler Blackcomb (lifts with queue-time notes), searchable/filterable run directory with favourites and personal notes, restaurant directory with star ratings and notes, and a day log
- All user data persists in `localStorage` (keys prefixed `fc_`)
- Deployed via GitHub Pages; used on iPhone via Safari "Add to Home Screen"

## Design language (keep consistent)
- Lift-signage aesthetic: Barlow Condensed uppercase for headings, Inter for body
- Palette: snow `#F2F6F9`, ink navy `#16283C`, glacier blue `#3D7FB8`, Peak 2 Peak red `#C0392B`
- North American difficulty markers: ● green ■ blue ◆ black ◆◆ double black (French resorts use green/blue/red/black — handle both)
- Mobile-first, bottom tab bar, max-width 640px on desktop

## Agreed next steps (v2)
1. Replace the hand-drawn SVG map with a real piste map. Preferred approach: Leaflet + OpenSnowMap overlay tiles (openstreetmap-based, shows actual pistes/lifts, free and legal). Do NOT copy official resort piste map artwork — it's copyrighted.
2. Multi-resort support: add Tignes–Val d'Isère (Espace Killy) and the Three Valleys alongside Whistler Blackcomb, with a resort switcher. Curated run/restaurant lists stay per-resort; James will correct and extend them since he knows the mountains.
3. Keep the deploy target GitHub Pages — static files only, no server, no accounts. Data stays local to the device for now (multi-user/sync is a possible future phase).
4. Consider a localStorage export/backup button once data matters.

## Hard constraints
- Must remain deployable as static files on GitHub Pages
- No copyrighted piste map artwork in the public repo
- Don't break existing localStorage keys without migrating them — my logged data lives there
- Test locally before every push
