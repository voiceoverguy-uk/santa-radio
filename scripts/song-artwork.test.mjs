import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import songs from '../src/data/songs.json' with { type: 'json' };
import * as artistMapping from '../src/data/artistArtwork.js';
import { songArtwork, songArtworkCandidates, songPortraits } from '../src/data/songArtwork.js';
import { matchLiveSong } from '../src/data/matchLiveSong.js';
import { songMetadata, artworkAlt } from '../src/seo/catalogue.js';
import { randomSongOrder } from '../src/data/randomSongOrder.js';
import { buildArtworkFeed } from '../server/artwork-feed.js';
import { createHash } from 'node:crypto';
import { exactSongArtwork, observedLivePairs } from './fixtures/exact-song-artwork.js';

const lastChristmas = songs.find(song => song.id === 75);
const winterThings = songs.find(song => song.id === 527);
const special = '/artist-artwork/ariana-grande-last-christmas.webp';
const winterSpecial = '/artist-artwork/ariana-grande-winter-things.webp';
const usual = '/artist-artwork/ariana-grande.webp';
const elvisBlue = songs.find(song => song.id === 399);
const elvisSpecial = '/artist-artwork/elvis-presley-blue-christmas.webp';
const elvisUsual = '/artist-artwork/elvis-presley.webp';

test('Mistletoe And Holly preserves the upload, Sinatra controls and the Moonglows recording', async () => {
  for (const [path, hash] of [
    ['attached_assets/Frank_Sinatra_-_Mistletoe_And_Holly_1793326726468.png',
      'fcf7610f84054dc84a3e781caa6aa5f255b04cd58e234a50d7f903bfc408eac4'],
    ['public/artist-artwork/frank-sinatra.webp',
      '42a130e4a2875f56071dfc6c8a273ee0777f4bb2c64b3a3cd8e5b7027afd1da6'],
    ['public/artist-artwork/frank-sinatra-let-it-snow.webp',
      'f76c2c873286e621897365a46243782cda74de3443031fcfd0ed2c9f5e396483'],
  ]) assert.equal(createHash('sha256').update(await readFile(path)).digest('hex'), hash);
  const song = songs.find(song => song.id === 236);
  assert.equal(song.link, 'frank-sinatra-mistletoe-and-holly');
  assert.equal(artworkAlt(song), 'Illustrated artwork for Mistletoe And Holly by Frank Sinatra');
  assert.equal(songArtwork(songs.find(song => song.id === 46)), '/artist-artwork/frank-sinatra-let-it-snow.webp');
  const moonglows = songs.find(song => song.id === 237);
  assert.equal(moonglows.artist, 'The Moonglows');
  assert.equal(songArtwork(moonglows), artistMapping.artistArtwork('The Moonglows'));
  assert.equal(songArtwork(matchLiveSong({ artist: moonglows.artist, title: moonglows.song }).song),
    artistMapping.artistArtwork('The Moonglows'));
});

test('Bing illustration preserves the upload and excludes the duet and other versions', async () => {
  const original = await readFile('attached_assets/Bing_Crosby_-_Here_Comes_Santa_Claus_1793327224384.png');
  assert.equal(createHash('sha256').update(original).digest('hex'),
    '37a57f01d9d13af637d2bfc90ce8fa44286ac6e7f65fa49ff8aec3647e1c8e22');
  for (const id of [448, 194, 67]) {
    const song = songs.find(song => song.id === id);
    assert.equal(songArtwork(song), artistMapping.artistArtwork(song.artist));
    assert.equal(songArtwork(matchLiveSong({ artist: song.artist, title: song.song }).song),
      artistMapping.artistArtwork(song.artist));
  }
  for (const [path, hash] of [
    ['/artist-artwork/bing-crosby.webp',
      'd31a7799ba22cd4599bc7cf5a3e69554bf52ec8af5997c0ba821a2968b84f4fb'],
    ['/artist-artwork/bing-crosby-and-rosemary-clooney.webp',
      'c2a5fb2397d4780d4d9e305adbc6384541d3d23a6299b44793d9e8a3cefa0a7a'],
  ]) assert.equal(createHash('sha256').update(await readFile(`public${path}`)).digest('hex'), hash);
});

