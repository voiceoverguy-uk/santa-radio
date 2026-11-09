import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as mapping from '../src/data/artistArtwork.js';
import { songArtwork, songPortraits } from '../src/data/songArtwork.js';
import { buildArtworkFeed } from '../server/artwork-feed.js';
import songs from '../src/data/songs.json' with { type: 'json' };

test('every website recording assignment is shared with canonical identity and content-derived image', async () => {
  const feed = await buildArtworkFeed(mapping);
  const legacy = await buildArtworkFeed(mapping, { recordingMapping: {} });
  // Local artist-only consumer simulation: proves field invariants, not unavailable native decoders.
  for (const key of ['schemaVersion', 'refreshAfterSeconds', 'fallback', 'artists']) {
    assert.deepEqual(feed[key], legacy[key]);
  }
  assert.deepEqual(Object.keys(feed.recordings), Object.keys(songPortraits).sort((a, b) => Number(a) - Number(b)));
  for (const [id, assignment] of Object.entries(songPortraits)) {
    const song = songs.find(song => String(song.id) === id);
    const version = createHash('sha256').update(await readFile(`public${assignment.path}`)).digest('hex');
    assert.deepEqual(feed.recordings[id], {
      artist: song.artist, title: song.song,
      image: { path: assignment.path, version, url: `${assignment.path}?v=${version}` },
    });
    assert.equal(songArtwork(song), assignment.path);
  }
  assert.equal(feed.recordings['559'].title, 'Bad Sharon');
  assert.notEqual(feed.recordings['75'].image.url, feed.recordings['527'].image.url);
  assert.equal(feed.artists['ariana grande'].path, '/artist-artwork/ariana-grande.webp');
  assert.notEqual(feed.version, legacy.version);
  assert.deepEqual(await buildArtworkFeed(mapping, {
    recordingMapping: Object.fromEntries(Object.entries(songPortraits).reverse()),
  }), feed, 'mapping insertion order must not affect output');
});

test('The Weather Girls supplied artwork is artist-wide with no song override', async () => {
  const path = '/artist-artwork/the-weather-girls.webp';
  const artistSongs = songs.filter(song => song.artist === 'The Weather Girls');
  assert.ok(artistSongs.length > 0);
  for (const song of artistSongs) {
    assert.equal(songArtwork(song), path);
    assert.equal(Object.hasOwn(songPortraits, song.id), false);
  }
  const bytes = await readFile(`public${path}`);
  assert.ok(bytes.length < 100000);
  const version = createHash('sha256').update(bytes).digest('hex');
  const current = await buildArtworkFeed(mapping);
  assert.deepEqual(current.artists['the weather girls'], { path, version, url: `${path}?v=${version}` });
  const previous = await buildArtworkFeed({
    ...mapping,
    artistArtwork: artist => mapping.normalizeArtistName(artist) === 'the weather girls'
      ? mapping.fallbackArtwork : mapping.artistArtwork(artist),
  });
  assert.notEqual(current.version, previous.version);
  for (const [artist, entry] of Object.entries(previous.artists)) {
    if (artist !== 'the weather girls') assert.deepEqual(current.artists[artist], entry);
  }
  assert.deepEqual(current.recordings, previous.recordings);
});

test('Mistletoe And Holly adds only its exact recording without changing artist-wide artwork', async () => {
  const current = await buildArtworkFeed(mapping);
  const { 236: added, ...previousMapping } = songPortraits;
  const previous = await buildArtworkFeed(mapping, { recordingMapping: previousMapping });
  for (const key of ['schemaVersion', 'refreshAfterSeconds', 'fallback', 'artists']) {
    assert.deepEqual(current[key], previous[key]);
  }
  const { 236: entry, ...remaining } = current.recordings;
  assert.deepEqual(remaining, previous.recordings);
  assert.equal(entry.artist, 'Frank Sinatra');
  assert.equal(entry.title, 'Mistletoe And Holly');
  assert.equal(entry.image.path, '/artist-artwork/frank-sinatra-mistletoe-and-holly.webp');
  assert.equal(entry.image.path, added.path);
  assert.equal(Object.hasOwn(current.recordings, '237'), false);
  assert.notEqual(current.version, previous.version);
});

