import { trackIdentity } from '../src/lib/radio-track-identity.js';

const ROOT = 'https://stagcommunications.com/santaradio/';
const MAX_BYTES = 8192;

export function parseTracks(text, limit = 3) {
  if (typeof text !== 'string' || text.length > MAX_BYTES || /[<>]/.test(text)) {
    throw new Error('Invalid metadata');
  }
  return text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim()).map(line => {
    const separator = line.indexOf(' - ');
    const artist = line.slice(0, separator).trim();
    const title = line.slice(separator + 3).trim();
    // Automation announcements can have a title but no artist.
    if (separator < 0 || !title || line.length > 1000) throw new Error('Invalid track');
    return { artist, title };
  }).filter(({ artist, title }) => artist && !/^santa radio\b/i.test(artist) && !/^santa radio\b/i.test(title)).slice(0, limit);
}

async function readFeed(filename, limit, fetcher) {
  const url = new URL(filename, ROOT);
  url.searchParams.set('_', String(Date.now()));
  const response = await fetcher(url, { signal: AbortSignal.timeout(filename === 'Next3.txt' ? 3000 : 6000), cache: 'no-store', redirect: 'error' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (!response.headers.get('content-type')?.includes('text/plain')) throw new Error('Unexpected content type');
  const reader = response.body.getReader();
  let bytes = 0;
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) throw new Error('Feed too large');
      chunks.push(Buffer.from(value));
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text.trim()) throw new Error('Empty feed');
  const tracks = parseTracks(text, limit);
  return tracks;
}

export function createMetadataService(fetcher = fetch, ttl = 1000, { clock = Date.now, retryDelay = 500, staleMs = 45000 } = {}) {
  const current = { cached: null, expires: 0, pending: null };
  const upcoming = { cached: null, expires: 0, pending: null };
  let combined, combinedCurrent, combinedUpcoming;
  let reconciled, reconciledRaw, reconciledIdentity;
  let lastUpcoming = [], upcomingUpdatedAt = 0;
  const readUpcoming = async () => {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try { return await readFeed('Next3.txt', 3, fetcher); }
      catch (error) {
        console.warn('[radio-metadata]', 'Next3.txt', `attempt=${attempt}`, error.name, error.message);
        if (attempt === 2) throw error;
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  };
  const getCurrent = async () => {
    if (current.cached && clock() < current.expires) return current.cached;
    if (current.pending) return current.pending;
    current.pending = (async () => {
      try {
        const tracks = await readFeed('Nowplaying.txt', 1, fetcher);
        current.cached = { current: tracks[0] ?? null, currentStatus: tracks.length ? 'ready' : 'unavailable' };
      } catch (error) {
        console.warn('[radio-metadata]', 'Nowplaying.txt', error.message);
        current.cached = { current: null, currentStatus: 'unavailable' };
      }
      current.expires = clock() + (current.cached.currentStatus === 'ready' ? ttl : Math.min(ttl, 2000));
      return current.cached;
    })();
    try { return await current.pending; } finally { current.pending = null; }
  };
  const getUpcoming = async () => {
    if (upcoming.cached && clock() < upcoming.expires &&
        !(upcoming.cached.upcomingStatus === 'stale' && clock() - upcomingUpdatedAt >= staleMs)) return upcoming.cached;
    if (upcoming.pending) return upcoming.pending;
    upcoming.pending = (async () => {
      let ready = false;
      try {
        lastUpcoming = await readUpcoming();
        upcomingUpdatedAt = clock();
        ready = true;
      } catch { /* Keep only the bounded last successful queue, never current-song data. */ }
      const retain = lastUpcoming.length > 0 && clock() - upcomingUpdatedAt < staleMs;
      upcoming.cached = {
        upcoming: ready || retain ? lastUpcoming : [],
        upcomingStatus: ready ? 'ready' : retain ? 'stale' : 'unavailable',
        upcomingUpdatedAt,
      };
      upcoming.expires = clock() + (ready ? ttl : Math.min(ttl, 2000));
      return upcoming.cached;
    })();
    try { return await upcoming.pending; } finally { upcoming.pending = null; }
  };
  return async (part = 'all') => {
    if (part === 'current') return getCurrent();
    if (!['all', 'upcoming'].includes(part)) throw new Error('Invalid metadata part');
    // Upcoming-only consumers also need a current identity on a cold service.
    // Current-only requests never wait for the queue. Use the latest completed
    // current read, not an earlier snapshot captured before a slow queue read.
    await Promise.all([getCurrent(), getUpcoming()]);
    const now = current.cached;
    // A slow current read must not extend a stale queue's original deadline.
    if (upcoming.cached.upcomingStatus === 'stale' && clock() - upcomingUpdatedAt >= staleMs) {
      upcoming.cached = { ...upcoming.cached, upcoming: [], upcomingStatus: 'unavailable' };
    }
    const raw = upcoming.cached;
    const identity = trackIdentity(now.current);
    if (reconciledRaw !== raw || reconciledIdentity !== identity) {
      reconciled = identity && identity === trackIdentity(raw.upcoming[0])
        ? { ...raw, upcoming: raw.upcoming.slice(1) } : raw;
      reconciledRaw = raw;
      reconciledIdentity = identity;
    }
    const next = reconciled;
    if (part === 'upcoming') return next;
    if (combinedCurrent !== now || combinedUpcoming !== next) {
      combined = { ...now, ...next };
      combinedCurrent = now;
      combinedUpcoming = next;
    }
    return combined;
  };
}

const getMetadata = createMetadataService();
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.statusCode = 405;
    return res.end();
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const part = new URL(req.url, 'http://server').searchParams.get('part') ?? 'all';
  if (!['all', 'current', 'upcoming'].includes(part)) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'Invalid metadata part' }));
  }
  res.end(JSON.stringify(await getMetadata(part)));
}
