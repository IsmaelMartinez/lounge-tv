# Roadmap

## Phase 1: Single-file IPTV player [DONE]

The player works in any browser. 25 curated free-to-air channels load instantly with no network fetches on startup. Thousands more are available on demand via the IPTV directory panel (iptv-org, Free-TV). Health checking runs sequentially to keep mobile resource usage low.

Delivered: HLS playback via HLS.js, collapsible sidebar with channel list, group filters, favourites (localStorage), health checker, IPTV directory browser with country/category/language search, M3U import/export, PiP preview, keyboard navigation, responsive dark theme, GitHub Pages deployment.

## Phase 1.1: Curated channels with automated validation [DONE]

Replaced the 25-channel baked-in list with a curated selection of ~50 reliably working channels, primarily UK-focused with international news, music, entertainment, and sports. A Node.js validation script tests streams from iptv-org playlists and writes results to data/channels.json. A hand-edited data/curated.json defines the curated picks. A GitHub Action runs validation weekly and commits updated results. The app loads both JSON files on startup, falling back to the built-in list if offline. The Find panel includes a "Validated" filter showing all working channels from the last validation run as a discovery pool.

## Phase 1.5: LG webOS deployment investigation

Before building a proxy backend, validate that the webOS deployment path is viable and worth pursuing.

Questions to answer:

Developer Mode on webOS: how to enable it, the 50-hour session expiry, and whether rooting is practical for persistent installs. Document the full setup flow from scratch for someone who hasn't done it before.

App packaging with ares-CLI: what ares-package requires, icon sizes and formats, manifest fields beyond what we already have in webos/appinfo.json, and whether our single HTML file works directly or needs a shell wrapper.

LG Content Store submission: is it free? What are the review criteria, content restrictions, and turnaround times? Are there restrictions on IPTV-style apps or apps that load external streams? What's the minimum quality bar (icons, descriptions, screenshots)?

Sideloading vs Content Store: document pros and cons. Sideloading is simpler but expires every 50 hours. Content Store is permanent but has review overhead and potential restrictions on stream-loading apps.

CORS behaviour on webOS: test which of our built-in streams work directly on the TV browser versus which get blocked. This determines whether Phase 2 (Pi proxy) is a hard requirement for webOS or just a nice-to-have.

Hosted web app alternative: can the TV's built-in browser simply bookmark a URL served from a Pi or NAS on the local network? This would bypass both sideloading expiry and Content Store review entirely. Document how to set up a simple HTTP server on a Pi to serve index.html.

## Phase 2: Pi proxy backend for CORS-blocked streams

A lightweight Node.js or Python proxy running on a Raspberry Pi on the local network. It receives stream URLs from the player, fetches them server-side (bypassing CORS), and pipes the response back to the TV. This unblocks geo-restricted and CORS-blocked streams without requiring any changes to the player itself — just a configurable proxy URL in the settings.

## Phase 3: Acestream engine bridge

Acestream uses P2P streaming and requires a local engine. The Pi would run the Acestream engine and expose an HTTP endpoint that translates ace:// links into HLS streams the player can consume. This enables access to additional live sports and event streams.

## Phase 4: EPG programme guide

Electronic Programme Guide integration. Fetch EPG data (XMLTV format) from public sources, match it to loaded channels by ID, and display current/next programme info in the sidebar and an optional full-screen grid guide view. This requires a lightweight backend or scheduled fetch since XMLTV files can be large.
