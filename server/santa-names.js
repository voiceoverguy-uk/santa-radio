import { santaNameLibrary } from './santa-name-library.js';

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
    const query = url.searchParams.get('q') || '';
    if (query.length > 80 || /[\u0000-\u001f]/.test(query)) return send(400, { error: 'Please enter a first name.' });
    try { send(200, await library.search(query)); }
    catch { send(503, { error: 'The name list could not be loaded. Please try again.' }); }
  };
}

export default createSantaNamesHandler();
