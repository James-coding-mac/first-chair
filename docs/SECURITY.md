# Security checklist (risk agents check every change)

- No secrets, tokens or keys in the repo or in client JS.
- No `innerHTML` with scraped or external text; use `textContent` or sanitise.
- Content-Security-Policy meta tag; only allow-listed hosts (Open-Meteo).
- Location data stays on the device (localStorage/IndexedDB); nothing is uploaded in the MVP.
- Scraper treats resort HTML as untrusted: parse fields, never eval.
- Service worker caches only same-origin and allow-listed responses.
- Before going public: privacy policy, data-licence attribution, rate limits.
