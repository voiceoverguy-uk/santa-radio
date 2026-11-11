import { santaNameKey } from './santaNameSearch.js';

let pending;

// One automatically refreshed, names-only download shared by every checker in this tab.
// A failed load is not cached: the existing Retry controls can try again.
export function loadBrowserSantaNames(request = fetch) {
  if (!pending) {
    pending = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await request('/names-data/latest.json', { signal: controller.signal, cache: 'no-cache' });
        if (!response.ok) throw new Error('The names list could not be loaded. Please retry.');
        const names = await response.json();
        if (!Array.isArray(names) || !names.length || names.some(name =>
          typeof name !== 'string' || !name.trim() || name.length > 80)) {
          throw new Error('The names list is invalid. Please retry.');
        }
        return names.map(name => ({ id: `display:${name}`, name, key: santaNameKey(name), displayOnly: true }))
          .sort((a, b) => a.name.localeCompare(b.name, 'en-GB'));
      } finally { clearTimeout(timeout); }
    })().catch(error => { pending = undefined; throw error; });
  }
  return pending;
}

export function matchBrowserSantaNames(names, query) {
  const key = santaNameKey(query);
  if ([...key].length < 2) return [];
  const matches = [];
  for (const record of names) {
    if (record.key.startsWith(key)) matches.push(record);
    if (matches.length === 10) break;
  }
  return matches;
}

// Only an explicit Studio selection asks for recording identities/capabilities.
// The public list itself never contains these or any audio locations.
export async function resolveBrowserSantaName(name, { signal, request = fetch } = {}) {
  const response = await request('/api/santa-names', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: name, exact: true }), signal,
    credentials: 'same-origin', cache: 'no-store',
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'The recording could not be checked. Please retry.');
  if (data.warning) throw new Error(data.warning);
  if (!Array.isArray(data.records) || !data.records.length || data.records.length > 10 ||
      data.records.some(record => typeof record.id !== 'string' ||
        typeof record.name !== 'string' || santaNameKey(record.name) !== santaNameKey(name) ||
        typeof record.selectionToken !== 'string' ||
        !/^\/api\/santa-name-preview\?token=[A-Za-z0-9_.%-]+$/.test(record.previewUrl))) {
    throw new Error('That recording is no longer available. Please choose another name or retry.');
  }
  return data.records;
}
