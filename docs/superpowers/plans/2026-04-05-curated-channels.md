# Curated Channels with Automated Validation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 25-channel baked-in list with a curated 40-50 channel experience backed by automated weekly validation via GitHub Actions, with the full iptv-org directory accessible as a "browse more" option.

**Architecture:** A Node.js validation script fetches iptv-org M3U playlists, tests each stream, and writes `data/channels.json`. A hand-edited `data/curated.json` lists the user's picks by URL. A GitHub Action runs the script weekly and commits results. The app loads both JSON files on startup to build the default channel list, falling back to a baked-in `BUILT` array if the fetch fails.

**Tech Stack:** Node.js 20 (validation script), GitHub Actions (CI), vanilla JS (frontend — single-file `index.html`)

**Spec:** `docs/superpowers/specs/2026-04-05-curated-channels-design.md`

---

## File Structure

```
scripts/validate.js          — validation script (new)
data/curated.json             — hand-picked channel URLs (new, user-edited)
data/channels.json            — full validation results (new, auto-generated)
.github/workflows/validate.yml — weekly validation action (new)
index.html                    — UI changes to load JSON and default to curated view (modify)
package.json                  — add node project with no deps (new)
```

---

### Task 1: Validation Script — M3U Parser and Stream Tester

**Files:**
- Create: `scripts/validate.js`
- Create: `package.json`

This task builds the core validation script. It fetches M3U playlists from iptv-org, parses them, tests each stream, and writes `data/channels.json`. It also scaffolds `data/curated.json` if it doesn't exist.

- [ ] **Step 1: Create package.json**

```json
{
  "name": "lounge-tv",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "validate": "node scripts/validate.js"
  }
}
```

- [ ] **Step 2: Create scripts/validate.js with M3U parser**

Create `scripts/validate.js`. The script uses only Node built-ins (no npm dependencies).

