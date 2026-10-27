import { hasWorkshopAccess } from './santa-workshop-access.js';
import { createHash } from 'node:crypto';

export const WORKSHOP_ROOT = 'https://stagcommunications.com/santaradio/names/personalised-message/';
export const WORKSHOP_INDEX = `${WORKSHOP_ROOT}workshop-index.php`;
const folders = { age: 'AGES', activity: 'Trying Hard at', achievement: 'Achievment', treat: 'treats', place: 'countries' };
const fantasyPlaces = new Set(['atlantis', 'camelot', 'cloud-cuckoo-land', 'discworld', 'emerald-city',
  'hundred-acre-wood', 'jurassic-island', 'middle-earth', 'narnia', 'neverland', 'oz', 'pandora',
  'radiator-springs', 'sodor', 'the-enchanted-forest', 'whoville', 'wonderland']);
// Real destinations in the hosted inventory which are not countries. Preserve
// their recorded filenames/labels, including the supplied "alkland" spelling.
const otherRealPlaces = new Set(['alkland-islands', 'falkland-islands', 'antarctica',
  'bermuda', 'cayman-islands', 'dubai', 'faroe-islands', 'gibraltar', 'greenland',
  'guernsey', 'hong-kong', 'isle-of-man', 'jersey', 'montserrat', 'puffin-island',
  'us-virgin-islands', 'western-sahara', 'yorkshire']);
const technicalFiles = new Set(['countries/1b.wav', 'countries/Santa Audio messages Raw File EQ_01.wav']);
const destinationPriority = new Map([
  ['countries/england.wav', 0],
  ['countries/scotland.wav', 1],
  ['countries/ireland.wav', 2],
  ['countries/wales.wav', 3],
  ['countries/united-states.wav', 4],
]);
const labels = {
  'buche-de-noel': 'Bûche de Noël', turron: 'Turrón', 'personal-hygene': 'Personal hygiene',
  'carrotts-for-reindeer': 'Carrots for reindeer', 'some-carrotts': 'Some carrots',
  'playing-on-ipad': 'Playing on iPad', 't-b-l': 'T-B-L', 'santa\'s-sake': 'Santa’s sake',
};
const title = stem => labels[stem] || stem.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim()
  .replace(/^\p{L}/u, character => character.toLocaleUpperCase('en-GB'));