test('Here Comes Santa Claus adds only recording 343 and leaves all artist entries unchanged', async () => {
  const current = await buildArtworkFeed(mapping);
  const { 343: added, ...previousMapping } = songPortraits;
  const previous = await buildArtworkFeed(mapping, { recordingMapping: previousMapping });
  for (const key of ['schemaVersion', 'refreshAfterSeconds', 'fallback', 'artists']) {
    assert.deepEqual(current[key], previous[key]);
  }
  const { 343: entry, ...remaining } = current.recordings;
  assert.deepEqual(remaining, previous.recordings);
  assert.equal(entry.artist, 'Bing Crosby');
  assert.equal(entry.title, 'Here Comes Santa Claus');
  assert.equal(entry.image.path, added.path);
  assert.notEqual(current.version, previous.version);
  assert.equal(Object.hasOwn(current.recordings, '448'), false);
  assert.equal(Object.hasOwn(current.recordings, '194'), false);
});

test("Can't stop Christmas adds only its exact entry and versions replacement bytes independently", async () => {
  const current = await buildArtworkFeed(mapping);
  const { 487: added, ...previousMapping } = songPortraits;
  const previous = await buildArtworkFeed(mapping, { recordingMapping: previousMapping });
  for (const key of ['schemaVersion', 'refreshAfterSeconds', 'fallback', 'artists']) {
    assert.deepEqual(current[key], previous[key]);
  }
  const { 487: entry, ...remaining } = current.recordings;
  assert.deepEqual(remaining, previous.recordings);
  assert.equal(entry.artist, 'Robbie Williams');
  assert.equal(entry.title, "Can't stop Christmas");
  assert.equal(entry.image.path, '/artist-artwork/robbie-williams-cant-stop-christmas.webp');
  assert.notEqual(current.version, previous.version);
  const replaced = await buildArtworkFeed(mapping, {
    readImage: async path => {
      const bytes = await readFile(`public${path}`);
      return path === added.path ? Buffer.concat([bytes, Buffer.from('replacement')]) : bytes;
    },
  });
  assert.notEqual(replaced.version, current.version);
  assert.notEqual(replaced.recordings['487'].image.url, entry.image.url);
  assert.deepEqual(replaced.artists, current.artists);
  for (const [id, recording] of Object.entries(remaining)) {
    assert.deepEqual(replaced.recordings[id], recording);
  }
});

test('recording replacements, reassignment, addition and removal invalidate the overall version only as needed', async () => {
  const before = await buildArtworkFeed(mapping);
  const after = await buildArtworkFeed(mapping, {
    readImage: async path => {
      const bytes = await readFile(`public${path}`);
      return path === songPortraits[75].path ? Buffer.concat([bytes, Buffer.from('replacement')]) : bytes;
    },
  });
  assert.notEqual(after.recordings['75'].image.url, before.recordings['75'].image.url);
  assert.notEqual(after.version, before.version);
  assert.deepEqual(after.artists, before.artists);
  assert.deepEqual(after.recordings['527'], before.recordings['527']);
  const remapped = await buildArtworkFeed(mapping, {
    recordingMapping: { ...songPortraits, 75: { ...songPortraits[75], path: songPortraits[527].path } },
  });
  assert.notEqual(remapped.version, before.version);
  assert.equal(remapped.recordings['75'].image.url, before.recordings['527'].image.url);
  const { 75: removed, ...remaining } = songPortraits;
  const reduced = await buildArtworkFeed(mapping, { recordingMapping: remaining });
  assert.notEqual(reduced.version, before.version);
  assert.equal(Object.hasOwn(reduced.recordings, '75'), false);
  assert.deepEqual(reduced.artists, before.artists);
  assert.deepEqual(await buildArtworkFeed(mapping, { recordingMapping: { ...remaining, 75: removed } }), before);
});

test('invalid recording identities, paths and image files fail explicitly', async () => {
  const build = (recordingMapping, options = {}) => buildArtworkFeed(mapping, { recordingMapping, ...options });
  for (const id of ['999999', '075', '__proto__']) {
    await assert.rejects(build(Object.fromEntries([[id, songPortraits[75]]])),
      /must identify exactly one catalogue song/);
  }
  await assert.rejects(build({ 75: songPortraits[75] }, {
    catalogue: [...songs, songs.find(song => song.id === 75)],
  }), /must identify exactly one catalogue song/);
  for (const assignment of [null, { ...songPortraits[75], artist: 'Wham!' },
    { ...songPortraits[75], title: 'Last Christmas (Live)' }]) {
    await assert.rejects(build({ 75: assignment }), /artist\/title does not match canonical catalogue/);
  }
  for (const path of [undefined, '/artist-artwork/../secret.webp', 'https://example.test/a.webp']) {
    await assert.rejects(build({ 75: { ...songPortraits[75], path } }), /Invalid artwork path/);
  }
  await assert.rejects(build({ 75: { ...songPortraits[75], path: '/artist-artwork/nonexistent.webp' } }),
    /missing or unreadable image.*nonexistent/);
  await assert.rejects(build({ 75: songPortraits[75] }, {
    readImage: async path => path === songPortraits[75].path
      ? Buffer.from('invalid recording image') : readFile(`public${path}`),
  }), /invalid WebP.*ariana-grande-last-christmas/);
});