```js
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DATA_DIR = resolve(ROOT, 'data');
const CHANNELS_PATH = resolve(DATA_DIR, 'channels.json');
const CURATED_PATH = resolve(DATA_DIR, 'curated.json');

const SOURCES = [
  { key: 'uk', label: 'UK', url: 'https://iptv-org.github.io/iptv/countries/uk.m3u' },
  { key: 'news', label: 'News', url: 'https://iptv-org.github.io/iptv/categories/news.m3u' },
  { key: 'music', label: 'Music', url: 'https://iptv-org.github.io/iptv/categories/music.m3u' },
  { key: 'entertainment', label: 'Entertainment', url: 'https://iptv-org.github.io/iptv/categories/entertainment.m3u' },
  { key: 'sports', label: 'Sports', url: 'https://iptv-org.github.io/iptv/categories/sports.m3u' },
  { key: 'documentary', label: 'Documentary', url: 'https://iptv-org.github.io/iptv/categories/documentary.m3u' },
  { key: 'kids', label: 'Kids', url: 'https://iptv-org.github.io/iptv/categories/kids.m3u' },
  { key: 'freetv', label: 'Free-TV', url: 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8' },
];

const TIMEOUT = 10000;
const DELAY = 200; // ms between requests

function parseM3U(text) {
  const lines = text.split('\n');
  const channels = [];
  let current = {};
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#EXTINF')) {
      const meta = line.substring(line.indexOf(':') + 1);
      const commaIdx = meta.lastIndexOf(',');
      current = {
        name: commaIdx >= 0 ? meta.substring(commaIdx + 1).trim() : 'Unknown',
        group: (meta.match(/group-title="([^"]*)"/) || [])[1] || 'General',
        logo: (meta.match(/tvg-logo="([^"]*)"/) || [])[1] || '',
      };
    } else if (!line.startsWith('#') && (line.startsWith('http://') || line.startsWith('https://'))) {
      current.url = line;
      channels.push(current);
      current = {};
    }
  }
  return channels;
}

async function testStream(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    // Fetch the manifest
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    clearTimeout(timer);
    if (res.status === 403 || res.status === 451 || res.status === 410) return 'geo';
    if (!res.ok) return 'fail';

    const body = await res.text();
    // If it's an HLS manifest, try to fetch the first segment/variant
    if (body.includes('#EXTM3U') || body.includes('#EXT-X-')) {
      const segmentUrl = extractFirstSegment(body, url);
      if (segmentUrl) {
        return await testSegment(segmentUrl);
      }
    }
    // Got a response and it's not a 4xx/5xx — call it ok
    return 'ok';
  } catch {
    clearTimeout(timer);
    return 'fail';
  }
}

function extractFirstSegment(manifest, baseUrl) {
  const lines = manifest.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  if (!lines.length) return null;
  const seg = lines[0];
  if (seg.startsWith('http://') || seg.startsWith('https://')) return seg;
  // Resolve relative URL
  const base = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
  return base + seg;
}

async function testSegment(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    clearTimeout(timer);
    if (res.status === 403 || res.status === 451) return 'geo';
    if (!res.ok) return 'fail';
    return 'ok';
  } catch {
    clearTimeout(timer);
    return 'fail';
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

  // Fetch and parse all playlists
  const allChannels = [];
  const seenUrls = new Set();

  for (const source of SOURCES) {
    console.log(`Fetching ${source.label} (${source.url})...`);
    try {
      const res = await fetch(source.url);
      if (!res.ok) { console.log(`  SKIP: HTTP ${res.status}`); continue; }
      const channels = parseM3U(await res.text());
      let added = 0;
      for (const ch of channels) {
        if (seenUrls.has(ch.url)) continue;
        seenUrls.add(ch.url);
        ch.country = source.key === 'uk' ? 'UK' : '';
        ch.category = source.label;
        allChannels.push(ch);
        added++;
      }
      console.log(`  ${added} new channels (${channels.length} total, ${channels.length - added} dupes)`);
    } catch (e) {
      console.log(`  SKIP: ${e.message}`);
    }
  }

  console.log(`\nTesting ${allChannels.length} channels...\n`);

  const now = new Date().toISOString();
  for (let i = 0; i < allChannels.length; i++) {
    const ch = allChannels[i];
    ch.status = await testStream(ch.url);
    ch.lastChecked = now;
    const pct = Math.round(((i + 1) / allChannels.length) * 100);
    const icon = ch.status === 'ok' ? '+' : ch.status === 'geo' ? '!' : '-';
    console.log(`  [${pct}%] ${icon} ${ch.name} — ${ch.status}`);
    if (i < allChannels.length - 1) await sleep(DELAY);
  }

  // Write channels.json
  writeFileSync(CHANNELS_PATH, JSON.stringify(allChannels, null, 2) + '\n');
  const ok = allChannels.filter(c => c.status === 'ok').length;
  const geo = allChannels.filter(c => c.status === 'geo').length;
  const fail = allChannels.filter(c => c.status === 'fail').length;
  console.log(`\nResults: ${ok} ok, ${geo} geo, ${fail} fail — written to data/channels.json`);

  // Scaffold curated.json if it doesn't exist
  if (!existsSync(CURATED_PATH)) {
    const scaffold = {
      channels: allChannels
        .filter(c => c.status === 'ok')
        .slice(0, 50)
        .map(c => ({ url: c.url }))
    };
    writeFileSync(CURATED_PATH, JSON.stringify(scaffold, null, 2) + '\n');
    console.log(`Scaffolded data/curated.json with ${scaffold.channels.length} channels (edit this file to curate)`);
  } else {
    console.log('data/curated.json already exists — not modified');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Run the script locally to verify it works**

Run: `cd /Users/ismael.martinez/projects/github/lounge-tv && node scripts/validate.js`

Expected: the script fetches playlists, tests streams one by one with progress output, writes `data/channels.json` and scaffolds `data/curated.json`. This will take several minutes depending on how many channels are in the playlists.

- [ ] **Step 4: Verify output files**

Check that `data/channels.json` is valid JSON with an array of channel objects, each having `name`, `group`, `url`, `logo`, `status`, `lastChecked`, `country`, and `category` fields. Check that `data/curated.json` has a `channels` array with `url` fields.

- [ ] **Step 5: Commit**

```bash
git add package.json scripts/validate.js data/channels.json data/curated.json
git commit -m "feat: add channel validation script with M3U parser and stream tester"
```

---

### Task 2: GitHub Actions Validation Workflow

**Files:**
- Create: `.github/workflows/validate.yml`

- [ ] **Step 1: Create the workflow file**

```yaml
name: Validate Channels

