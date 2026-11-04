import { santaNameKey as key } from '../src/lib/santaNameSearch.js';

// Pre-normalise, merge and sort ONCE per snapshot, never per keystroke. A
// lexically sorted term index avoids scanning unrelated terms, preserving
// the previous name sort and exact filename identities for duplicate labels.
export function createNameSearchIndex(hosted, local) {
  const hostedKeys = new Set(hosted.map(record => key(record.name)));
  const labels = new Map();
  for (const record of hosted) labels.set(key(record.name), (labels.get(key(record.name)) || 0) + 1);
  const records = new Map(local.filter(record => !hostedKeys.has(key(record.name))).map(record => [record.id, record]));
  for (const record of hosted) records.set(record.id, record);
  const ordered = [...records.values()].sort((a, b) => a.name.localeCompare(b.name, 'en-GB'));
  const terms = [];
  ordered.forEach((record, rank) => {
    for (const term of new Set([record.name, record.file?.slice(0, -4) || record.id,
      ...(record.aliases || [])].map(key))) terms.push({ term, rank });
  });
  terms.sort((a, b) => a.term < b.term ? -1 : a.term > b.term ? 1 : a.rank - b.rank);
  const byId = new Map(ordered.map(record => [record.id, record]));
  return {
    resolve: id => byId.get(id),
    exact: input => ordered.filter(record => key(record.name) === key(input)).slice(0, 10).map(record => {
      const { id, name, downloadName, file } = record;
      return { id, name, downloadName, ...(labels.get(key(name)) > 1 ? { variant: file } : {}) };
    }),
    search(input) {
      const prefix = key(input);
      if (!prefix) return [];
      let low = 0, high = terms.length;
      while (low < high) {
        const mid = (low + high) >>> 1;
        if (terms[mid].term < prefix) low = mid + 1; else high = mid;
      }
      const ranks = new Set();
      for (let i = low; i < terms.length && terms[i].term.startsWith(prefix); i++) ranks.add(terms[i].rank);
      return [...ranks].sort((a, b) => a - b).slice(0, 20).map(rank => {
        const { id, name, downloadName, file } = ordered[rank];
        return { id, name, downloadName, ...(labels.get(key(name)) > 1 ? { variant: file } : {}) };
      });
    },
  };
}
