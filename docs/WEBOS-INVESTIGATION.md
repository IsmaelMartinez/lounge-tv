# Phase 1.5: webOS deployment investigation

Status: in progress. This document answers the open questions from `ROADMAP.md` Phase 1.5 before committing to Phase 2 (Pi proxy) or any further webOS work.

Goal: decide which deployment path(s) Lounge TV should support on LG webOS, and whether a CORS-bypassing proxy is a hard requirement or a nice-to-have.

## TL;DR (findings so far)

The three realistic deployment paths, ranked by effort:

1. **Hosted web app (bookmark in TV browser)** — lowest effort, no expiry, no review. Requires a device on the LAN serving `index.html` over HTTP. Best first target.
2. **Sideloaded IPK via Developer Mode** — medium effort, expires every 50 hours, no review. Good for personal use and testing.
3. **LG Content Store submission** — highest effort, permanent install, but IPTV-style apps that load arbitrary external streams are historically hard to get approved. Parked until 1 and 2 are validated.

Phase 2 (Pi proxy) is **likely required** for a meaningful channel set on webOS because the TV's built-in browser enforces CORS on `fetch`/XHR and many iptv-org streams lack permissive CORS headers. A concrete test matrix is defined below; results will confirm or refute this.

## 1. Developer Mode on webOS

### Enabling it

1. On the TV: **LG Content Store → search "Developer Mode" → install**. Free.
2. Create a free account at https://webostv.developer.lge.com and sign in inside the Developer Mode app.
3. Toggle **Dev Mode Status** to ON. The TV reboots.
4. After reboot, open the Developer Mode app again. It shows the TV's LAN IP, the SSH port (`9922`), and a **Key Server** toggle. Turn Key Server ON when pairing a new computer.

### The 50-hour session expiry

Each Dev Mode session lasts 50 hours of TV-on time. When it expires:

- Sideloaded apps are uninstalled automatically.
- You must re-enable Dev Mode from the app (one tap, but requires the TV to be online and signed into the LG account).

Mitigations:

