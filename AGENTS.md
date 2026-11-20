# AGENTS.md: brief for Codex (and any other coding agent)

Read `CLAUDE.md` and `docs/STATUS.md` first. The rules below apply to you.

- The app is a single `index.html` (vanilla JS, Leaflet) + `sw.js` + `manifest.json`, served as static files on GitHub Pages. No framework, no build step.
- **Never break existing `localStorage` keys (`fc_*`).** James's ski log lives there. Any schema change needs a guarded migration.
- Work **only** on the task you were given. No unrelated refactors, no new dependencies without approval.
- **No invented data**: never type piste, lift or restaurant names from memory. Use generated files in `data/build/` or mark them `verified:false`.
- Offline first: anything new must still work, or degrade clearly, without signal.
- No secrets, no paid services, no new external hosts without approval.
- When you're done: list the files you changed, how you tested them, and any known gaps. Claude reviews before commit.
