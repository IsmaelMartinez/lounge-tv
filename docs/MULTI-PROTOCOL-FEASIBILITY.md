# Multi-protocol streaming: feasibility

Proposed repositioning: Lounge TV becomes a **universal stream player for webOS** — HLS today, plus YouTube, Twitch, DASH, WebRTC, and Stremio-style addons over time. IPTV stays as one source among many.

This doc scores each candidate protocol on what's technically reachable from the TV browser (and the sideloaded IPK), what effort it takes, and what the main blockers are. Nothing here is implemented yet.

## Browser baseline on webOS

What you can assume depending on minimum target TV year:

| Min target | webOS | Chromium | WebRTC | MSE | WebCodecs | Realistic? |
|---|---|---|---|---|---|---|
| 2016 | 3.x | 38 | no | partial | no | skip |
| 2017 | 4.0 | 53 | flaky | yes | no | skip |
| 2018 | 4.5 | 68 | yes | yes | no | yes |
| 2020 | 5.0 | 68/79 | yes | yes | no | yes |
| 2021 | 6.0 | 79 | yes | yes | yes (partial) | yes |
| 2022+ | 22+ | 87+ | yes | yes | yes | yes |

Recommendation: target **Chromium 68+ (webOS 4.5 / 2018+)**. Gate Chromium-79-only features (WebRTC/WHEP, WebCodecs) behind a capability check.