on:
  schedule:
    - cron: '0 0 * * 0' # Sunday midnight UTC
  workflow_dispatch:

permissions:
  contents: write

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Run validation
        run: node scripts/validate.js

      - name: Commit results
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add data/channels.json
          git diff --cached --quiet || git commit -m "chore: update channel validation results"
          git push
```

Note: the workflow only commits `data/channels.json`, never `data/curated.json`.

- [ ] **Step 2: Verify the workflow file is valid YAML**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/validate.yml')); print('Valid YAML')"`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/validate.yml
git commit -m "ci: add weekly channel validation workflow"
```

---

### Task 3: UI — Load Curated Channels from JSON on Startup

**Files:**
- Modify: `index.html:524-529` (state object S)
- Modify: `index.html:636-654` (the `init()` function)

This task modifies the `init()` function to fetch `data/curated.json` and `data/channels.json`, merge them, and use the result as the default channel list. Falls back to `BUILT` if either fetch fails.

- [ ] **Step 1: Add allValidated to the state object**

In `index.html` line 524-529, add `allValidated: null` to the state object `S`:

Change:
```js
var S = {
  chs: [], fil: [], fi: 0, pid: -1, tab: 'all', grp: 'all',
  favs: new Set(JSON.parse(localStorage.getItem('lounge-tv-favs') || '[]')),
  hls: null, hlsP: null, urls: new Set(), cache: {},
  sr: [], srP: 0, srF: [], hcOn: false, hcX: false, grpQ: '', ctrlHover: false
};
```

To:
```js
var S = {
  chs: [], fil: [], fi: 0, pid: -1, tab: 'all', grp: 'all',
  favs: new Set(JSON.parse(localStorage.getItem('lounge-tv-favs') || '[]')),
  hls: null, hlsP: null, urls: new Set(), cache: {},
  sr: [], srP: 0, srF: [], hcOn: false, hcX: false, grpQ: '', ctrlHover: false,
  allValidated: null
};
```

- [ ] **Step 2: Replace the init() function**

In `index.html`, replace the existing `init()` function (lines 636-654) with a version that loads from JSON. The function becomes `async` and fetches both JSON files, merging curated URLs with channel data. Falls back to `BUILT` on failure:

```js
async function init() {
  var loaded = false;
  try {
    var responses = await Promise.all([
      fetch('data/curated.json'),
      fetch('data/channels.json')
    ]);
    var curatedRes = responses[0], channelsRes = responses[1];
    if (curatedRes.ok && channelsRes.ok) {
      var curated = await curatedRes.json();
      var allChannels = await channelsRes.json();
      var channelMap = {};
      allChannels.forEach(function(c) { channelMap[c.url] = c; });
      var chs = [];
      curated.channels.forEach(function(entry) {
        var ch = channelMap[entry.url];
        if (ch) {
          chs.push({
            name: ch.name, group: ch.group, url: ch.url,
            logo: ch.logo || '', status: ch.status || 'unk',
            id: chs.length
          });
        }
      });
      if (chs.length > 0) {
        S.chs = chs;
        S.allValidated = allChannels;
        loaded = true;
      }
    }
  } catch (e) {
    console.log('Failed to load channel data, using built-in list:', e);
  }
  if (!loaded) {
    S.chs = BUILT.map(function(c, i) {
      return {name: c.name, group: c.group, url: c.url, logo: c.logo || '', id: i, status: 'unk'};
    });
    S.allValidated = null;
  }
  S.urls = new Set(S.chs.map(function(c) { return c.url; }));
  ref();
  document.getElementById('brs').innerHTML = BRW.map(function(b) {
    return '<div class="br" data-k="' + b.k + '" onclick="pick(\'' + b.k + '\')">' + b.l + '</div>';
  }).join('');
  if (window.innerWidth <= 900) { document.getElementById('side').classList.add('closed'); updMB(); }
  var v = document.getElementById('vid');
  v.addEventListener('timeupdate', function() {
    if (!v.duration || !isFinite(v.duration)) return;
    document.getElementById('sk').value = (v.currentTime / v.duration) * 1000;
    document.getElementById('tC').textContent = fmt(v.currentTime);
    document.getElementById('tD').textContent = fmt(v.duration);
  });
  v.addEventListener('playing', function() { document.getElementById('bPl').textContent = '\u23F8'; });
  v.addEventListener('pause', function() { document.getElementById('bPl').textContent = '\u25B6'; });
  tst(S.chs.length + ' curated channels loaded.' + (S.allValidated ? '' : ' (offline mode)'), 'ok');
}
```

- [ ] **Step 3: Test locally by serving from a local HTTP server**

Run: `cd /Users/ismael.martinez/projects/github/lounge-tv && python3 -m http.server 8080`

Open `http://localhost:8080` in a browser. Verify that the curated channels load with their validation status dots already coloured (green/red/orange) instead of all showing grey "Not checked". The sidebar should show group filters matching the curated channel groups.

