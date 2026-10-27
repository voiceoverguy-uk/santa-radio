import { santaNameLibrary, NAMES_ROOT } from './santa-name-library.js';

export function createSantaNamesHandler(library = santaNameLibrary) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return send(405, { error: 'Use the name search to find a recording.' });
    }
    const url = new URL(req.url, 'http://server');
    try { decodeURIComponent(url.search.replace(/\+/g, ' ')); }
    catch { return send(400, { error: 'The name search contains malformed UTF-8 or URL encoding.' }); }
    // The workshop filters this public inventory in the browser. Recipient
    // searches never need to appear in request URLs or server logs.
    if (url.searchParams.get('inventory') === 'hosted') {
      try {
        const hosted = await library.catalogue();
        const counts = new Map();
        for (const record of hosted) counts.set(record.name, (counts.get(record.name) || 0) + 1);
        return send(200, {
          records: hosted.map(({ id, name, file }) => ({
            id, name, previewUrl: `${NAMES_ROOT}${encodeURIComponent(file)}`,
            ...(counts.get(name) > 1 ? { variant: file } : {}),
          })).sort((a, b) => a.name.localeCompare(b.name, 'en-GB')),
          hostedCount: hosted.length, warning: null,
        });
      } catch {
        return send(503, { error: 'The hosted name list is unavailable. Please try again shortly.' });
      }
    }
    const query = url.searchParams.get('q') || '';
    if ([...query].length > 80 || /[\u0000-\u001f\u007f]/.test(query)) return send(400, { error: 'Please enter a first name.' });
    try { send(200, await library.search(query)); }
    catch { send(503, { error: 'The name list could not be loaded. Please try again.' }); }
  };
}

export default createSantaNamesHandler();
