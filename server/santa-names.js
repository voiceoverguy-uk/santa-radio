import { santaNameLibrary } from './santa-name-library.js';
import { BLOCKED_NAME_NOTE, isBlockedName } from '../src/lib/nameLanguage.js';
import { consumeNameAccess, issueNameToken, privateResponse, readNameJson, SEARCH_LIMIT, SEARCH_MIN_LENGTH } from './santa-name-security.js';
import { nameDiagnostic } from './santa-name-diagnostic.js';

export function createSantaNamesHandler(library = santaNameLibrary, {
  limit = consumeNameAccess, token = issueNameToken,
} = {}) {
  return async (req, res) => {
    privateResponse(res);
    const send = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };
    const url = new URL(req.url, 'http://server');
    // No public bulk mode, including alternate values/empty flags/extra params.
    if ([...url.searchParams.keys()].length) return send(403, { error: 'Bulk inventory and URL-based name searches are not public.' });
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return send(405, { error: 'Enter at least two letters to search for a recording.' });
    }
    try {
      const hint = await limit(req, 'search');
      const data = await readNameJson(req);
      const query = typeof data.query === 'string' ? data.query.normalize('NFKC').trim() : '';
      if (Object.keys(data).some(key => !['query', 'exact'].includes(key)) ||
          (data.exact !== undefined && data.exact !== true) || [...query].length < SEARCH_MIN_LENGTH ||
          [...query].length > 80) {
        return send(400, { error: 'Enter at least two letters of a first name, without wildcards.' });
      }
      if (isBlockedName(query)) return send(400, { error: BLOCKED_NAME_NOTE });
      if (!/^[\p{L}\p{M}][\p{L}\p{M} '’\-]*$/u.test(query)) {
        return send(400, { error: 'Enter at least two letters of a first name, without wildcards.' });
      }
      const result = await library.search(query, hint, { exact: data.exact === true });
      // Explicit projection: never return audio locations, filenames, aliases or counts.
      const records = result.records.slice(0, SEARCH_LIMIT).map(({ id, name, downloadName, variant }, index) => ({
        id, name, downloadName, ...(variant ? { variant: `Recording ${index + 1}` } : {}),
        selectionToken: token(id, 'message'),
        previewUrl: `/api/santa-name-preview?token=${encodeURIComponent(token(id, 'preview'))}`,
      }));
      return send(200, { records, warning: result.warning || null });
    } catch (error) {
      if (!error.status) nameDiagnostic('search', error);
      if (error.retryAfter) res.setHeader('Retry-After', String(error.retryAfter));
      return send(error.status || 503, { error: error.status ? error.message : 'The name search is temporarily unavailable. Please try again.' });
    }
  };
}
export default createSantaNamesHandler();
