const ROOT = 'https://www.santaradio.co.uk/radiodocs/';
const MAX_BYTES = 8192;

export function parseTracks(text, limit = 3) {
  if (typeof text !== 'string' || text.length > MAX_BYTES || /[<>]/.test(text)) {
    throw new Error('Invalid metadata');
  }
  return text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim()).slice(0, limit).map(line => {
    const separator = line.indexOf(' - ');
    const artist = line.slice(0, separator).trim();
    const title = line.slice(separator + 3).trim();
    if (separator < 1 || !artist || !title || line.length > 1000) throw new Error('Invalid track');
    return { artist, title };
  });
}

async function readFeed(filename, limit, fetcher) {
  const url = new URL(filename, ROOT);
  url.searchParams.set('_', String(Date.now()));
  const response = await fetcher(url, { signal: AbortSignal.timeout(6000), cache: 'no-store', redirect: 'error' });
  if (!response.ok || !response.headers.get('content-type')?.includes('text/plain')) throw new Error('Feed unavailable');
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
  const tracks = parseTracks(Buffer.concat(chunks).toString('utf8'), limit);
  if (!tracks.length) throw new Error('Empty feed');
  return tracks;
}

export function createMetadataService(fetcher = fetch, ttl = 10000) {
  let cached, expires = 0, pending;
  return async () => {
    if (cached && Date.now() < expires) return cached;
    if (pending) return pending;
    pending = (async () => {
      const [now, next] = await Promise.allSettled([
        readFeed('Nowplaying.txt', 1, fetcher),
        readFeed('Next3.txt', 3, fetcher),
      ]);
      cached = {
        current: now.status === 'fulfilled' ? now.value[0] : null,
        upcoming: next.status === 'fulfilled' ? next.value : [],
        currentStatus: now.status === 'fulfilled' ? 'ready' : 'unavailable',
        upcomingStatus: next.status === 'fulfilled' ? 'ready' : 'unavailable',
      };
      expires = Date.now() + ttl;
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