test("Can't stop Christmas preserves its original and both existing Robbie images", async () => {
  for (const [path, hash] of [
    ["attached_assets/Robbie_Williams_-_Can't_Stop_Christmas_1793324101511.png",
      '31c70ee3c30481f5fb752cae315c63a1ce5bb33cfa59a67a43bfe7f770ccea2e'],
    ['public/artist-artwork/robbie-williams-bad-sharon.webp',
      'da49799b75954e4226249e831166c543c596c79cf2a34005996a5350390d4b1f'],
  ]) assert.equal(createHash('sha256').update(await readFile(path)).digest('hex'), hash);
  assert.equal(songArtwork(songs.find(song => song.id === 288)), '/artist-artwork/robbie-williams-walk-this-sleigh.webp');
  assert.equal(artworkAlt(songs.find(song => song.id === 487)),
    "Illustrated artwork for Can't stop Christmas by Robbie Williams");
});

test('Walk this Sleigh preserves the upload and existing song artwork, leaving the artist portrait as fallback', async () => {
  const original = await readFile('attached_assets/Robbie_Williams_-_Walk_this_sleigh_1793324730298.png');
  assert.equal(createHash('sha256').update(original).digest('hex'),
    '2daa85b8504f0e0854303661aaa809408472b7cbfc5135c2ecd6b4eeb4267af4');
  const existing = await readFile('public/artist-artwork/robbie-williams-cant-stop-christmas.webp');
  assert.equal(createHash('sha256').update(existing).digest('hex'),
    '0b85c895f50d1ec730f33910d213209444173894641b8b921441778cf81c9b67');
  assert.equal(songArtwork({ id: 99999, artist: 'Robbie Williams', song: 'Another recording' }),
    '/artist-artwork/robbie-williams.webp');
  const feed = await buildArtworkFeed(artistMapping);
  const { 288: added, ...previousMapping } = songPortraits;
  const previous = await buildArtworkFeed(artistMapping, { recordingMapping: previousMapping });
  assert.notEqual(feed.version, previous.version);
  assert.deepEqual(feed.artists, previous.artists);
  const { 288: recording, ...remaining } = feed.recordings;
  assert.deepEqual(remaining, previous.recordings);
  const version = createHash('sha256').update(await readFile(`public${added.path}`)).digest('hex');
  assert.deepEqual(recording.image, { path: added.path, version, url: `${added.path}?v=${version}` });
});

test('Bad Sharon preserves the supplied PNG and shared Robbie portrait alongside its recording entry', async () => {
  const original = await readFile('attached_assets/robbie-williams-bad-sharon_1793232959684.png');
  assert.equal(createHash('sha256').update(original).digest('hex'),
    '057656b51d1cddce2ca4e9c95fe8fa1990e703a9c0a59283d1f033f0f3957b3e');
  const path = '/artist-artwork/robbie-williams.webp';
  const originalPortraitHash = 'f81988405715c3ea03d4d08d8a589fd609f0cd3207d1f6f7064b61bcf78d4014';
  assert.equal(createHash('sha256').update(await readFile(`public${path}`)).digest('hex'), originalPortraitHash);
  const feed = await buildArtworkFeed(artistMapping);
  assert.equal(feed.artists['robbie williams'].path, path);
  assert.equal(feed.artists['robbie williams'].version, originalPortraitHash);
  assert.equal(feed.recordings['559'].image.path, '/artist-artwork/robbie-williams-bad-sharon.webp');
});

for (const expected of exactSongArtwork) {
  test(`${expected.id}: supplied illustration stays recording-specific across website and live metadata`, async () => {
    const song = songs.find(song => song.id === expected.id);
    assert.equal(song.artist, expected.artist);
    assert.equal(song.song, expected.title);
    assert.equal(songArtwork(song), expected.path);
    assert.deepEqual(songArtworkCandidates(song), [...new Set([
      expected.path, artistMapping.artistArtwork(song.artist), artistMapping.fallbackArtwork,
    ])]);
    assert.equal(songArtwork(matchLiveSong({ artist: song.artist, title: song.song }).song), expected.path);
    for (const other of songs.filter(other => other.id !== song.id)) {
      assert.notEqual(songArtwork(other), expected.path, `Leaked to ${other.id}`);
    }
    for (const changed of [
      { ...song, id: 99999 }, { ...song, song: `${song.song} (Live)` },
      { ...song, artist: 'Unrelated performer' }, { artist: song.artist, song: song.song },
    ]) assert.equal(songArtwork(changed), artistMapping.artistArtwork(changed.artist));
    const meta = songMetadata(song);
    assert.equal(meta.image, `https://www.santaradio.co.uk${expected.path}`);
    assert.equal(meta.graph.find(node => node['@type'] === 'ImageObject').contentUrl, meta.image);
    const bytes = await readFile(`public${expected.path}`);
    assert.equal(bytes.subarray(0, 4).toString(), 'RIFF');
    assert.equal(bytes.subarray(8, 12).toString(), 'WEBP');
    assert.ok(bytes.length < 150000, 'Delivery derivative should remain small');
  });
}