Sources: [webOS TV Developer – Web API and Web Engine](https://webostv.developer.lge.com/develop/specifications/web-api-and-web-engine), [signageOS browser versions table](https://docs.signageos.io/hc/en-us/articles/4405381554578-Browser-WebKit-and-Chromium-versions-by-each-Platform), [webOS Wikipedia](https://en.wikipedia.org/wiki/WebOS).

## Protocol feasibility matrix

| Protocol | Verdict | Effort | Needs backend? | Main blocker |
|---|---|---|---|---|
| **HLS** (current) | done | — | for CORS-blocked streams only | — |
| **MPEG-DASH** | yes | S | no (for open streams) | bundle size (+~300 KB) |
| **YouTube IFrame embed** | yes | XS | no | LG's existing YouTube app competes; limited UI control |
| **YouTube via Piped/Invidious** | yes | M | optional (self-host) | instances rate-limit and die often |
| **Twitch iframe embed** | yes | XS | no | parent domain allowlist — needs real origin, not `file://` |
| **Twitch HLS extraction** | yes | M | **yes** (Pi proxy) | Twitch tokens expire in minutes |
| **WebRTC / WHEP** | yes (niche) | S | no | very few public WHEP sources exist |
| **WebTorrent** | partial | M | no | only webtorrent-compatible swarms peer; most public torrents don't |
| **Stremio addons (debrid)** | yes | M | optional | user must bring debrid creds; legally user-responsibility |
| **Stremio addons (torrent)** | no | L | **yes** (torrent client on Pi) | no in-browser path for arbitrary torrents on a TV |
| **Acestream** | planned | L | **yes** (Pi) | already Phase 3 |
| **RTSP / RTMP / SRT** | no direct | L | **yes** (transcode) | no browser codec path; server must rewrap to HLS |
| **Widevine / DRM** | no | — | — | browser EME not authorised on sideloaded webOS apps |

Effort: XS ≤ ½ day, S ≤ 2 days, M ≤ 1 week, L > 1 week.

## Notes per protocol

### MPEG-DASH

Swap in `dash.js` alongside `hls.js`, pick by URL extension (`.mpd` vs `.m3u8`). Covers a lot of EU broadcaster streams (BBC, ARD, France TV). No DRM content though — most premium DASH needs Widevine, which we can't do in a sideloaded app. Good ROI.

### YouTube

Two viable paths; they're not mutually exclusive.

- **IFrame API** (`youtube.com/iframe_api`). Drop in `<iframe src="https://www.youtube.com/embed/VIDEO_ID?autoplay=1">`. Works inside the webOS browser. The LG TV already has a native YouTube app, so our value-add is: mixing YouTube channels into the same sidebar as IPTV, searching once across sources, auto-rotating live news channels. UI, not engine.
- **Piped / Invidious / Hyperpipe** instances expose `/api/v1/videos/:id` returning HLS manifest URLs that HLS.js plays directly. Better UX (no iframe, our controls, no ads) but operationally fragile: public instances get rate-limited weekly and we'd spend our time chasing dead hosts. Acceptable if we let users add their own instance URL (or self-host on the Pi from Phase 2).

Recommended: start with IFrame embed for a "YouTube channels as first-class sidebar items" feature. Add Piped as a power-user opt-in later.

### Twitch

IFrame embed requires a `parent=` query param listing allowed parent domains. That works fine when we host on GitHub Pages or a Pi (real origin); it **does not work from `file://`** or from a sideloaded IPK opening a local file — another reason to push the hosted-web-app deployment path from the WEBOS-INVESTIGATION doc.

Raw HLS extraction works but each playback needs a short-lived signed token from Twitch's GraphQL endpoint, which has CORS — that's a proxy requirement. Park until Phase 2 ships.

### WebRTC / WHEP

WHEP (WebRTC-HTTP Egress Protocol, standardised) is a one-HTTP-POST handshake that returns an SDP answer; the browser then streams sub-second video. Libraries: a 5 KB client is enough. Problem: there's almost no public WHEP content today — it's mostly used by self-hosted low-latency sports/gaming setups and a handful of broadcasters' test streams. Worth adding as a "URL protocol we understand" so self-hosters can point Lounge TV at their own WHEP endpoint. Low effort, low immediate payoff, but cheap option value.

### WebTorrent

`webtorrent` the JS lib runs in-browser and streams via WebRTC-capable trackers. It only connects to **WebRTC-WebTorrent peers**, not the BitTorrent TCP/UDP swarm that most public torrents live on. So in practice: WebTorrent works for torrents seeded by WebTorrent clients (niche — some Wikipedia video mirrors, a few archivists), but not for "point it at a random magnet link and watch". Bundle size is ~800 KB gzipped. Include only if we commit to curating WebTorrent-seeded sources.

### Stremio-style addons

Stremio addons are a documented JSON-over-HTTP protocol (`/manifest.json`, `/stream/:type/:id.json`). We can implement a Stremio-addon client ourselves without any Stremio code. Addons return an array of `{name, url}` stream objects. Of those:

- **Debrid addons** (Real-Debrid / Premiumize / AllDebrid / TorBox) resolve to **plain HTTPS URLs** the browser can play directly — this is the only in-browser-playable path. User must supply their own debrid credentials; legal responsibility is the user's, as it is for any IPTV URL they add.
- **Direct torrent addons** return magnet links — not playable without a torrent client, i.e. not without Phase 2.

A minimal Stremio client means: a settings panel to paste addon URLs, a search-by-IMDB-id box, and a stream picker. Reuses our existing player. Medium effort, high appeal to the Stremio crowd. See [Stremio technical details](https://guides.viren070.me/stremio/technical-details) for the protocol.

### RTSP / RTMP / SRT / Acestream

All require server-side transcoding or a protocol bridge. They collapse into a single Phase 2/3 deliverable: a small service on the Pi that exposes `/proxy?url=...` and rewraps into HLS. Nothing changes in the browser client beyond a URL-scheme detector.

### DRM content

Skip. EME on a sideloaded webOS Chromium context won't get a Widevine licence — only the TV's built-in native apps get that entitlement. This rules out Netflix, Prime, YouTube Premium offline, Disney+, and all premium broadcaster DASH.

## What this means for the architecture

Today's single-file player assumes one protocol (HLS). A multi-protocol player needs a thin abstraction — not a framework:

```
playUrl(url) → detectProtocol(url) → engine.load(url)
```

`engine` is one of: `<video>` native, `hls.js`, `dash.js`, `youtubeIframe`, `twitchIframe`, `whepClient`, `stremioResolver` (returns a URL for one of the above).

Channels pick up a `kind` field: `"hls" | "dash" | "youtube" | "twitch" | "whep" | "stremio"`. `picks.json` and `channels.json` already have room for it.

This is ~200 LOC of dispatch, not a rewrite. The big costs are the per-engine bundles (dash.js, webtorrent) — lazy-load each on first use so the ~54 KB cold-start budget holds.

## Proposed roadmap delta

Today's roadmap ends at EPG. A multi-protocol pivot reshuffles it. Suggested phases (open for debate — not committed):

- **Phase 1.6 — Protocol abstraction.** Introduce the engine dispatcher above with HLS and DASH. S-size. No new UX.
- **Phase 1.7 — YouTube integration.** IFrame-based, sidebar entries with channel IDs. XS-size. High visible payoff.
- **Phase 1.8 — Twitch integration.** IFrame embed, requires hosted deployment. XS-size.
- **Phase 2 (existing) — Pi proxy.** Still needed; now also unlocks Twitch HLS, RTMP/RTSP rewrap, Piped self-host, Stremio torrent addons. Higher ROI than before.
- **Phase 2.5 — Stremio addon client (debrid-only).** M-size. Reuses existing player once the abstraction lands.
- **Phase 3 (existing) — Acestream / torrent bridge.** Fits naturally under the Pi proxy.
- **Phase 3.5 — WHEP source support.** Cheap option value for self-hosters.
- **Phase 4 (existing) — EPG.** Unchanged.

Positioning update for the README: **"A lightweight, privacy-first, open-source universal stream player for the browser and LG webOS. HLS, DASH, YouTube, Twitch, WebRTC, and Stremio addons — in one sidebar."**

## Recommended next step

Pick one of these as the first concrete piece of work:

1. **Abstraction + DASH + YouTube iframe** (~3 days total). Biggest user-visible jump. Validates the architecture before we invest in Stremio/WHEP.
2. **Run the CORS matrix from WEBOS-INVESTIGATION first**, then decide. Safer sequencing — if HLS alone needs a proxy to be usable on the TV, Phase 2 jumps the queue ahead of any new protocol.

I'd lead with (2): finish the webOS investigation on a real TV, then pivot the roadmap based on what actually plays.
