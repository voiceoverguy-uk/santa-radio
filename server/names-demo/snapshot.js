import { readFile } from 'node:fs/promises';
import { santaNameKey } from '../../src/lib/santaNameSearch.js';

export const snapshotUrl = new URL('./snapshot.json', import.meta.url);
const validName = /^[\p{L}\p{M}0-9][\p{L}\p{M}0-9 '’_-]{0,79}$/u;

export function validateSnapshot(data) {
  if (data?.version !== 1 || !Array.isArray(data.names) ||
      !data.names.length || data.names.length > 20000 ||
      data.names.some(name => typeof name !== 'string' || !validName.test(name)) ||
      new Set(data.names.map(santaNameKey)).size !== data.names.length) {
    throw new Error('Invalid private demo snapshot.');
  }
  return data.names;
}

// Bundled read-only deployment data. No origin, TTL, refresh or writable disk.
export function createDemoSearch(url = snapshotUrl) {
  let prepared;
  return async input => {
    prepared ||= readFile(url, 'utf8').then(text => {
      const names = validateSnapshot(JSON.parse(text));
      return names.map(name => ({ name, key: santaNameKey(name) }))
        .sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
    });
    const rows = await prepared;
    const prefix = santaNameKey(input);
    if ([...prefix].filter(letter => /\p{L}/u.test(letter)).length < 2) return [];
    let low = 0, high = rows.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (rows[mid].key < prefix) low = mid + 1;
      else high = mid;
    }
    const matches = [];
    for (let i = low; i < rows.length && rows[i].key.startsWith(prefix) && matches.length < 10; i++) {
      matches.push(rows[i].name);
    }
    return matches;
  };
}