export function parseWorkshopCatalogue(input) {
  if (!input || input.version !== 1 || !input.categories || typeof input.categories !== 'object') {
    throw new Error('Unsupported workshop inventory.');
  }
  const categories = {}, counts = {}, excludedAudioCounts = {}, needsReviewCounts = {};
  const seen = new Set();
  for (const [key, folder] of Object.entries(folders)) {
    const source = input.categories[key];
    const excluded = input.excludedAudioCounts?.[key];
    if (!Array.isArray(source) || !source.length || source.length > 10000 ||
        !Number.isSafeInteger(excluded) || excluded < 0 || excluded > 10000) {
      throw new Error('Incomplete workshop inventory.');
    }
    excludedAudioCounts[key] = excluded;
    needsReviewCounts[key] = 0;
    const records = [];
    for (const item of source) {
      if (!item || typeof item.file !== 'string' || !item.file.startsWith(`${folder}/`)) {
        throw new Error('Invalid workshop recording path.');
      }
      const basename = item.file.slice(folder.length + 1);
      if (Buffer.byteLength(basename) > 240 || basename.startsWith('.') ||
          /[/\\\p{Cc}\p{Cf}]/u.test(basename) || !/\.(wav|mp3)$/i.test(basename) ||
          item.id !== `c-${createHash('sha256').update(item.file).digest('hex')}` ||
          seen.has(item.id) || !Number.isSafeInteger(item.bytes) || item.bytes < 0 || item.bytes > 20 * 1024 * 1024) {
        throw new Error('Invalid workshop recording identity.');
      }
      seen.add(item.id);
      if (technicalFiles.has(item.file) || item.bytes === 0) { needsReviewCounts[key]++; continue; }
      const stem = basename.slice(0, -4);
      const record = { id: item.id, file: item.file, label: title(stem) };
      if (key === 'age') {
        const age = stem.match(/^(\d{1,3})-(month|year)s?(?:-old)?$/i);
        if (!age || Number(age[1]) > 120) { needsReviewCounts[key]++; continue; }
        record.number = Number(age[1]);
        record.unit = age[2].toLowerCase();
        record.label = `${record.number} ${record.unit}${record.number === 1 ? '' : 's'} old`;
      }
      if (key === 'place') {
        record.label = title(stem).replace(/\b[\p{L}\p{M}]+/gu, (word, offset) =>
          offset && ['and', 'of', 'the'].includes(word.toLowerCase()) ? word.toLowerCase()
            : word[0].toLocaleUpperCase('en-GB') + word.slice(1));
        record.kind = fantasyPlaces.has(stem) ? 'fantasy' : ['mars', 'the-moon'].includes(stem) ? 'space' : 'place';
        record.isCountry = record.kind === 'place' && !otherRealPlaces.has(stem.toLowerCase().replace(/[_ ]+/g, '-'));
        if (record.kind === 'fantasy') record.label += ' — Fantasy place';
        if (record.kind === 'space') record.label += ' — Space destination';
      }
      if (!record.label || record.label.length > 260) throw new Error('Invalid workshop label.');
      records.push(record);
    }
    // Different source files never become one choice, even if their labels match.
    const labelCounts = new Map();
    for (const record of records) labelCounts.set(record.label, (labelCounts.get(record.label) || 0) + 1);
    for (const record of records) if (labelCounts.get(record.label) > 1) {
      record.label += ` (${record.file.slice(folder.length + 1)})`;
    }
    records.sort((a, b) => key === 'age'
      ? (a.number * (a.unit === 'year' ? 12 : 1) - b.number * (b.unit === 'year' ? 12 : 1)) ||
        a.unit.localeCompare(b.unit) || a.file.localeCompare(b.file)
      : (key === 'place' ? (destinationPriority.get(a.file) ?? (a.kind === 'place' ? 5 : 6)) -
          (destinationPriority.get(b.file) ?? (b.kind === 'place' ? 5 : 6)) : 0)
        || a.label.localeCompare(b.label, 'en-GB', { numeric: true, sensitivity: 'base' }) || a.file.localeCompare(b.file));
    if (!records.length) throw new Error('No usable recordings in workshop category.');
    categories[key] = records;
    counts[key] = records.length;
  }
  return { source: 'hosted', categories, counts, excludedAudioCounts, needsReviewCounts };
}

async function readIndex(fetcher) {
  const response = await fetcher(WORKSHOP_INDEX, {
    signal: AbortSignal.timeout(10000), redirect: 'error',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok || !/\bapplication\/json\b/i.test(response.headers.get('content-type') || '')) {
    throw new Error('Hosted workshop inventory unavailable.');
  }
  const limit = 2 * 1024 * 1024;
  if (Number(response.headers.get('content-length')) > limit || !response.body) throw new Error('Invalid workshop inventory size.');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new Error('Workshop inventory too large.');
      chunks.push(Buffer.from(value));
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally { reader.releaseLock(); }
  return parseWorkshopCatalogue(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))));
}

export function createWorkshopCatalogue({ fetcher = fetch, clock = Date.now, ttl = 5 * 60 * 1000 } = {}) {
  let cached = null, expires = 0, pending = null;
  return async () => {
    if (cached && clock() < expires) return cached;
    if (!pending) {
      pending = readIndex(fetcher).then(data => {
        cached = data;
        expires = clock() + ttl;
        return data;
      }).finally(() => { pending = null; });
    }
    return pending;
  };
}

export const workshopCatalogue = createWorkshopCatalogue();
export function createWorkshopCatalogueHandler(load = workshopCatalogue, authorize = hasWorkshopAccess) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    const send = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(data));
    };
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return send(405, { error: 'Use GET to load Santa’s workshop choices.' });
    }
    if (!authorize(req)) return send(403, { error: 'Enter a valid tester code to open Santa’s Studio.', code: 'STUDIO_ACCESS_REQUIRED' });
    try { return send(200, await load()); }
    catch { return send(503, { error: 'Santa’s recorded choices could not be loaded. Please try again.' }); }
  };
}
export default createWorkshopCatalogueHandler();
