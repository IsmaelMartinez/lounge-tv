# Architecture

Lounge TV is a single self-contained HTML file with inline CSS and JavaScript. There is no build step, no bundler, and no framework.

## Stack

HLS.js (loaded eagerly from cdnjs) provides HLS playback via Media Source Extensions. Additional engines are lazy-loaded on first use: dash.js for MPEG-DASH streams. Fonts (DM Sans and Space Mono) come from Google Fonts.

## Playback engine dispatcher

`playStream(name, url, group, kind)` routes to one of the engines registered in `ENGINES`: `hls` (HLS.js), `dash` (dash.js, lazy-loaded), or `native` (plain `<video src>` for MP4/WebM or Safari's built-in HLS). `inferKind(url)` picks a default from the URL extension (`.m3u8` → hls, `.mpd` → dash, `.mp4`/`.webm`/`.ogg` → native). Channels may set an explicit `kind` field in `picks.json` / `channels.json` to override inference. Each engine exposes a uniform `attach(video, url, opts, { onReady, onError })` returning a `{ destroy }` handle stored on `S.engine` (main player) or `S.engineP` (PiP). Adding a new protocol is a single entry in `ENGINES` plus an `inferKind` rule.

## Structure

The HTML file is organised into three sections: the style block containing all CSS, the markup for the UI components (sidebar, player, controls, search panel, modal, PiP preview, toast), and the script block containing all application logic.

## State management

All application state lives in a single `S` object. Channels are stored as an array of objects with id, name, group, url, logo, and status fields. Favourites are persisted to localStorage under the key `lounge-tv-favs`. There is no backend.

## Channel data

Two JSON files in `data/` drive the default channel list and discovery pool:

- `data/picks.json` — a hand-edited list of curated channel URLs (the default view on startup).
- `data/channels.json` — the full set of channels tested by the weekly validation run, each annotated with `status` (`ok`, `geo`, `fail`) and `lastChecked`.

On startup, `init()` fetches both files. Picks are merged with the richer metadata from `channels.json` (name, group, logo, latest status) and shown as the default channel list. If either fetch fails, the app falls back to the small `BUILT` array baked into `index.html`. The Find panel exposes `channels.json` as a "Validated" filter for discovering new picks.

## Offline validation

`scripts/validate.js` runs in Node. It fetches a configured set of iptv-org M3U playlists (UK, News, Music, Entertainment, Sports, Documentary, Kids) plus the Free-TV playlist, deduplicates by URL, then tests each stream by fetching the manifest and the first segment. Results are written to `data/channels.json` with a status per channel. On first run only, it scaffolds `data/picks.json` with the first 50 `ok` channels as a starting point for curation. A weekly GitHub Actions workflow (`.github/workflows/validate.yml`) runs the script and commits refreshed `channels.json`.

## In-app health checking

The in-app health checker tests stream URLs sequentially (one at a time) to keep mobile memory and battery use low. Each test sends a HEAD request to detect HTTP errors and geo-blocks (403/410/451), then attempts to load the HLS manifest with a 6-second timeout. Users can check visible channels, all channels, or remove dead/geo-blocked ones in bulk.

## IPTV directory

The search panel fetches M3U playlists from iptv-org's GitHub-hosted CDN on demand. Results are cached in memory per browse key. Pagination shows 50 results at a time.

## webOS compatibility

The code avoids modern JS features that may not be available on older webOS Chrome versions (79–120). The UI follows 10-foot design principles with large touch targets and high contrast.