test('Toni Braxton replacement stays artist-wide and changes only her content-derived feed entry', async () => {
  const path = '/artist-artwork/toni-braxton.webp';
  const bytes = await readFile(`public${path}`);
  const version = createHash('sha256').update(bytes).digest('hex');
  assert.equal(version, 'a4038f78a7cf0893c39614267101793b5a0f8cdcd8ebdb042b6bc6788171249e');
  assert.notEqual(version, '5d767c4c9c37d0bb2ee29b10d4abdc65c33345d471707a5917d3d1cc7edf709a');
  assert.ok(bytes.length < 100000);
  const artistSongs = songs.filter(song => song.artist === 'Toni Braxton');
  assert.deepEqual(artistSongs.map(song => [song.id, song.song]), [[428, 'Holiday Celebrate']]);
  assert.equal(mapping.artistArtwork('  TONI  BRAXTON  '), path);
  for (const song of artistSongs) {
    assert.equal(Object.hasOwn(songPortraits, song.id), false);
    assert.equal(songArtwork(song), path);
  }
  const current = await buildArtworkFeed(mapping);
  assert.deepEqual(current.artists['toni braxton'], { path, version, url: `${path}?v=${version}` });
  const replaced = await buildArtworkFeed(mapping, {
    readImage: async imagePath => {
      const original = await readFile(`public${imagePath}`);
      return imagePath === path ? Buffer.concat([original, Buffer.from('replacement test')]) : original;
    },
  });
  assert.notEqual(replaced.version, current.version);
  assert.notEqual(replaced.artists['toni braxton'].version, version);
  assert.notEqual(replaced.artists['toni braxton'].url, current.artists['toni braxton'].url);
  for (const [artist, entry] of Object.entries(current.artists)) {
    if (artist !== 'toni braxton') assert.deepEqual(replaced.artists[artist], entry);
  }
  assert.deepEqual(replaced.recordings, current.recordings);
  assert.deepEqual(replaced.fallback, current.fallback);
});

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

test('Elton John transparency is shared and cache-busted without changing his duet artwork', async () => {
  const path = '/artist-artwork/elton-john.webp';
  const artistSongs = songs.filter(song => mapping.normalizeArtistName(song.artist) === 'elton john');
  assert.ok(artistSongs.length > 0);
  assert.equal(mapping.artistArtwork('Elton John'), path);
  for (const song of artistSongs) assert.equal(mapping.artistArtwork(song.artist), path);

  const original = await readFile('public/artist-artwork/elton-john.jpg');
  const supplied = await readFile('attached_assets/elton-john_1791328536891.jpg');
  const originalVersion = createHash('sha256').update(original).digest('hex');
  assert.equal(originalVersion, createHash('sha256').update(supplied).digest('hex'));
  assert.equal(originalVersion, '47b8a73b7516742fca45753ad31f980999e4d6b161aa534fe1a65fd42c72265f');

  const bytes = await readFile(`public${path}`);
  assert.equal(bytes.subarray(0, 4).toString(), 'RIFF');
  assert.equal(bytes.subarray(8, 12).toString(), 'WEBP');
  let hasAlpha = false;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const chunk = bytes.toString('ascii', offset, offset + 4);
    const length = bytes.readUInt32LE(offset + 4);
    if (chunk === 'ALPH' || (chunk === 'VP8X' && (bytes[offset + 8] & 0x10))) hasAlpha = true;
    offset += 8 + length + (length & 1);
  }
  assert.equal(hasAlpha, true, 'the delivered WebP must encode an alpha channel');

  const version = createHash('sha256').update(bytes).digest('hex');
  assert.notEqual(version, 'db7df7803a92c280a9692bb5f9618b5fbbcb208d3d25781ada6e2f8239a8a797');
  const feed = await buildArtworkFeed(mapping);
  assert.deepEqual(feed.artists['elton john'], { path, version, url: `${path}?v=${version}` });

  const duetPath = '/artist-artwork/elton-john-ed-sheeran.webp';
  const duet = await readFile(`public${duetPath}`);
  assert.equal(createHash('sha256').update(duet).digest('hex'),
    'cb19d11ff672eeb18007c6ea6105a7937e0ab7d5f481fb9d81d3a235843b9d3b');
  assert.equal(mapping.artistArtwork('Ed Sheeran & Elton John'), duetPath);
  assert.equal(feed.artists['ed sheeran & elton john'].path, duetPath);
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
