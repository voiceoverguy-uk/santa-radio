import { santaNameLibrary } from './santa-name-library.js';
import { santaSavedCache } from './santa-saved-cache.js';

export function createSantaGreetingHandler(library = santaNameLibrary, cache = santaSavedCache) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json');
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      res.writeHead(405).end(JSON.stringify({ available: false }));
      return;
    }
    try {
      const name = new URL(req.url, 'http://server').searchParams.get('name');
      const record = await library.resolve(name);
      const descriptor = await cache.lookup(record, library);
      res.end(JSON.stringify(descriptor ? { available: true, greeting: descriptor } : { available: false }));
    } catch { res.end(JSON.stringify({ available: false })); }
  };
}

export default createSantaGreetingHandler();