test('other recordings keep portraits and shared recording entries do not replace artist entries', async () => {
  const artists = new Set(exactSongArtwork.map(song => song.artist));
  const ids = new Set(exactSongArtwork.map(song => song.id));
  for (const song of songs.filter(song => artists.has(song.artist) && !ids.has(song.id))) {
    assert.equal(songArtwork(song), artistMapping.artistArtwork(song.artist), `${song.id}`);
  }
  // The current catalogue has only these four Sia songs; protect additional tracks too.
  assert.equal(songArtwork({ id: 99999, artist: 'Sia', song: 'Snowman' }),
    '/artist-artwork/sia-festive.webp');
  const feed = await buildArtworkFeed(artistMapping);
  for (const expected of exactSongArtwork) {
    assert.equal(feed.recordings[String(expected.id)].image.path, expected.path);
    assert.equal(feed.artists[artistMapping.normalizeArtistName(expected.artist)].path,
      artistMapping.artistArtwork(expected.artist));
  }
});

test('observed shortened credits resolve only their verified recordings, retaining joint credits', () => {
  for (const pair of observedLivePairs) {
    const matched = matchLiveSong(pair);
    assert.equal(matched.song?.id, pair.id);
    assert.equal(matched.song.artist, pair.credit);
    assert.equal(songArtwork(matched.song), pair.path);
    for (const track of [
      { ...pair, title: `${pair.title} (Live)` },
      { ...pair, title: 'Unknown Christmas Song' },
      { ...pair, artist: 'Joseph Bell' },
      { ...pair, artist: 'Tom Jones' },
      { ...pair, artist: 'Unrelated performer' },
    ]) assert.equal(matchLiveSong(track).song, undefined, JSON.stringify(track));
    assert.equal(matchLiveSong(pair, []).status, 'unmatched');
    assert.equal(matchLiveSong(pair, songs, [
      { ...pair, songId: pair.id }, { ...pair, songId: 99999 },
    ]).status, 'ambiguous');
    const canonical = songs.find(song => song.id === pair.id);
    assert.equal(matchLiveSong({ artist: canonical.artist, title: canonical.song }).song.id, pair.id);
  }
  // Short upload filenames are not permission to accept shortened radio titles.
  assert.equal(matchLiveSong({ artist: 'Frank Sinatra', title: 'Let It Snow' }).song, undefined);
  assert.equal(matchLiveSong({ artist: 'Sia', title: 'Naughty and Nice' }).song, undefined);
});

test('Mariah illustration is restricted to the verified recording and website metadata', async () => {
  const song = songs.find(song => song.id === 24);
  const special = '/artist-artwork/mariah-carey-all-i-want-for-christmas-is-you.webp';
  const usual = '/artist-artwork/mariah-carey.webp';
  assert.equal(song.artist, 'Mariah Carey');
  assert.equal(song.song, 'All I Want For Christmas Is You');
  assert.equal(songArtwork(song), special);
  assert.deepEqual(songArtworkCandidates(song), [special, usual, artistMapping.fallbackArtwork]);
  for (const other of songs.filter(other => other.id !== 24)) {
    assert.notEqual(songArtwork(other), special, `Unexpected assignment to ${other.id}`);
  }
  for (const changed of [
    { ...song, id: 99999 },
    { ...song, song: 'Oh Santa' },
    { ...song, artist: 'Michael Buble' },
    { artist: song.artist, song: song.song },
  ]) {
    assert.equal(songArtwork(changed), artistMapping.artistArtwork(changed.artist));
  }
  assert.equal(songArtwork(matchLiveSong({ artist: song.artist, title: song.song }).song), special);
  const metadata = songMetadata(song);
  assert.equal(metadata.image, `https://www.santaradio.co.uk${special}`);
  assert.equal(metadata.graph.find(node => node['@type'] === 'ImageObject').contentUrl, metadata.image);
  assert.equal(artworkAlt(song), `Illustrated artwork for ${song.song} by ${song.artist}`);
  const original = await readFile('attached_assets/all-i-want-for-christmas-is-you_1792861390204.png');
  assert.equal(createHash('sha256').update(original).digest('hex'),
    '1195dfc1f6662b7196804979b7677391694a9a83811ef8a845d5ed7eecfb4228');
  const image = await readFile(`public${special}`);
  assert.equal(image.subarray(8, 12).toString(), 'WEBP');
  assert.ok(image.length < 100000);
  const feed = await buildArtworkFeed(artistMapping);
  assert.equal(feed.artists['mariah carey'].path, usual);
  assert.equal(feed.artists['mariah carey'].version,
    '4bef6208657c34d9790d45bd150a1532bcabcc294cabeec25803440f4c18e607');
  assert.equal(feed.recordings['24'].image.path, special);
});

