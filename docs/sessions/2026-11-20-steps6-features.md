# 20 Nov 2026: Step 6 + extra features (Claude, after Codex hit its usage limit)

**Done (all live):** 6a scraper (Lumiplan primary, 24 tests), 6b status in app (closed lifts, routing avoids closures, last-lift warnings), D (SOS + 112, season stats, share card), E (pistes skied), F (sun on slopes), resort-app research → snow depth/7-day snow, resort links, biggest descents, queue times, day replay, services layer.
**Bugs caught in browser review:** SOS button stretched across the map (fixed), header chip read a week-old snowfall after adding past_days (fixed), lift statuses could collide across sectors (keyed "<sector>|<name>").
**Blocked on James:** GitHub workflow push needs the `workflow` token scope (file is in `.github/workflows/status.yml`, uncommitted). iPhone testing. Step 7 name check. Decide on phone-motion turn analysis.
**Not feasible (documented in docs/research/resort-apps.md):** pass purchase, photo spots, social/leaderboards, 3D maps, watch/widgets, in-app avalanche API.
