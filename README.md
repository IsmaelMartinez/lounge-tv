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

The health checker tests channels sequentially (one at a time, mobile-friendly) using HEAD requests and HLS manifest validation. You can check visible channels, all channels, or remove dead ones in bulk. Progress is shown with a live progress bar and stats.

The built-in IPTV directory panel lets you browse 8,000+ free-to-air channels from iptv-org on demand, filterable by country (Spain, UK, USA, France, Germany, and more), category (News, Sports, Music, Entertainment), or language. Results are paginated and searchable, with preview playback in a floating mini PiP player.

You can add channels manually via URL, M3U playlist URL, or pasted M3U content.

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

See [ROADMAP.md](ROADMAP.md) for the full roadmap. Current status: Phase 1 (single-file player) complete, Phase 1.5 (webOS deployment investigation) next.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE).

## Credits

Built with [HLS.js](https://github.com/video-dev/hls.js). Channel data from [iptv-org](https://github.com/iptv-org/iptv) and [Free-TV](https://github.com/Free-TV/IPTV).