test('Chris De Burgh replacement is shared artist artwork, not a song-only override', async () => {
  const spaceman = songs.find(song => song.id === 61);
  const path = '/artist-artwork/chris-de-burgh.webp';
  assert.equal(spaceman.artist, 'Chris De Burgh');
  assert.equal(spaceman.song, 'A Spaceman Came Travelling');
  assert.equal(artistMapping.artistArtwork(spaceman.artist), path);
  assert.equal(songArtwork(spaceman), path);
  assert.deepEqual(songArtworkCandidates(spaceman), [path, artistMapping.fallbackArtwork]);
  // The owner clarified that this replaces the artist picture for all recordings.
  assert.equal(songArtwork({ ...spaceman, id: 99999, song: 'Another recording' }), path);
  assert.equal(songArtwork({ ...spaceman, artist: 'Wham!' }), artistMapping.artistArtwork('Wham!'));
  assert.equal(songArtwork(matchLiveSong({ artist: spaceman.artist, title: spaceman.song }).song), path);
  assert.equal(matchLiveSong({ artist: spaceman.artist, title: 'Unknown recording' }).song, undefined);
  const metadata = songMetadata(spaceman);
  assert.equal(metadata.image, `https://www.santaradio.co.uk${path}`);
  assert.equal(metadata.graph.find(node => node['@type'] === 'ImageObject').contentUrl, metadata.image);
  const image = await readFile(`public${path}`);
  assert.equal(image.subarray(8, 12).toString(), 'WEBP');
  assert.ok(image.length < 100000);
  const hash = createHash('sha256').update(image).digest('hex');
  assert.notEqual(hash, '9480863562b26d224ef5405abce23f2d3c1916df6a034d6bb65c6301613a1e00',
    'must not regress to the previous artist portrait');
  const original = await readFile('attached_assets/chris-de-burgh_1792051593491.png');
  assert.equal(original.subarray(1, 4).toString(), 'PNG');
  const feed = await buildArtworkFeed(artistMapping);
  assert.equal(feed.schemaVersion, 1);
  assert.equal(feed.artists['chris de burgh'].path, path);
  assert.equal(feed.artists['chris de burgh'].version, hash);
  assert.equal(feed.artists['chris de burgh'].url, `${path}?v=${hash}`);
  const changed = await buildArtworkFeed(artistMapping, {
    readImage: async candidate => {
      const bytes = await readFile(`public${candidate}`);
      return candidate === path ? Buffer.concat([bytes, Buffer.from('replacement test')]) : bytes;
    },
  });
  assert.notEqual(changed.version, feed.version);
  assert.notEqual(changed.artists['chris de burgh'].url, feed.artists['chris de burgh'].url);
  for (const [artist, entry] of Object.entries(feed.artists)) {
    if (artist !== 'chris de burgh') assert.deepEqual(changed.artists[artist], entry);
  }
});

