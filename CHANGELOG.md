# Changelog

## Unreleased

- Remove unused `data/curated.json` (superseded by `data/picks.json`).
- Fix `scripts/validate.js` to scaffold `data/picks.json` instead of `curated.json` on first run.
- Documentation refresh across README, ARCHITECTURE, ROADMAP, and CHANGELOG.
- Add Phase 1.5 webOS deployment investigation doc (`docs/WEBOS-INVESTIGATION.md`) covering Developer Mode, ares-CLI packaging, Content Store trade-offs, hosted-web-app path, and a CORS test matrix.
- Add multi-protocol streaming feasibility doc (`docs/MULTI-PROTOCOL-FEASIBILITY.md`) scoring HLS/DASH/YouTube/Twitch/WebRTC/WebTorrent/Stremio against webOS browser constraints, with a proposed roadmap delta.
- Reposition the roadmap from IPTV player to universal stream player: add phases 1.6 (protocol abstraction + DASH), 1.7 (YouTube), 1.8 (Twitch), 2.5 (Stremio debrid), 3.5 (WHEP).
- Introduce a pluggable playback engine dispatcher (`ENGINES`, `inferKind`, `loadEngine`). HLS.js stays eager; dash.js lazy-loads on first `.mpd` or `kind: "dash"` channel. Channels may now set an explicit `kind` field.

## 1.1.0 (2026-04-06)

- Picks-based default list: load 44 hand-picked channels from `data/picks.json` on startup, merged with validation status from `data/channels.json`.
- Weekly GitHub Actions workflow validates streams and commits refreshed `data/channels.json`.
- "Validated" filter in the Find panel shows the full pool of recently-validated channels.
- Simplified tabs to All / Favs / Online; category filter pills now wrap.
- Split Export into separate All and Favs buttons.
- Highlight newly added channels in the sidebar.
- Switch health checker to sequential (one-at-a-time) mode for mobile friendliness.

## 1.0.0 (2026-04-04)

Initial release.

- Single-file IPTV player with HLS.js
- 25 built-in free-to-air channels (Spain, UK, France, Germany, News, Science, Music)
- IPTV directory with 8,000+ channels from iptv-org and Free-TV
- Channel management: add, remove, favourite, export as M3U
- Responsive dark theme with collapsible sidebar
- Keyboard navigation
- webOS app manifest for LG Smart TVs
- GitHub Pages deployment
