Found 11 issues, most severe first:

1. **High — lift statuses cross sectors.** [tools/scrape_status.py:474](/Users/jamesjenkins/code/first-chair/tools/scrape_status.py:474): `sector_of` keys lifts by name alone. Reproduced `LA|Arpette` becoming unknown; Les Arcs data can overwrite La Plagne’s status and closing time. **Fix:** preserve the matched sector; override ownership only for explicit cross-sector aliases.

2. **High — all-closed conditions disable closure avoidance.** [tools/scrape_status.py:236](/Users/jamesjenkins/code/first-chair/tools/scrape_status.py:236): an all-`CLOSED` feed becomes “season not open”; `statusFresh()` then disables route blocking. Reproduced both sectors returning false. **Fix:** distinguish temporary closures from explicit out-of-season evidence and retain fresh closure restrictions.

3. **High — missing steepness data looks like gentle terrain.** [steep.js:51](/Users/jamesjenkins/code/first-chair/steep.js:51): uncached offline tiles produce transparent canvases while the legend remains active. **Fix:** visibly mark unavailable coverage and display a tile-error warning.

4. **High — deadline comparisons use the phone’s timezone.** [index.html:1322](/Users/jamesjenkins/code/first-chair/index.html:1322), also line 1402: a phone left on UK time reports an extra hour before French lift closures. **Fix:** calculate current minutes explicitly in `Europe/Paris`.

5. **Medium — stale closing times produce authoritative deadlines.** [index.html:1305](/Users/jamesjenkins/code/first-chair/index.html:1305): last-lift-home uses cached closing times without `statusFresh()`, including yesterday’s offline schedule. **Fix:** suppress the definitive deadline or prominently mark stale times and their date.

6. **Medium — scheduled lifts remain routable.** [index.html:766](/Users/jamesjenkins/code/first-chair/index.html:766): only `closed` blocks an edge; a lift marked “Opening later” can appear in an immediate route. **Fix:** block `scheduled` unless routing accounts for its opening time.

7. **Medium — closing 3D during loading does not cancel opening.** [map3d.js:56](/Users/jamesjenkins/code/first-chair/map3d.js:56): close while the library downloads, and completion still creates a hidden map. Terrain failures also leave instances allocated. **Fix:** use a cancellation generation, capture each instance locally, and remove it on cancellation/error.

8. **Medium — one failed 3D download prevents retries.** [map3d.js:16](/Users/jamesjenkins/code/first-chair/map3d.js:16): the rejected `loadPromise` survives reconnection. **Fix:** clear it and failed asset elements on rejection.

9. **Medium — rotation changes the effective visible bounds.** [rotate.js:24](/Users/jamesjenkins/code/first-chair/rotate.js:24): `getSize()` reports the larger diagonal square. Route/replay fitting and popup autopanning can place content outside the clipped phone viewport, even north-up. **Fix:** account for the actual visible rectangle in fitting/autopan calculations.

10. **Medium — malformed tracked runs interrupt startup.** [index.html:2005](/Users/jamesjenkins/code/first-chair/index.html:2005): a restored `track.runs:[null]` throws during `renderLog()`, preventing later boot steps, including tracking recovery. **Fix:** validate nested stored records before rendering.

11. **Low — replay uses the wrong clock origin.** [index.html:1052](/Users/jamesjenkins/code/first-chair/index.html:1052): offsets start at the first GPS fix, but playback adds them to session ID/start, ignoring saved `track.t0`. **Fix:** use validated `track.t0`, falling back for older entries.

**No issue found** in inspected new external-text escaping, generated link schemes, friend-stat sanitisation, wallet text handling, photo-text escaping, tracking failed-save retention, or route grade exclusion.

Files changed: none. All nine existing test suites passed; targeted scraper reproductions confirmed findings 1–2. Browser/iPhone gestures and live offline transitions remain unverified.