test('Elvis Blue Christmas override requires its exact verified recording', () => {
  assert.equal(elvisBlue.artist, 'Elvis Presley');
  assert.equal(elvisBlue.song, 'Blue Christmas');
  assert.equal(elvisBlue.link, 'elvis-presley-blue-christmas');
  assert.equal(songArtwork(elvisBlue), elvisSpecial);
  assert.deepEqual(songArtworkCandidates(elvisBlue), [elvisSpecial, elvisUsual, artistMapping.fallbackArtwork]);
  for (const other of songs.filter(song =>
    song.id !== 399 && (song.artist === 'Elvis Presley' || song.song === 'Blue Christmas'))) {
    assert.equal(songArtwork(other), artistMapping.artistArtwork(other.artist));
  }
  assert.equal(songArtwork({ ...elvisBlue, song: 'Another recording' }), elvisUsual);
  assert.equal(songArtwork({ ...elvisBlue, artist: 'Michael Buble' }), artistMapping.artistArtwork('Michael Buble'));
  assert.equal(songArtwork({ ...elvisBlue, id: 99999 }), elvisUsual);
  assert.equal(songArtwork(matchLiveSong({ artist: 'Elvis Presley', title: 'Blue Christmas' }).song), elvisSpecial);
  const metadata = songMetadata(elvisBlue);
  assert.ok(metadata.image.endsWith(elvisSpecial));
  assert.ok(metadata.graph.find(node => node['@type'] === 'ImageObject').contentUrl.endsWith(elvisSpecial));
  assert.equal(artworkAlt(elvisBlue), 'Illustrated artwork for Blue Christmas by Elvis Presley');
});

test('Elvis delivery image is optimised and enters recordings without replacing his artist portrait', async () => {
  const image = await readFile(`public${elvisSpecial}`);
  assert.equal(image.subarray(8, 12).toString(), 'WEBP');
  assert.ok(image.length < 100000);
  const original = await readFile('attached_assets/elvis-presley-blue-christmas_1791994904265.png');
  assert.equal(original.subarray(1, 4).toString(), 'PNG');
  const feed = await buildArtworkFeed(artistMapping);
  assert.equal(feed.artists['elvis presley'].path, elvisUsual);
  assert.equal(feed.recordings['399'].image.path, elvisSpecial);
});

test('Katy Perry illustration is restricted to the verified recording and website metadata', async () => {
  const cozy = songs.find(song => song.id === 528);
  const special = '/artist-artwork/katy-perry-cozy-little-christmas.webp';
  const usual = '/artist-artwork/katy-perry.webp';
  assert.ok(cozy);
  assert.equal(cozy.artist, 'Katy Perry');
  assert.equal(cozy.song, 'Cozy Little Christmas');
  assert.equal(songArtwork(cozy), special);
  assert.deepEqual(songArtworkCandidates(cozy), [special, usual, artistMapping.fallbackArtwork]);

  for (const changed of [
    { ...cozy, id: 99999 },
    { ...cozy, song: 'Another recording' },
    { ...cozy, artist: 'Wham!' },
    { artist: cozy.artist, song: cozy.song },
  ]) {
    assert.equal(songArtwork(changed), artistMapping.artistArtwork(changed.artist));
  }
  for (const other of songs.filter(song => song.id !== cozy.id)) {
    assert.notEqual(songArtwork(other), special, `Unexpected assignment to ${other.id}`);
  }
  assert.equal(songArtwork(matchLiveSong({
    artist: 'Katy Perry', title: 'Cozy Little Christmas',
  }).song), special);
  assert.equal(matchLiveSong({
    artist: 'Katy Perry', title: 'Unknown recording',
  }).song, undefined);

  const metadata = songMetadata(cozy);
  assert.equal(metadata.image, `https://www.santaradio.co.uk${special}`);
  assert.equal(metadata.graph.find(node => node['@type'] === 'ImageObject').contentUrl, metadata.image);
  assert.equal(artworkAlt(cozy), 'Illustrated artwork for Cozy Little Christmas by Katy Perry');

  const image = await readFile(`public${special}`);
  assert.equal(image.subarray(0, 4).toString(), 'RIFF');
  assert.equal(image.subarray(8, 12).toString(), 'WEBP');
  assert.ok(image.length < 180000);
  const original = await readFile('attached_assets/katy-perry-cozy-little-christmas_1793230138590.png');
  assert.equal(original.subarray(1, 4).toString(), 'PNG');

  const feed = await buildArtworkFeed(artistMapping);
  assert.equal(feed.artists['katy perry'].path, usual);
  assert.equal(feed.recordings['528'].image.path, special);
});

