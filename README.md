# Lounge TV

A lightweight, privacy-first, open-source IPTV player that runs as a single HTML5 file in any browser and on LG webOS Smart TVs.

No accounts. No telemetry. No app store. Just channels.

![Screenshot placeholder](docs/screenshot.png)

## Quick start

Open `index.html` in any browser. That's it.

Or try the live demo: https://ismaelmartinez.github.io/lounge-tv/

## Features

Lounge TV is a single self-contained HTML file (~50KB) with inline CSS and JS. The only external dependency is HLS.js loaded from CDN.

The player supports HLS/M3U8 live streams with a full control bar including play/pause, stop, skip, mute, volume, seek, fullscreen, and channel zapping. Controls auto-hide after 3 seconds and reappear on mouse movement.

The collapsible sidebar shows your channel list with status indicators (green for online, red for offline, orange for geo-blocked), logos, group labels, and favourite stars. Three tabs let you filter between All, Favourites, and Online channels. A scrollable group filter strip lets you narrow by category.

The health checker tests channels in parallel (10 concurrent workers) using HEAD requests and HLS manifest validation. You can check visible channels, all channels, or remove dead ones in bulk. Progress is shown with a live progress bar and stats.

The built-in IPTV directory panel lets you browse 8,000+ free-to-air channels from iptv-org, filterable by country (Spain, UK, USA, France, Germany, and more), category (News, Sports, Music, Entertainment), or language. Results are paginated and searchable, with preview playback in a floating mini PiP player.

You can add channels manually via URL, M3U playlist URL, or pasted M3U content. Channels auto-import from iptv-org and Free-TV on startup with deduplication.

Export your curated channel list as a downloadable M3U file, with smart defaults (favourites first, then online channels).

## webOS deployment

Lounge TV works on LG webOS Smart TVs. See [docs/SETUP-WEBOS.md](docs/SETUP-WEBOS.md) for deployment instructions using Developer Mode.

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| Space | Play/Pause |
| Arrow Up/Down | Navigate channel list |
| Enter | Play focused channel |
| F | Toggle favourite |
| Delete/Backspace | Remove channel |
| S | Toggle search panel |
| M | Toggle sidebar |
| Escape | Close search/modal |

## Roadmap

### Phase 1: Single-file IPTV player (current)

The player works in any browser today. 25 curated free-to-air channels load instantly, with thousands more available on demand via the IPTV directory.

### Phase 1.5: LG webOS deployment investigation

Before investing in a proxy backend, we need to validate the webOS deployment path. Key questions to answer:

- Developer Mode setup: how to enable, the 50-hour session expiry, and whether rooting is worth it for persistent installs.
- App packaging: what `ares-package` actually requires, icon sizes, manifest fields, and whether the single HTML file approach works as-is or needs a wrapper.
- LG Content Store submission: is it free? What's the review process? What are the content/quality requirements? How long does review take? Are there restrictions on IPTV-style apps?
- Sideloading vs Store: pros/cons of each path. Sideloading is simpler but expires. Store is permanent but has review overhead.
- CORS behaviour on webOS: which streams work directly on the TV's browser vs which need a proxy. This determines whether Phase 2 is a hard requirement or a nice-to-have.
- Alternative: hosted web app mode — can the TV just bookmark a URL served from a Pi on the local network, bypassing the app store entirely?

### Phase 2: Pi proxy backend for CORS-blocked streams

### Phase 3: Acestream engine bridge

### Phase 4: EPG programme guide

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE).

## Credits

Built with [HLS.js](https://github.com/video-dev/hls.js). Channel data from [iptv-org](https://github.com/iptv-org/iptv) and [Free-TV](https://github.com/Free-TV/IPTV).
