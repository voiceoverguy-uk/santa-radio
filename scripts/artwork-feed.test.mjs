import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as mapping from '../src/data/artistArtwork.js';
import { songArtwork, songPortraits } from '../src/data/songArtwork.js';
import { buildArtworkFeed } from '../server/artwork-feed.js';

test('Sam Ryder keeps his shared artwork path with a new content version after cropping', async () => {
  const path = '/artist-artwork/sam-ryder.webp';
  const bytes = await readFile(`public${path}`);
  const feed = await buildArtworkFeed(mapping);
  const entry = feed.artists['sam ryder'];
  const version = createHash('sha256').update(bytes).digest('hex');
  assert.equal(mapping.artistArtwork('Sam Ryder'), path);
  assert.equal(entry.path, path);
  assert.equal(entry.version, version);
  assert.equal(entry.url, `${path}?v=${version}`);
  // Original white-rimmed WebP: changing bytes, not the URL contract, clears caches.
  assert.notEqual(version, 'cea5319e6220af6276ab738749c1c721f9bdf65b92eeb44c468e9b96cd69bcb4');
  assert.ok(bytes.length < 100000);
});

test('Greg Lake replacement stays shared and advertises the replacement bytes', async () => {
  const songs = JSON.parse(await readFile('src/data/songs.json', 'utf8'));
  const song = songs.find(song => song.artist === 'Greg Lake');
  assert.equal(song.song, 'I Believe In Father Christmas');
  assert.equal(Object.hasOwn(songPortraits, song.id), false);
  const path = '/artist-artwork/greg-lake.webp';
  assert.equal(mapping.artistArtwork('  GREG  LAKE  '), path);
  assert.equal(songArtwork(song), path);
  const bytes = await readFile(`public${path}`);
  const version = createHash('sha256').update(bytes).digest('hex');
  // Pin the supplied illustration, not the previous beige portrait.
  assert.equal(version, 'cba78ed5ba483d0ee64eec28aa8112185ad2ebfdc30fed44e68930aa36b2d148');
  assert.notEqual(version, '8702f179b6a42e80d2a4b952c3fd8220187064221f26bfc850a1e6a4cab68219');
  const feed = await buildArtworkFeed(mapping);
  assert.deepEqual(feed.artists['greg lake'], { path, version, url: `${path}?v=${version}` });
});

test('Corinne Bailey Rae uses her supplied portrait in the catalogue and shared artwork feed', async () => {
  const songs = JSON.parse(await readFile('src/data/songs.json', 'utf8'));
  const artistSongs = songs.filter(song => song.artist === 'Corinne Bailey Rae');
  assert.ok(artistSongs.length > 0);
  const path = '/artist-artwork/corinne-bailey-rae.webp';
  for (const song of artistSongs) assert.equal(mapping.artistArtwork(song.artist), path);
  assert.equal(mapping.artistArtwork('  CORINNE  BAILEY RAE  '), path);
  const image = await readFile(`public${path}`);
  assert.equal(image.subarray(8, 12).toString(), 'WEBP');
  assert.ok(image.length < 100000);
  const feed = await buildArtworkFeed(mapping);
  assert.equal(feed.artists['corinne bailey rae'].path, path);
});