test('Ariana recordings get their own verified website overrides, not the app portrait', () => {
  assert.equal(songArtwork(lastChristmas), special);
  assert.equal(songArtwork(winterThings), winterSpecial);
  assert.equal(songArtwork({ ...winterThings, id: 99999 }), usual);
  assert.equal(artistMapping.artistArtwork('Ariana Grande'), usual);
  assert.deepEqual(songArtworkCandidates(lastChristmas), [special, usual, artistMapping.fallbackArtwork]);
  assert.deepEqual(songArtworkCandidates(winterThings), [winterSpecial, usual, artistMapping.fallbackArtwork]);
  assert.equal(songArtwork({ ...lastChristmas, song: 'Winter Things' }), usual);
  assert.notEqual(songArtwork({ ...lastChristmas, artist: 'Wham!' }), special);
  assert.equal(songArtwork({ artist: 'Ariana Grande', song: 'Last Christmas' }), usual);
  assert.equal(songArtwork(null), artistMapping.fallbackArtwork);
});

test('a single Michael Buble override leaves other recordings and collaborations alone', () => {
  const michael = songs.filter(song => song.artist === 'Michael Buble');
  assert.ok(michael.length > 1);
  const custom = '/artist-artwork/test-only-michael-song.webp';
  const overrides = {
    [michael[0].id]: { artist: michael[0].artist, title: michael[0].song, path: custom },
  };
  assert.equal(songArtwork(michael[0], overrides), custom);
  for (const other of michael.slice(1)) {
    assert.equal(songArtwork(other, overrides), artistMapping.artistArtwork(other.artist));
  }
  const collaboration = songs.find(song => song.artist === 'Kelly Clarkson & Ariana Grande');
  assert.ok(collaboration);
  assert.equal(songArtwork(collaboration), artistMapping.artistArtwork(collaboration.artist));
});

test('live artwork requires reliable artist AND title matching', () => {
  assert.equal(songArtwork(matchLiveSong({ artist: 'Ariana Grande', title: 'Last Christmas' }).song), special);
  assert.equal(matchLiveSong({ artist: 'Ariana Grande', title: 'Unknown recording' }).song, undefined);
  assert.equal(matchLiveSong({ artist: 'Wham!', title: 'Last Christmas' }).song?.artist, 'Wham!');
  const ambiguous = matchLiveSong({ artist: lastChristmas.artist, title: lastChristmas.song }, [
    { ...lastChristmas, lyrics: 'First version' },
    { ...lastChristmas, id: 99999, lyrics: 'Different version' },
  ], []);
  assert.equal(ambiguous.status, 'ambiguous');
  assert.equal(ambiguous.song, undefined);
});

test('song-specific social metadata is isolated and random ordering preserves songs', () => {
  assert.ok(JSON.stringify(songMetadata(lastChristmas)).includes(special));
  assert.ok(!JSON.stringify(songMetadata(winterThings)).includes(special));
  assert.ok(JSON.stringify(songMetadata(winterThings)).includes(winterSpecial));
  assert.match(artworkAlt(lastChristmas), /Last Christmas.*Ariana Grande/);
  const ordered = randomSongOrder(songs, () => 0.42);
  assert.equal(ordered.length, songs.length);
  assert.deepEqual(ordered.map(song => song.id).sort((a, b) => a - b),
    songs.map(song => song.id).sort((a, b) => a - b));
  const firstFallback = ordered.findIndex(song => songArtwork(song) === artistMapping.fallbackArtwork);
  assert.ok(firstFallback > 0);
  assert.ok(ordered.slice(firstFallback).every(song => songArtwork(song) === artistMapping.fallbackArtwork));
});

test('optimised supplied artwork is WebP and the feed adds recordings to its existing fields', async () => {
  const image = await readFile(`public${special}`);
  assert.equal(image.subarray(8, 12).toString(), 'WEBP');
  assert.ok(image.length < 100000);
  const feed = await buildArtworkFeed(artistMapping);
  assert.equal(feed.schemaVersion, 1);
  assert.equal(feed.artists['ariana grande'].path, usual);
  assert.equal(Object.hasOwn(feed.artists, 'ariana grande last christmas'), false);
  assert.equal(feed.recordings['75'].image.path, special);
  assert.equal(feed.recordings['527'].image.path, winterSpecial);
  assert.deepEqual(Object.keys(feed).sort(), ['artists', 'fallback', 'recordings', 'refreshAfterSeconds', 'schemaVersion', 'version']);
});
