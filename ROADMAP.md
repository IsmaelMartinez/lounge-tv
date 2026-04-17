# Roadmap

Lounge TV is evolving from an IPTV-only player into a **universal stream player for webOS** — HLS, DASH, YouTube, Twitch, WebRTC, and Stremio-style addons through one sidebar. See [docs/MULTI-PROTOCOL-FEASIBILITY.md](docs/MULTI-PROTOCOL-FEASIBILITY.md) for the analysis behind the pivot.

```
 LOUNGE TV — DEVELOPMENT ROADMAP
 ════════════════════════════════════════════════════════════════════════

 DONE                       IN PROGRESS / NEXT                      FUTURE
 ────                       ──────────────────                      ──────

 [1]   Single-file IPTV          [1.5]  webOS deployment
       player + picks            ───►   investigation        ───►   [2]    Pi proxy
 [1.1] Curated channels                 (CORS matrix,               (CORS bypass,
       + weekly validation               hosted web app,             RTMP/RTSP wrap,
                                         Dev Mode, Store)            Twitch HLS)

                                 [1.6]  Protocol abstraction
                                        + DASH (dash.js)      ───►  [2.5]  Stremio
                                                                            addon client
                                 [1.7]  YouTube integration          (debrid only)
                                        (IFrame + channels)

                                 [1.8]  Twitch integration    ───►  [3]    Acestream
                                        (iframe embed)                bridge via Pi

                                                              ───►  [3.5]  WHEP / WebRTC
                                                                            URL support

                                                              ───►  [4]    EPG guide
                                                                            (XMLTV)

 ─────────────────────────────────────────────────────────────────────
 Current focus ──► Phase 1.5 (webOS investigation) + Phase 1.6 spike
 ─────────────────────────────────────────────────────────────────────
```

## Phase 1: Single-file IPTV player [DONE]

The player works in any browser. 44 curated free-to-air channels load instantly with no network fetches on startup. Thousands more are available on demand via the IPTV directory panel (iptv-org, Free-TV). Health checking runs sequentially to keep mobile resource usage low.

Delivered: HLS playback via HLS.js, collapsible sidebar with channel list, group filters, favourites (localStorage), health checker, IPTV directory browser with country/category/language search, M3U import/export, PiP preview, keyboard navigation, responsive dark theme, GitHub Pages deployment.

## Phase 1.1: Curated channels with automated validation [DONE]

Replaced the 25-channel baked-in list with a hand-picked selection of 44 channels spanning UK, international news, music, entertainment, movies, documentaries, sports, and kids. A Node.js validation script tests streams from iptv-org playlists and writes results to `data/channels.json`. A hand-edited `data/picks.json` defines the curated picks by URL. A GitHub Action runs validation weekly and commits updated results. The app loads both JSON files on startup, falling back to the built-in list if offline. The Find panel includes a "Validated" filter showing all working channels from the last validation run as a discovery pool.

## Phase 1.5: LG webOS deployment investigation [IN PROGRESS]

Before building a proxy backend, validate that the webOS deployment path is viable and worth pursuing. Findings live in [docs/WEBOS-INVESTIGATION.md](docs/WEBOS-INVESTIGATION.md).

Open questions: Developer Mode setup and the 50-hour expiry, `ares-package` requirements (icons, manifest), LG Content Store restrictions on stream-loading apps, sideloading vs Content Store trade-offs, CORS behaviour on real TVs (gates the Phase 2 go/no-go), and the hosted-web-app alternative (bookmark a Pi-served `index.html` in the TV browser).

Outstanding: run the §5 CORS test matrix on a real TV.

## Phase 1.6: Protocol abstraction + MPEG-DASH [NEXT]

Introduce a minimal engine dispatcher — `playUrl(url, kind)` that routes to one of: native `<video>`, `hls.js`, `dash.js`, or (later) iframe/WHEP/Stremio-resolver. Each engine library lazy-loads on first use to keep the cold-start budget. `picks.json` and `channels.json` gain an optional `kind` field; when absent, kind is inferred from the URL (`.m3u8` → hls, `.mpd` → dash).

Adds DASH playback with no DRM support (Widevine isn't available to sideloaded apps). Covers a lot of EU broadcaster streams that publish DASH alongside HLS.

## Phase 1.7: YouTube integration

Add YouTube as a first-class source kind. Sidebar entries point at a YouTube channel ID or live-video ID; the player swaps in a YouTube IFrame embed with minimal chrome. Channel mixing (YouTube live news alongside IPTV news in the same group) is the value-add over the TV's built-in YouTube app.

Later: allow the user to point at a self-hosted Piped / Invidious instance for HLS-based playback without iframes.

## Phase 1.8: Twitch integration

Twitch iframe embed with `parent=` origin allowlist. Requires the hosted-web-app deployment path (real origin, not `file://`). Adds Twitch streamers as sidebar entries. HLS-extraction mode (cleaner UI, our controls) depends on Phase 2 for token fetching.

## Phase 2: Pi proxy backend

A lightweight Node.js or Python proxy running on a Raspberry Pi on the local network. It receives stream URLs from the player, fetches them server-side (bypassing CORS), and pipes the response back to the TV. Unblocks geo-restricted and CORS-blocked HLS streams without any client change — just a configurable proxy URL in the settings.

Same proxy later handles RTMP/RTSP/SRT rewrap into HLS, Twitch HLS token fetching, and optionally a self-hosted Piped instance.

## Phase 2.5: Stremio addon client (debrid-only)

Implement the Stremio addon HTTP protocol client — `/manifest.json`, `/stream/:type/:id.json`. Users paste addon URLs and (optionally) their own debrid credentials. Debrid-enabled addons return plain HTTPS URLs that play through the existing engine dispatcher. Torrent-resolving addons stay out of scope until Phase 3 lands.

## Phase 3: Acestream + torrent bridge

Acestream uses P2P streaming and requires a local engine. The Pi runs the Acestream engine and exposes an HTTP endpoint that translates `ace://` links into HLS streams. Same service bridges WebTorrent-incompatible torrent sources (via a `webtorrent-hybrid` or similar) so Stremio torrent addons work end-to-end.

## Phase 3.5: WHEP / WebRTC URL support

Add `whep://` (or `https://…/whep` with content-type sniffing) as a first-class source kind. A ~5 KB WHEP client performs the POST/SDP-answer handshake and attaches the resulting MediaStream to the `<video>` element. Enables sub-second self-hosted streams. Gated on Chromium 79+ (webOS 6.0 / 2021+); degrade gracefully on older TVs.

## Phase 4: EPG programme guide

Electronic Programme Guide integration. Fetch EPG data (XMLTV format) from public sources, match to loaded channels by ID, and display current/next programme info in the sidebar plus an optional full-screen grid guide view. Backed by the Pi for scheduled XMLTV fetches (files can be tens of MB).
