const STORE_KEY = 'santa-name-request-tokens-v1';
const lifetime = 7 * 86400000;
const fallback = new Map();
function newIdentifier() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  return [...bytes].map(value => value.toString(16).padStart(2, '0')).join('')
    .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
}

// Reuse across both maker pages and retries, including a lost first response.
export function nameRequestToken(key) {
  let entries, remembered = true;
  try { entries = JSON.parse(sessionStorage.getItem(STORE_KEY) || '[]'); }
  catch { remembered = false; entries = [...fallback]; }
  if (!Array.isArray(entries)) entries = [];
  const now = Date.now();
  const cache = new Map([...fallback, ...entries].filter(entry => Array.isArray(entry) &&
    typeof entry[0] === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(entry[1]?.id || '') &&
    entry[1].expires > now));
  if (!cache.has(key)) cache.set(key, { id: newIdentifier(), expires: now + lifetime });
  const token = cache.get(key);
  fallback.set(key, token);
  try { sessionStorage.setItem(STORE_KEY, JSON.stringify([...cache].slice(-100))); }
  catch { remembered = false; }
  return { id: token.id, remembered };
}