- [ ] **Step 4: Test fallback by temporarily renaming data directory**

Rename `data/` to `data_bak/`, reload the page. Verify the app falls back to the 25 built-in `BUILT` channels with a toast saying "(offline mode)". Rename `data_bak/` back to `data/`.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: load curated channels from JSON on startup with BUILT fallback"
```

---

### Task 4: UI — Add Validated Channel Discovery in the Find Panel

**Files:**
- Modify: `index.html` (BRW array around line 560, and the pick() function around line 968)

Add a "Validated" entry to the browse panel that shows all channels from `channels.json` with `ok` status. This is the discovery pool for finding new channels to curate.

- [ ] **Step 1: Add a Validated entry to the BRW array**

In `index.html`, add a new entry at the beginning of the `BRW` array (line 560):

Change:
```js
var BRW = [
  {k:'es',l:'\u{1F1EA}\u{1F1F8} Spain',u:'https://iptv-org.github.io/iptv/countries/es.m3u'},
```

To:
```js
var BRW = [
  {k:'_validated',l:'\u2705 Validated',u:'_local'},
  {k:'es',l:'\u{1F1EA}\u{1F1F8} Spain',u:'https://iptv-org.github.io/iptv/countries/es.m3u'},
```

- [ ] **Step 2: Handle the _validated key in the pick() function**

In `index.html`, modify the `pick()` function (around line 968) to handle the `_validated` key by loading from `S.allValidated` instead of fetching a URL:

Change:
```js
async function pick(k) {
  document.querySelectorAll('.br').forEach(function(b) { b.classList.toggle('on', b.dataset.k === k); });
  S.srP = 0;
  if (S.cache[k]) { S.sr = S.cache[k]; document.getElementById('src').textContent = ' \u2014 ' + S.sr.length; fltSR(); return; }
  document.getElementById('srl').innerHTML = '<div class="sr-ld"><div class="sp"></div> Loading...</div>';
  var item = BRW.find(function(b) { return b.k === k; });
  if (!item) return;
```

To:
```js
async function pick(k) {
  document.querySelectorAll('.br').forEach(function(b) { b.classList.toggle('on', b.dataset.k === k); });
  S.srP = 0;
  if (k === '_validated') {
    if (!S.allValidated) {
      document.getElementById('srl').textContent = 'No validation data available. Run the validation script first.';
      return;
    }
    var okChannels = S.allValidated.filter(function(c) { return c.status === 'ok'; });
    S.sr = okChannels; S.cache[k] = okChannels;
    document.getElementById('src').textContent = ' \u2014 ' + okChannels.length + ' working';
    fltSR(); return;
  }
  if (S.cache[k]) { S.sr = S.cache[k]; document.getElementById('src').textContent = ' \u2014 ' + S.sr.length; fltSR(); return; }
  document.getElementById('srl').textContent = 'Loading...';
  var item = BRW.find(function(b) { return b.k === k; });
  if (!item) return;
```

- [ ] **Step 3: Test locally**

Serve with `python3 -m http.server 8080`, open the app, click "Find", and verify the "Validated" button appears first in the browse panel. Click it and verify it shows channels with `ok` status from `channels.json`. Search within the validated results should work.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add validated channel discovery in Find panel"
```

---

### Task 5: Curate the Initial Channel List

**Files:**
- Modify: `data/curated.json`

After running the validation script in Task 1, the scaffolded `curated.json` contains the first 50 `ok` channels. This task replaces it with a hand-curated selection focused on UK channels and the best international picks.

- [ ] **Step 1: Review channels.json for UK channels with ok status**

Run: `node -e "const c=JSON.parse(require('fs').readFileSync('data/channels.json','utf8')); c.filter(x=>x.status==='ok'&&(x.country==='UK'||x.group.toLowerCase().includes('uk'))).forEach(x=>console.log(x.name,'|',x.group,'|',x.url))"`

This lists all validated UK channels. Pick the ones worth keeping.

- [ ] **Step 2: Review channels.json for top international channels**

Run: `node -e "const c=JSON.parse(require('fs').readFileSync('data/channels.json','utf8')); c.filter(x=>x.status==='ok').forEach(x=>console.log(x.name,'|',x.group,'|',x.category,'|',x.url))"`

From the full validated list, pick the best news, music, entertainment, sports, documentary, and kids channels.

- [ ] **Step 3: Update curated.json with the hand-picked selection**

Edit `data/curated.json` to contain only the URLs you've chosen, targeting 40-50 channels. Include a `note` field for any channels you know work from the UK but might fail from US-based GitHub runners:

```json
{
  "channels": [
    { "url": "https://example.com/sky-news.m3u8" },
    { "url": "https://example.com/bbc-world.m3u8", "note": "Works from UK, geo-blocked from US" }
  ]
}
```

The actual URLs will come from the channels.json output in steps 1-2. Also include the existing BUILT channels that are still working (Al Jazeera, France 24, DW News, NHK World, Sky News, ARTE, Das Erste, NASA TV, Lofi Girl, and the Spanish channels if desired).

- [ ] **Step 4: Verify the curated list loads correctly in the app**

Serve with `python3 -m http.server 8080`, reload the app, and verify the curated channels appear as the default list with correct names, groups, logos, and status dots.

- [ ] **Step 5: Commit**

```bash
git add data/curated.json
git commit -m "feat: curate initial channel list with UK focus and international picks"
```

---

### Task 6: Update ROADMAP.md

**Files:**
- Modify: `ROADMAP.md`

- [ ] **Step 1: Update the roadmap to reflect completed work**

Add a new phase between Phase 1 and Phase 1.5 documenting what was built:

After the Phase 1 section, add:

```markdown
## Phase 1.1: Curated channels with automated validation [DONE]

Replaced the 25-channel baked-in list with a curated selection of ~50 reliably working channels, primarily UK-focused with international news, music, entertainment, and sports. A Node.js validation script tests streams from iptv-org playlists and writes results to data/channels.json. A hand-edited data/curated.json defines the curated picks. A GitHub Action runs validation weekly and commits updated results. The app loads both JSON files on startup, falling back to the built-in list if offline. The Find panel includes a "Validated" filter showing all working channels from the last validation run as a discovery pool.
```

- [ ] **Step 2: Commit**

```bash
git add ROADMAP.md
git commit -m "docs: update roadmap with curated channels phase"
```
