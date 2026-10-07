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

export function createMetadataService(fetcher = fetch, ttl = 10000, { clock = Date.now, retryDelay = 500, staleMs = 45000 } = {}) {
  let cached, expires = 0, pending;
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
  return async () => {
    if (cached && clock() < expires &&
        !(cached.upcomingStatus === 'stale' && clock() - upcomingUpdatedAt >= staleMs)) return cached;
    if (pending) return pending;
    pending = (async () => {
      const [now, next] = await Promise.allSettled([
        readFeed('Nowplaying.txt', 1, fetcher),
        readUpcoming(),
      ]);
      if (now.status === 'rejected') console.warn('[radio-metadata]', 'Nowplaying.txt', now.reason?.message);
      if (next.status === 'fulfilled') {
        lastUpcoming = next.value;
        upcomingUpdatedAt = clock();
      }
      const retain = lastUpcoming.length > 0 && clock() - upcomingUpdatedAt < staleMs;
      cached = {
        current: now.status === 'fulfilled' ? now.value[0] ?? null : null,
        upcoming: next.status === 'fulfilled' ? next.value : retain ? lastUpcoming : [],
        currentStatus: now.status === 'fulfilled' && now.value.length ? 'ready' : 'unavailable',
        upcomingStatus: next.status === 'fulfilled' ? 'ready' : retain ? 'stale' : 'unavailable',
        upcomingUpdatedAt,
      };
      expires = clock() + (next.status === 'fulfilled' ? ttl : Math.min(ttl, 2000));
      return cached;
    })();
    try { return await pending; } finally { pending = null; }
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
  res.end(JSON.stringify(await getMetadata()));
}
