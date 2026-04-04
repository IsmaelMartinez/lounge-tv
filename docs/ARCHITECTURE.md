# Architecture

Lounge TV is a single self-contained HTML file with inline CSS and JavaScript. There is no build step, no bundler, and no framework.

## Stack

The only external dependency is HLS.js (loaded from cdnjs CDN), which provides HLS stream playback using the Media Source Extensions API. Fonts (DM Sans and Space Mono) are loaded from Google Fonts.

## Structure

The HTML file is organised into three sections: the style block containing all CSS, the markup for the UI components (sidebar, player, controls, search panel, modal, PiP preview, toast), and the script block containing all application logic.

## State management

All application state lives in a single `S` object. Channels are stored as an array of objects with id, name, group, url, logo, and status fields. Favourites are persisted to localStorage under the key `lounge-tv-favs`. There is no backend.

## Health checking

The health checker tests stream URLs in parallel using a promise-based worker pool (default 10 concurrent). Each test first sends a HEAD request to detect HTTP errors and geo-blocks (403/451), then attempts to load the HLS manifest with a 6-second timeout.

## IPTV directory

The search panel fetches M3U playlists from iptv-org's GitHub-hosted CDN. Results are cached in memory per browse key. Pagination shows 50 results at a time.

## webOS compatibility

The code avoids modern JS features that may not be available on older webOS Chrome versions (79-120). The UI follows 10-foot design principles with large touch targets and high contrast.
