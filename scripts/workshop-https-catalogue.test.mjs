import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createWorkshopCatalogue, createWorkshopCatalogueHandler, parseWorkshopCatalogue, WORKSHOP_INDEX } from '../server/santa-workshop-catalogue.js';

const record = file => ({ file, bytes: 50000, id: `c-${createHash('sha256').update(file).digest('hex')}` });
const inventory = () => ({
  version: 1,
  categories: {
    age: ['50-years-old', '1-year', '12-months', '0-months', '1-months', '9-year'].map(name => record(`AGES/${name}.wav`)),
    activity: [record('Trying Hard at/playing-on-ipad.wav')],
    achievement: [record('Achievment/helping-your-mummy.wav')],
    treat: ['buche-de-noel', 'pfeffernüsse', "santa's-sake"].map(name => record(`treats/${name}.wav`)),
    place: ['the-enchanted-forest', 'new zealand', 'the-moon', '1b', 'Santa Audio messages Raw File EQ_01'].map(name => record(`countries/${name}.wav`)),
  },
  excludedAudioCounts: { age: 0, activity: 0, achievement: 0, treat: 0, place: 0 },
});
test('HTTPS catalogue preserves exact identities, correctly labels/sorts months and years, marks fantasy places and discloses raw files held for review', () => {
  const input = inventory(), output = parseWorkshopCatalogue(input);
  assert.equal(output.source, 'hosted');
  assert.deepEqual(output.categories.age.map(item => item.label), [
    '0 months old', '1 month old', '12 months old', '1 year old', '9 years old', '50 years old',
  ]);
  assert.equal(output.categories.activity[0].label, 'Playing on iPad');
  assert.equal(output.categories.treat.find(item => item.file.includes('buche')).label, 'Bûche de Noël');
  assert.equal(output.categories.treat.find(item => item.file.includes('pfeffernüsse')).file, 'treats/pfeffernüsse.wav');
  assert.equal(output.categories.treat.find(item => item.file.includes("santa's")).label, 'Santa’s sake');
  assert.equal(output.categories.place.find(item => item.kind === 'fantasy').label, 'The Enchanted Forest — Fantasy place');
  assert.equal(output.categories.place.find(item => item.kind === 'place').label, 'New Zealand');
  assert.equal(output.categories.place.find(item => item.kind === 'space').label, 'The Moon — Space destination');
  assert.equal(output.counts.place, 3);
  assert.equal(output.needsReviewCounts.place, 2);
  assert.deepEqual(output.categories.activity[0].id, input.categories.activity[0].id);
});

test('invalid paths, identities, duplicate IDs, missing categories and invalid counts cannot silently become a partial catalogue', () => {
  const mutations = [
    data => { data.version = 2; },
    data => { delete data.categories.age; },
    data => { data.categories.age = []; },
    data => { data.categories.treat[0].id = 'untrusted'; },
    data => { data.categories.treat[0] = record('treats/../secret.wav'); },
    data => { data.categories.treat[0] = record('treats/folder\\secret.wav'); },
    data => { data.categories.treat[0] = record('treats/.hidden.wav'); },
    data => { data.categories.treat[0] = record('AGES/1-year.wav'); },
    data => { data.categories.treat.push(data.categories.treat[0]); },
    data => { data.categories.treat[0].bytes = -1; },
    data => { data.categories.treat[0].bytes = 21 * 1024 * 1024; },
    data => { data.excludedAudioCounts.age = '0'; },
  ];
  for (const mutate of mutations) { const data = inventory(); mutate(data); assert.throws(() => parseWorkshopCatalogue(data)); }
  const data = inventory();
  data.categories.age.push(record('AGES/unlabelled-take.wav'));
  data.excludedAudioCounts.treat = 1;
  const parsed = parseWorkshopCatalogue(data);
  assert.equal(parsed.needsReviewCounts.age, 1);
  assert.equal(parsed.excludedAudioCounts.treat, 1);
});

test('duplicate display labels stay separate choices with exact filenames', () => {
  const data = inventory();
  data.categories.age.push(record('AGES/1-years-old.wav'));
  const parsed = parseWorkshopCatalogue(data);
  const variants = parsed.categories.age.filter(item => item.number === 1 && item.unit === 'year');
  assert.equal(variants.length, 2);
  assert.equal(new Set(variants.map(item => item.label)).size, 2);
  assert.notEqual(variants[0].id, variants[1].id);
});

test('destinations put priority countries first, then alphabetical real places, with fantasy and space last', () => {
  const data = inventory();
  data.categories.place.push(...['united-states', 'wales', 'ireland', 'scotland', 'england', 'andorra', 'northern-ireland'].map(name => record(`countries/${name}.wav`)));
  const places = parseWorkshopCatalogue(data).categories.place;
  assert.deepEqual(places.slice(0, 5).map(item => item.label), ['England', 'Scotland', 'Ireland', 'Wales', 'United States']);
  assert.deepEqual(places.slice(5).map(item => item.label), [
    'Andorra', 'New Zealand', 'Northern Ireland', 'The Enchanted Forest — Fantasy place', 'The Moon — Space destination',
  ]);
  data.categories.place = data.categories.place.filter(item => !item.file.endsWith('/england.wav'));
  const missing = parseWorkshopCatalogue(data).categories.place;
  assert.equal(missing[0].label, 'Scotland');
  assert.ok(!missing.some(item => item.label === 'England'));
  assert.ok(!missing.some(item => item.label === 'United Kingdom'));
});

