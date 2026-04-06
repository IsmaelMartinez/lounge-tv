# Curated Channels with Automated Validation

## Problem

The app ships with 25 built-in channels (mostly test streams and Spanish TV) and exposes an 11k+ channel directory via iptv-org. There's no middle ground: you either watch the small baked-in list or wade through thousands of unvalidated streams, most of which are broken, geo-blocked, or CORS-blocked. The goal is a curated experience of 40-50 reliably working channels, primarily UK-focused with the best international picks, backed by automated validation so the list stays honest over time.

## Architecture

Three components: a validation script, a GitHub Actions pipeline, and UI changes to the single-file app.

### 1. Validation Script (`scripts/validate.js`)

A Node.js script that fetches a configured set of iptv-org M3U playlists, parses them, and tests each stream's availability. It outputs two data files that the app consumes at runtime.

Source playlists to test (configured in the script):
- iptv-org UK (`countries/uk.m3u`)
- iptv-org News (`categories/news.m3u`)
- iptv-org Music (`categories/music.m3u`)
- iptv-org Entertainment (`categories/entertainment.m3u`)
- iptv-org Sports (`categories/sports.m3u`)
- iptv-org Documentary (`categories/documentary.m3u`)
- iptv-org Kids (`categories/kids.m3u`)
- Free-TV playlist

Stream testing approach: for each channel, attempt to fetch the M3U8 manifest URL. If the manifest loads, attempt to fetch the first segment URL referenced in it. This catches CDNs that serve the manifest but block actual content. Each channel gets a status:

- `ok` — manifest and first segment both loaded successfully
- `geo` — got a 403 response (likely geo-restricted from the runner's location)
- `fail` — timeout, DNS failure, 404, or other error

Since the script runs in Node (not a browser), it cannot detect CORS issues. Streams that work from Node but fail in the browser due to CORS will show as `ok` in `channels.json` but won't play in the app. The in-app health checker remains the way to catch these — users can run it against curated channels to flag CORS problems.

The script respects rate limits with a small delay between requests and runs tests sequentially to avoid overwhelming CDNs.

Output files:

`data/channels.json` — every tested channel:
```json
[
  {
    "name": "Sky News",
    "group": "News",
    "country": "UK",
    "category": "news",
    "url": "https://...",
    "logo": "https://...",
    "status": "ok",
    "lastChecked": "2026-04-05T00:00:00Z"
  }
]
```

`data/curated.json` — the hand-picked list (only created if it doesn't exist):
```json
{
  "channels": [
    {
      "url": "https://...",
      "note": "Works from UK, geo-blocked from US runners"
    }
  ]
}
```

The curation workflow: look at `channels.json` for channels with `ok` status, add their URLs to `curated.json`. The script never overwrites `curated.json` — it only scaffolds it on first run. Channels in `curated.json` that have a `note` field are not demoted even if the automated check marks them as `geo` or `fail`, since the note indicates they've been manually verified from the UK.

### 2. GitHub Actions Pipeline (`.github/workflows/validate.yml`)

A scheduled workflow that runs weekly (Sunday midnight UTC). Steps:

1. Check out the repo
2. Install Node 20
3. Run `node scripts/validate.js`
4. If `data/channels.json` has changed, commit and push

The workflow also supports `workflow_dispatch` for on-demand runs when curating new channels.

The runner is US-based (`ubuntu-latest`), so some UK-only streams will show as `geo`. This is useful metadata — it identifies which channels are geo-restricted. Channels in `curated.json` with a `note` override this.

The `data/curated.json` file is never modified by the action. Only `data/channels.json` gets updated.

### 3. UI Changes to `index.html`

The changes are minimal and focused on making the curated list the default experience.

Startup behaviour: on load, the app fetches `data/curated.json` and `data/channels.json` from the same origin (GitHub Pages serves them as static files). It merges curated URLs with their full channel data from `channels.json`. If either fetch fails, it falls back to the existing `BUILT` array.

Default Channels tab: shows the curated list instead of the `BUILT` array. Each channel displays its pre-computed validation status (green/red/orange dot) immediately, without needing to run the in-app health checker. The in-app health checker remains available for live rechecks.

Find panel: stays as-is for browsing the full iptv-org directory. A new "Validated" filter within Find shows all channels from `channels.json` that have `ok` status. This is the discovery pool for finding new channels to add to the curated list.

Group filters: dynamically generated from the groups present in the loaded channel list, rather than hardcoded. When viewing curated channels, filters reflect the curated groups (UK, News, Music, etc.). When viewing validated channels, filters reflect whatever groups are present.

The `BUILT` array remains in the code as a fallback but is no longer the primary channel source.

## Data Flow

```
iptv-org playlists (M3U)
        |
        v
scripts/validate.js (tests streams)
        |
        v
data/channels.json (all tested channels with status)
data/curated.json (hand-picked URLs, edited by user)
        |
        v
GitHub Actions commits changes weekly
        |
        v
GitHub Pages serves both JSON files
        |
        v
index.html loads JSON on startup
  - curated.json URLs merged with channels.json data = default view
  - channels.json with status=ok = "Validated" discovery pool
  - BUILT array = offline fallback
```

## What This Does Not Include

- No proxy server or CORS workaround — channels that are CORS-blocked from the browser still won't play. The validation script runs in Node so it can't detect CORS issues; the in-app health checker is the fallback for that.
- No EPG/programme guide data — that's a separate future phase.
- No in-app curation UI — promoting a channel to curated requires editing `curated.json` by hand. This keeps the app simple.
- No webOS-specific changes.

## Success Criteria

The curated list has 40-50 channels that reliably play in the browser, primarily UK channels with a selection of international news, music, and entertainment. The validation pipeline runs weekly and keeps `channels.json` fresh. The app defaults to the curated view and loads fast. The full directory remains accessible as a "browse more" option.