- **Re-sign daily** — trivial for personal use; poor UX for anyone else.
- **RootMyTV / crashd** — community root exploits exist for webOS 3.x–6.x (see https://rootmy.tv). They remove the expiry and enable persistent installs, but: (a) support lags behind new firmware, (b) LG has patched several exploits in webOS 7+, (c) it voids warranty and can brick the TV if interrupted. Not something to recommend to end users; acceptable for the maintainer's own device.
- **Hosted web app path** — sidesteps this entirely (see §6).

Decision: document Dev Mode as the developer/testing path, not the end-user path.

## 2. App packaging with ares-CLI

### What `ares-package` needs

At minimum:

- `appinfo.json` (we have one at `webos/appinfo.json`).
- `index.html` — the entry point referenced by `main`.
- `icon.png` — **80×80 PNG**, shown in the launcher.
- `largeIcon.png` — **130×130 PNG**, shown on the home screen.

Optional but recommended:

- `splashBackground` — 1920×1080 PNG shown during launch.
- `iconColor` — accent color string.

Our current `webos/appinfo.json` declares both icons but the files are missing from the repo. **Action: add `icon.png` and `largeIcon.png` to `webos/`.**

### Does our single HTML file work directly?

Two options, both viable:

- **Standalone** — copy `index.html` over `webos/index.html` before `ares-package webos/`. The HLS.js CDN dependency still loads over the TV's internet connection. Works, but every launch fetches HLS.js from cdnjs.
- **Shell wrapper (current)** — `webos/index.html` redirects to a hosted URL. Simplest to update (change the server, not the IPK), but requires a LAN host.

Recommendation: **bundle HLS.js locally** inside the IPK for the standalone variant so the app works offline until a stream loads. ~120 KB extra, one-time change.

### Manifest fields to consider adding

- `"requiredMemory": 256` — hint for low-memory devices.
- `"supportPortrait": false` — TVs are landscape-only.
- `"handlesRelaunch": true` — lets us handle being resumed from background.
- `"accessibility": { "supportsAudioGuidance": false }` — declare explicitly to avoid review flags.

## 3. LG Content Store submission

### Cost and process

- Developer account registration: **free**.
- Submission: **free**, via the Seller Lounge (https://seller.lgappstv.com).
- Review SLA: typically **2–4 weeks**, longer for first submissions.

### Likely blockers for an IPTV-style app

Based on public developer-forum reports and LG's published content guidelines:

- Apps that load arbitrary external streams (especially unvetted M3U URLs) frequently get rejected under the "content quality / rights" clause. LG wants to see a curated, rights-cleared catalogue.
- The `M3U import from URL` feature is the biggest risk — it effectively makes us a generic IPTV client.
- Favourites and export-to-M3U are fine; they don't add new streams.

Mitigation strategies if we ever submit:

- Ship a **"Content Store edition"** build with M3U import disabled and only the curated `picks.json` list enabled.
- Include clear attribution to iptv-org / Free-TV and link to their licence pages.
- Add an age-gate for any stream flagged non-family-friendly (none in our current picks, but future-proofing).

### Quality bar

- Icons: 80×80 and 130×130 PNG (as above).
- At least 3 screenshots at 1920×1080.
- Short description (≤ 80 chars) and long description (≤ 4000 chars).
- Privacy policy URL — we can host a one-pager on GitHub Pages.
- Age rating via IARC questionnaire.

Decision: **park Content Store submission** until sideloading and hosted paths are validated. Revisit only if there's user demand.

## 4. Sideloading vs Content Store — trade-offs

| Dimension | Sideloading (Dev Mode) | Content Store |
|---|---|---|
| Cost | Free | Free |
| Install effort (end user) | High (dev mode, ares-CLI, or pre-built IPK) | One tap |
| Expiry | 50 hours | Permanent |
| Reach | Tinkerers only | Any LG TV user |
| Review | None | 2–4 weeks, IPTV apps often rejected |
| Update cadence | Instant | Re-review per release |
| Suitable for | Maintainer, beta testers | Mass distribution (if it passes review) |

## 5. CORS behaviour on webOS — test plan

Hypothesis: the webOS browser (Chromium-based, versions 79–120 depending on TV model year) enforces CORS identically to desktop Chrome. Streams that require a proxy in a desktop browser will also require one on the TV.

### Test matrix

Run each of these on a real TV via the hosted web app path (§6) so we can iterate without re-packaging:

| Stream | Source | Expected | Actual (to fill in) |
|---|---|---|---|
| RTVE La 1 | `picks.json` | OK | |
| BBC News (if public) | iptv-org UK | CORS-blocked | |
| France 24 EN | iptv-org News | OK | |
| DW English | iptv-org News | OK | |
| Al Jazeera EN | iptv-org News | OK | |
| NASA TV | iptv-org US | OK | |
| Bloomberg TV+ | iptv-org Business | CORS-blocked | |
| A geo-blocked UK stream from outside UK | iptv-org UK | 451/403 | |

For each, record:
- Did HLS.js load the manifest? (Y/N)
- Network tab error (CORS, 403, 451, timeout)?
- Did video play?

### Decision rule

- If ≥ 80 % of the 44 picks play without a proxy → **Phase 2 is a nice-to-have** (ship webOS v1 proxyless, add proxy later for the long tail).
- If < 80 % play → **Phase 2 is a hard requirement** before a usable webOS release.

Test results go in §5.1 once collected.

### 5.1 Test results

_Pending. Run against a live TV and paste the filled-in matrix here._

## 6. Hosted web app alternative (recommended first target)

The TV's built-in web browser can open any URL on the LAN. Serving `index.html` from a Raspberry Pi, NAS, or any always-on machine gives us:

- No 50-hour expiry.
- No Content Store review.
- Instant updates (edit `index.html`, refresh the TV browser).
- Same CORS behaviour as the sideloaded app, so the CORS test matrix from §5 still applies.

### Minimum setup on a Pi

```bash
# On the Pi, in the repo root:
python3 -m http.server 8080
```

Then on the TV browser: `http://<pi-ip>:8080/`.

For something more permanent:

```bash
sudo apt install nginx
sudo cp index.html data/ /var/www/html/   # or symlink the repo
```

Bookmark the URL in the TV browser. Done.

### Caveats

- The TV browser has no "add to home screen" — users navigate via Browser → Bookmarks, which is two extra clicks vs a launcher tile.
- Some older TVs (webOS 3.x) ship a very old Chromium (≤ 53); test HLS.js compatibility there specifically.
- `localStorage` persists across sessions in the TV browser, so favourites still work.

## Next actions

1. **Add missing icons** (`webos/icon.png`, `webos/largeIcon.png`) so `ares-package` actually works end-to-end.
2. **Bundle HLS.js locally** in the standalone IPK variant.
3. **Run the CORS test matrix** (§5) on a real TV via the hosted path. This is the blocking experiment for the Phase 2 go/no-go decision.
4. **Document the hosted-web-app path** in `SETUP-WEBOS.md` as the primary recommended setup.
5. Based on §5 results, either start Phase 2 (proxy) or publish a webOS v1 release notes post and move to Phase 4 (EPG).