test('cities, regions and territories stay with real countries before fantasy and space, preserving recording identities', () => {
  const data = inventory();
  const otherPlaces = ['antarctica', 'dubai', 'bermuda', 'isle-of-man', 'yorkshire', 'alkland-islands',
    'jersey', 'guernsey', 'gibraltar', 'greenland', 'hong-kong', 'faroe-islands',
    'cayman-islands', 'montserrat', 'puffin-island', 'us-virgin-islands', 'western-sahara'];
  data.categories.place.push(...['england', 'zimbabwe', 'atlantis', 'mars', ...otherPlaces].map(stem => record(`countries/${stem}.wav`)));
  const places = parseWorkshopCatalogue(data).categories.place;
  assert.deepEqual(places.filter(item => item.isCountry).map(item => item.label), ['England', 'New Zealand', 'Zimbabwe']);
  const firstImaginary = places.findIndex(item => item.kind !== 'place');
  assert.ok(firstImaginary > 0);
  assert.ok(places.slice(0, firstImaginary).every(item => item.kind === 'place'));
  assert.ok(places.slice(firstImaginary).every(item => ['fantasy', 'space'].includes(item.kind)));
  for (const group of [places.slice(1, firstImaginary), places.slice(firstImaginary)]) {
    assert.deepEqual(group.map(item => item.label), [...group].sort((a, b) =>
      a.label.localeCompare(b.label, 'en-GB', { numeric: true, sensitivity: 'base' })).map(item => item.label));
  }
  for (const stem of otherPlaces) {
    const expected = record(`countries/${stem}.wav`);
    const actual = places.find(item => item.id === expected.id);
    assert.equal(actual.file, expected.file);
    assert.equal(actual.kind, 'place');
    assert.equal(actual.isCountry, false);
    assert.ok(places.indexOf(actual) < firstImaginary);
  }
  assert.equal(places.find(item => item.file === 'countries/alkland-islands.wav').label, 'Alkland Islands');
  assert.equal(places.find(item => item.file === 'countries/atlantis.wav').kind, 'fantasy');
  assert.equal(places.find(item => item.file === 'countries/mars.wav').kind, 'space');
  assert.equal(places.length, data.categories.place.length - 2);
});

test('hosted lookup uses one fixed HTTPS index, coalesces requests and refreshes after TTL with no stale/sample fallback', async () => {
  let calls = 0, time = 0, broken = false;
  const load = createWorkshopCatalogue({ clock: () => time, ttl: 100, fetcher: async (url, options) => {
    calls++;
    assert.equal(url, WORKSHOP_INDEX);
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    await new Promise(resolve => setTimeout(resolve, 5));
    if (broken) throw new Error('fixture failure');
    return Response.json(inventory());
  } });
  const [a, b] = await Promise.all([load(), load()]);
  assert.deepEqual(a, b); assert.equal(calls, 1);
  await load(); assert.equal(calls, 1);
  time = 101; broken = true; await assert.rejects(load()); assert.equal(calls, 2);
  broken = false; await load(); assert.equal(calls, 3);
});

test('HTML, bad JSON/UTF8, oversized and failed remote inventories fail explicitly', async () => {
  for (const response of [
    new Response('WordPress error', { status: 500 }),
    new Response('<html>Not a catalogue</html>', { headers: { 'Content-Type': 'text/html' } }),
    new Response('not JSON', { headers: { 'Content-Type': 'application/json' } }),
    new Response(Uint8Array.from([0xff]), { headers: { 'Content-Type': 'application/json' } }),
    new Response('{}', { headers: { 'Content-Type': 'application/json', 'Content-Length': '3000000' } }),
    new Response(' '.repeat(2 * 1024 * 1024 + 1), { headers: { 'Content-Type': 'application/json' } }),
    Response.json({ version: 1, names: [] }),
  ]) {
    await assert.rejects(createWorkshopCatalogue({ fetcher: async () => response })());
  }
});

test('catalogue endpoint is read-only, ignores recipient queries and has safe failure/noindex headers', async () => {
  let calls = 0;
  const handler = createWorkshopCatalogueHandler(async () => { calls++; return parseWorkshopCatalogue(inventory()); });
  const run = async (method = 'GET', fn = handler) => {
    const result = { headers: {} };
    await fn({ method, url: '/?name=MustNotBeForwarded&age=5' }, {
      setHeader(key, value) { result.headers[key.toLowerCase()] = value; },
      writeHead(status, headers) { result.status = status; Object.assign(result.headers, headers); },
      end(body) { result.data = JSON.parse(body); },
    });
    return result;
  };
  assert.equal((await run()).status, 200);
  assert.equal(calls, 1);
  assert.equal((await run('POST')).status, 405);
  assert.equal(calls, 1);
  const failure = await run('GET', createWorkshopCatalogueHandler(async () => { throw Error('private path /secret'); }));
  assert.equal(failure.status, 503);
  assert.equal(failure.headers['cache-control'], 'no-store');
  assert.equal(failure.headers['x-robots-tag'], 'noindex, nofollow');
  assert.doesNotMatch(JSON.stringify(failure.data), /secret/);
  assert.ok(!failure.data.categories);
});
