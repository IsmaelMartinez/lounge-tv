import { writeFileSync, existsSync, mkdirSync } from 'fs';
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

const TIMEOUT = 6000;
const DELAY = 100;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve('fail'), ms))
  ]);
} // ms between requests

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
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    clearTimeout(timer);
    if (res.status === 403 || res.status === 451 || res.status === 410) return 'geo';
    if (!res.ok) return 'fail';

    const body = await res.text();
    if (body.includes('#EXTM3U') || body.includes('#EXT-X-')) {
      const segmentUrl = extractFirstSegment(body, url);
      if (segmentUrl) {
        return await testSegment(segmentUrl);
      }
    }
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
    ch.status = await withTimeout(testStream(ch.url), TIMEOUT + 2000);
    ch.lastChecked = now;
    const pct = Math.round(((i + 1) / allChannels.length) * 100);
    const icon = ch.status === 'ok' ? '+' : ch.status === 'geo' ? '!' : '-';
    console.log(`  [${pct}%] ${icon} ${ch.name} — ${ch.status}`);
    if (i < allChannels.length - 1) await sleep(DELAY);
  }

  writeFileSync(CHANNELS_PATH, JSON.stringify(allChannels, null, 2) + '\n');
  const ok = allChannels.filter(c => c.status === 'ok').length;
  const geo = allChannels.filter(c => c.status === 'geo').length;
  const fail = allChannels.filter(c => c.status === 'fail').length;
  console.log(`\nResults: ${ok} ok, ${geo} geo, ${fail} fail — written to data/channels.json`);

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
