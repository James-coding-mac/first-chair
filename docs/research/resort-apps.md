# Resort & ski app features vs First Chair (20 Nov 2026)

Sources: Paradiski YUGE App Store listing (https://apps.apple.com/gb/app/paradiski-yuge/id488526088), Les Arcs YUGE page (https://en.lesarcs.com/paradiski-yuge), La Plagne mag "The app you really need in your pocket: Yuge" (https://en.la-plagne.com/the-mag/the-app-you-really-need-in-your-pocket-yuge), OnTheSnow "Best ski apps for 2025-26" (https://www.onthesnow.co.uk/news/best-ski-apps-for-2025-26/), Slopes App Store listing (https://apps.apple.com/app/id643351983).

YUGE is the official Paradiski app (La Plagne, Les Arcs, Peisey-Vallandry). Reviews mention crashes, unreliable tracking and no offline maps.

| Feature | Who has it | First Chair | Plan |
|---|---|---|---|
| Interactive piste map | YUGE, Slopes | ✅ offline vectors | — |
| Live lift/piste status | YUGE | ✅ Lumiplan scraper | — |
| Weather, forecast | YUGE, all | ✅ village/summit, freezing level | add snow depth + 7-day snowfall (Open-Meteo, same host) |
| Webcams | YUGE | ❌ | links to official webcam pages (no hotlinking) |
| Shuttle timetables | YUGE | ❌ | link to official pages (data is resort-published; no scraping) |
| Events programme | YUGE | ❌ | link to official pages |
| Run tracking (runs, lifts, vertical) | YUGE, Slopes | ✅ auto-split | — |
| Run/day replay | Slopes (premium) | ❌ | store thinned track with the log entry, animate on map |
| Ability-based routes/itineraries | YUGE | ✅ routing with grade filter | add "Biggest descents" list per grade |
| Shop / services finder | YUGE | ❌ | OSM ski rental, pharmacy, ATM, toilets, first aid on the map |
| Lift queue times | Lumiplan feed (`waitingDisplay`) | ❌ | capture if the feed publishes them in season |
| Lift pass purchase / reload | YUGE, Skitude | No: payments + accounts | — |
| Photo spots / downloads | YUGE | No: resort-private cameras | — |
| Friends, location sharing, leaderboards | Slopes, Skitude | No: needs a server/accounts (post-trip phase) | — |
| 3D maps | Slopes/Skitude premium | No: heavy, licensed data | — |
| Watch / widgets | Slopes | No: not possible for a PWA | — |
| Avalanche bulletin in-app | backcountry apps | Partly: link only (Météo-France API needs a key → James's approval) | — |
