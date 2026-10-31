import { santaNameLibrary } from './santa-name-library.js';
import { consumeNameAccess, privateResponse, verifyNameToken } from './santa-name-security.js';

export function createSantaNamePreviewHandler(library = santaNameLibrary, {
  limit = consumeNameAccess, verify = verifyNameToken,
} = {}) {
  return async (req, res) => {
    privateResponse(res);
    const fail = (status, error) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error }));
    };
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return fail(405, 'Use the preview control to hear a recording.');
    }
    try {
      await limit(req, 'preview');
      const url = new URL(req.url, 'http://server');
      if (url.searchParams.getAll('token').length !== 1 || [...url.searchParams.keys()].some(key => key !== 'token')) {
        return fail(403, 'Choose the recorded name again to refresh its preview.');
      }
      const id = verify(url.searchParams.get('token'), 'preview');
      if (!id) return fail(403, 'Choose the recorded name again to refresh its preview.');
      const record = await library.resolve(id);
      if (!record || record.source !== 'hosted') return fail(404, 'Preview unavailable for this recording.');
      const bytes = await library.sourceBytes(record);
      res.writeHead(200, {
        'Content-Type': /\.wav$/i.test(record.file) ? 'audio/wav' : 'audio/mpeg',
        'Content-Length': bytes.length,
        'Content-Disposition': 'inline',
        'Accept-Ranges': 'none',
      });
      res.end(bytes);
    } catch (error) {
      if (error.retryAfter) res.setHeader('Retry-After', String(error.retryAfter));
      return fail(error.status || 503, error.status === 429 ? error.message : 'The preview is temporarily unavailable. Please try again.');
    }
  };
}
export default createSantaNamePreviewHandler();