test('five supplied portraits match the existing songs and versioned feed', async () => {
  const songs = JSON.parse(await readFile('src/data/songs.json', 'utf8'));
  const feed = await buildArtworkFeed(mapping);
  const expected = [
    ['Bill Nighy', 'bill-nighy'],
    ['Aloe Blacc', 'aloe-blacc'],
    ['Elsa and Anna', 'elsa-and-anna'],
    ['Bing Crosby & Rosemary Clooney', 'bing-crosby-and-rosemary-clooney'],
    ['Gregory Porter', 'gregory-porter'],
  ];
  for (const [artist, filename] of expected) {
    assert.ok(songs.some(song => song.artist === artist), `${artist} has an existing song`);
    const path = `/artist-artwork/${filename}.webp`;
    assert.equal(mapping.artistArtwork(artist), path);
    const image = await readFile(`public${path}`);
    assert.equal(image.subarray(8, 12).toString(), 'WEBP');
    assert.ok(image.length < 100000, `${artist} image is optimised`);
    assert.equal(feed.artists[mapping.normalizeArtistName(artist)].path, path);
  }
  assert.equal(mapping.artistArtwork('Elsa & Anna'), mapping.artistArtwork('Elsa and Anna'));
  assert.equal(mapping.artistArtwork('Bing Crosby and Rosemary Clooney'), mapping.artistArtwork('Bing Crosby & Rosemary Clooney'));
  assert.equal(mapping.artistArtwork('Bing Crosby'), '/artist-artwork/bing-crosby.webp');
  assert.equal(mapping.artistArtwork('Rosemary Clooney'), mapping.fallbackArtwork);
});

test('Sia replacement is shared across her songs and invalidates cached artwork', async () => {
  const current = await buildArtworkFeed(mapping);
  const previous = await buildArtworkFeed({
    ...mapping,
    artistArtwork: artist => mapping.normalizeArtistName(artist) === 'sia'
      ? '/artist-artwork/sia.webp' : mapping.artistArtwork(artist),
  });
  assert.equal(mapping.artistArtwork('Sia'), '/artist-artwork/sia-festive.webp');
  assert.equal(current.artists.sia.path, mapping.artistArtwork('Sia'));
  assert.notEqual(current.artists.sia.version, previous.artists.sia.version);
  assert.notEqual(current.version, previous.version);
  const songs = JSON.parse(await readFile('src/data/songs.json', 'utf8'));
  const siaSongs = songs.filter(song => mapping.normalizeArtistName(song.artist) === 'sia');
  assert.ok(siaSongs.length > 0);
  for (const song of siaSongs) assert.equal(mapping.artistArtwork(song.artist), current.artists.sia.path);
});

test('feed covers every mapping and approved alias without changing website URLs', async () => {
  const feed = await buildArtworkFeed(mapping);
  assert.equal(feed.schemaVersion, 1);
  assert.equal(feed.refreshAfterSeconds, 300);
  assert.equal(feed.fallback.path, mapping.fallbackArtwork);
  const songs = JSON.parse(await readFile('src/data/songs.json', 'utf8'));
  const keys = [...new Set([...Object.keys(mapping.artistPortraits), ...songs.map(song => mapping.normalizeArtistName(song.artist))])].sort();
  assert.deepEqual(Object.keys(feed.artists).sort(), keys);
  for (const [artist, image] of Object.entries(feed.artists)) {
    assert.equal(image.path, mapping.artistArtwork(artist));
    assert.match(image.version, /^[a-f0-9]{64}$/);
    assert.equal(image.url, `${image.path}?v=${image.version}`);
    const resolved = new URL(image.url, 'https://example.test/artist-artwork/catalogue.json');
    assert.equal(resolved.origin, 'https://example.test');
    assert.equal(resolved.pathname, image.path);
  }
  for (const artist of ['Chris Kamara', 'Liam Gallagher', 'Gary Barlow', 'Backstreet Boys',
    'Bryan Adams', 'Christina Aguilera', 'John Legend', 'Madonna', 'Kate Bush', 'Eurythmics', 'Bobby Helms',
    'Meghan Trainor', 'Pentatonix', 'Tom Petty & Heartbreakers', 'Hall & Oates']) {
    assert.equal(feed.artists[mapping.normalizeArtistName(artist)].path, mapping.artistArtwork(artist));
  }
  assert.deepEqual(feed.artists['frankie goes to hollywood'], feed.artists['holly johnson']);
  assert.deepEqual(feed.artists['the pogues'], feed.artists.pogues);
  assert.equal(feed.artists[mapping.normalizeArtistName('  Michael Bublé ')].path, mapping.artistArtwork('Michael Bublé'));
  for (const artist of ['Unknown Artist', 'Tevin Campbell', 'Oasis', 'Take That', 'constructor', 'toString', '__proto__']) {
    assert.equal(mapping.artistArtwork(artist), feed.fallback.path);
    const key = mapping.normalizeArtistName(artist);
    if (songs.some(song => mapping.normalizeArtistName(song.artist) === key)) {
      assert.deepEqual(feed.artists[key], feed.fallback);
    } else {
      assert.equal(Object.hasOwn(feed.artists, key), false);
    }
  }
});

