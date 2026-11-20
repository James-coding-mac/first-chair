# 20 Nov 2026: Step 1, add Paradiski

**Done**
- `tools/fetch_paradiski.sh`: query now also gets village/hamlet places, `landuse=winter_sports` ski-area outlines and anything named Bellecôte; three rounds over three Overpass servers (they returned 502/HTML errors twice today).
- `tools/build_paradiski.py` (new): ski-area outlines decide sector (La Plagne / Les Arcs–Peisey) and drop Tignes, La Rosière, Ste-Foy; piste segments grouped by name + proximity (400 m); grades novice/easy/intermediate/advanced/expert → green/blue/red/black/black (confirmed by the pistes that carry a `colour` tag); freeride/extreme/backcountry → off-piste. Restaurants kept only if within 300 m of a piste/lift; "village" = within 350 m of a village point, or has a street address and is within 1 km. Names made unique (they key favourites/notes).
- `index.html`: loads `data/build/paradiski.js`; `DIFF.eu_off` adds an Off-piste grade; UNVERIFIED tag on records with `verified:false`; off-piste warning + BERA link; per-resort data note; lift line hidden when empty.
- `sw.js`: VERSION v2, precaches the data file; tile cache name pinned to `fc-tiles-v1` so app updates no longer wipe viewed tiles.

**Tested** (local server + Chrome): seeded v3-shaped `fc_` data was byte-identical after load; Paradiski in switcher; 293 runs / 214 eats render; favourites go to a new `pdk` bucket; Whistler unchanged (26 runs, old note, no tags); off-piste filter = 30 rows; SW active with data precached; no console errors. Not yet tested on the iPhone.

**Review (checker + security sub-agents): both PASS WITH FIXES. Fixed:**
- Names that are `Object.prototype` members (`__proto__` etc.) get " (OSM)" appended (they key notes).
- Same-named restaurants <50 m apart merged (Araucaria, La Zaccota, Labuche were each mapped twice) → 211 eats.
- `Grid.nearest` only searched ~500 m whatever the radius; now searches the full radius → zone labels on 286/293 runs (was 122).
- Builder writes with `errors="replace"` (broken OSM characters no longer crash it) and warns when a rebuild drops names.
- Eat tab shows the OSM/ODbL credit with a link; Leaflet/fonts cache name fixed (`fc-runtime-v1`) like tiles.
- Not fixed (pre-existing, logged for later): no CSP meta tag yet (SECURITY.md), SW caches responses without checking `res.ok`.
- Retested in Chrome after the fixes: same checks pass. Not done: browser test of the v1→v2 SW upgrade (checker traced it in code).

**Not done / next**
- James: check on the iPhone (reopen the app twice so the new service worker takes over).
- 94 restaurants carry a public phone number and 58 a website from OSM (no emails).
- Step 2: offline vector map from bundled GeoJSON.
