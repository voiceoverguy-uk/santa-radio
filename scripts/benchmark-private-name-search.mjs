import { performance } from 'node:perf_hooks';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createNameLibrary } from '../server/santa-name-library.js';
import { consumeNameAccess } from '../server/santa-name-security.js';
import { withNameDatabase, nameFixture } from './helpers/private-name-fixture.mjs';

const mode = process.argv.includes('--baseline') ? 'baseline' : 'after';
const baselineRef = '3788b8499d273b0da041989208b1e43f662715b3';
async function historicalModule(path) {
  const source = execFileSync('git', ['show', `${baselineRef}:${path}`], { encoding: 'utf8' });
  const base = new URL(`../${path}`, import.meta.url);
  const rewritten = source.replace(/from (['"])([^'"]+)\1/g, (_, quote, specifier) =>
    `from ${quote}${specifier.startsWith('.') ? new URL(specifier, base).href : import.meta.resolve(specifier)}${quote}`);
  return import(`data:text/javascript;base64,${Buffer.from(rewritten).toString('base64')}`);
}
const makeLibrary = mode === 'baseline'
  ? (await historicalModule('server/santa-name-library.js')).createNameLibrary : createNameLibrary;
const limit = mode === 'baseline'
  ? (await historicalModule('server/santa-name-security.js')).consumeNameAccess : consumeNameAccess;
const fixture = nameFixture();
const key = 'isolated-benchmark-signing-key-not-a-live-credential';
const times = [], databaseTimes = [], searchTimes = [];
let queries = 0, originFetches = 0, sampleCommands = 0, coldReuse;
await withNameDatabase(async real => {
  const pool = {
    async connect() {
      const client = await real.connect();
      return { query: async (...args) => { queries++; return client.query(...args); }, release: () => client.release() };
    },
    async query(...args) { queries++; return real.query(...args); },
  };
  let library;
  const fetcher = async () => { originFetches++; return new Response(fixture); };
  if (mode === 'baseline') library = makeLibrary({ fetcher });
  else {
    const { createNameSnapshotStore } = await import('../server/santa-name-snapshot.js');
    const { parseNameIndex } = await import('../server/santa-name-library.js');
    const store = createNameSnapshotStore({ pool: () => pool, parse: parseNameIndex, fetchIndex: async () => {
      originFetches++; return fixture;
    } });
    library = createNameLibrary({ snapshotStore: store });
  }
  for (let i = 0; i < 16; i++) {
    const start = performance.now();
    const hint = await limit({ headers: {}, socket: { remoteAddress: `fixture-${i}` } }, 'search', { pool, key });
    const limited = performance.now();
    await library.search(i % 2 ? 'Daniel' : 'Anna', hint);
    const end = performance.now();
    times.push(end - start); databaseTimes.push(limited - start); searchTimes.push(end - limited);
  }
  sampleCommands = queries;
  if (mode === 'after') {
    const { createNameSnapshotStore } = await import('../server/santa-name-snapshot.js');
    const { parseNameIndex } = await import('../server/santa-name-library.js');
    const cold = createNameLibrary({ snapshotStore: createNameSnapshotStore({
      pool: () => pool, parse: parseNameIndex, fetchIndex: async () => {
        originFetches++; return fixture;
      },
    }) });
    const beforeQueries = queries, beforeFetches = originFetches, start = performance.now();
    const hint = await limit({ headers: {}, socket: { remoteAddress: 'fresh-instance-fixture' } }, 'search', { pool, key });
    await cold.search('Anna', hint);
    coldReuse = { evidence: 'new library/store instance in same process, NOT Vercel cold start',
      totalMs: +(performance.now() - start).toFixed(2), databaseCommands: queries - beforeQueries,
      originFetches: originFetches - beforeFetches };
  }
}, { snapshotSchema: mode !== 'baseline' });
const stats = values => {
  const sorted = values.slice(1).sort((a, b) => a - b);
  return { firstMs: +values[0].toFixed(2), warmMedianMs: +sorted[Math.floor(sorted.length / 2)].toFixed(2),
    warmP95Ms: +sorted[Math.floor(sorted.length * .95)].toFixed(2) };
};
const result = { evidence: 'isolated local PostgreSQL and synthetic 9700-record origin; NOT production or Vercel cold-start timing',
  mode, baselineRef, debounceMsExcluded: 200, requests: times.length, databaseCommands: sampleCommands, originFetches, coldReuse,
  total: stats(times), limiter: stats(databaseTimes), search: stats(searchTimes) };
await mkdir('generated-artifacts/private-name-search', { recursive: true });
await writeFile(`generated-artifacts/private-name-search/${mode}.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