test('feed is deterministic and replacement bytes change both image URL and catalogue version', async () => {
  const before = await buildArtworkFeed(mapping);
  assert.deepEqual(await buildArtworkFeed(mapping), before);
  const after = await buildArtworkFeed(mapping, {
    readImage: async path => {
      const original = await readFile(`public${path}`);
      return path === '/artist-artwork/chris-kamara.webp'
        ? Buffer.concat([original, Buffer.from('replacement test')]) : original;
    },
  });
  assert.notEqual(after.version, before.version);
  assert.notEqual(after.artists['chris kamara'].version, before.artists['chris kamara'].version);
  assert.notEqual(after.artists['chris kamara'].url, before.artists['chris kamara'].url);
  assert.equal(after.artists['chris kamara'].path, before.artists['chris kamara'].path);
  assert.deepEqual(after.artists['gary barlow'], before.artists['gary barlow']);
});

test('fallback replacements and new mappings change the feed automatically', async () => {
  // Keep this scenario independent of which artists now have real portraits.
  const { 'susy wall': omitted, ...portraits } = mapping.artistPortraits;
  const scenarioMapping = {
    ...mapping,
    artistPortraits: portraits,
    artistArtwork: artist => artist === 'susy wall' ? mapping.fallbackArtwork : mapping.artistArtwork(artist),
  };
  const before = await buildArtworkFeed(scenarioMapping);
  const after = await buildArtworkFeed(scenarioMapping, {
    readImage: async path => {
      const original = await readFile(`public${path}`);
      return path === mapping.fallbackArtwork ? Buffer.concat([original, Buffer.from('replacement')]) : original;
    },
  });
  assert.notEqual(before.fallback.url, after.fallback.url);
  assert.notEqual(before.version, after.version);
  assert.deepEqual(before.artists['susy wall'], before.fallback);
  assert.deepEqual(after.artists['susy wall'], after.fallback);
  const extended = {
    ...scenarioMapping,
    artistPortraits: { ...scenarioMapping.artistPortraits, 'new test artist': 'chris-kamara' },
    artistArtwork: artist => artist === 'new test artist' ? '/artist-artwork/chris-kamara.webp' : scenarioMapping.artistArtwork(artist),
  };
  const added = await buildArtworkFeed(extended);
  assert.deepEqual(added.artists['new test artist'], before.artists['chris kamara']);
  assert.notEqual(added.version, before.version);
  const portraitAdded = await buildArtworkFeed({
    ...mapping,
    artistPortraits: { ...mapping.artistPortraits, 'susy wall': 'chris-kamara' },
    artistArtwork: artist => artist === 'susy wall' ? '/artist-artwork/chris-kamara.webp' : mapping.artistArtwork(artist),
  });
  assert.deepEqual(portraitAdded.artists['susy wall'], before.artists['chris kamara']);
  assert.notEqual(portraitAdded.artists['susy wall'].url, before.artists['susy wall'].url);
  assert.notEqual(portraitAdded.version, before.version);
});

test('missing or invalid files fail clearly instead of publishing bad artwork entries', async () => {
  await assert.rejects(buildArtworkFeed(mapping, { readImage: async () => { throw new Error('ENOENT'); } }),
    /Cannot publish artwork catalogue: missing or unreadable image/);
  await assert.rejects(buildArtworkFeed(mapping, { readImage: async () => Buffer.from('not a webp') }),
    /Cannot publish artwork catalogue: invalid WebP/);
});
