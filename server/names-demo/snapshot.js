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
