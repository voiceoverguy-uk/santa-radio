import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import songs from '../src/data/songs.json' with { type: 'json' };
import * as artistMapping from '../src/data/artistArtwork.js';
import { songArtwork, songArtworkCandidates } from '../src/data/songArtwork.js';
import { matchLiveSong } from '../src/data/matchLiveSong.js';
import { songMetadata, artworkAlt } from '../src/seo/catalogue.js';
import { randomSongOrder } from '../src/data/randomSongOrder.js';
import { buildArtworkFeed } from '../server/artwork-feed.js';

const lastChristmas = songs.find(song => song.id === 75);
const winterThings = songs.find(song => song.id === 527);
const special = '/artist-artwork/ariana-grande-last-christmas.webp';
const winterSpecial = '/artist-artwork/ariana-grande-winter-things.webp';
const usual = '/artist-artwork/ariana-grande.webp';
const elvisBlue = songs.find(song => song.id === 399);
const elvisSpecial = '/artist-artwork/elvis-presley-blue-christmas.webp';
const elvisUsual = '/artist-artwork/elvis-presley.webp';

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

test('Elvis delivery image is optimised and does not enter the artist-only app feed', async () => {
  const image = await readFile(`public${elvisSpecial}`);
  assert.equal(image.subarray(8, 12).toString(), 'WEBP');
  assert.ok(image.length < 100000);
  const original = await readFile('attached_assets/elvis-presley-blue-christmas_1791994904265.png');
  assert.equal(original.subarray(1, 4).toString(), 'PNG');
  const feed = await buildArtworkFeed(artistMapping);
  assert.equal(feed.artists['elvis presley'].path, elvisUsual);
  assert.ok(!JSON.stringify(feed).includes(elvisSpecial));
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

test('optimised supplied artwork is WebP and the app feed remains artist-only', async () => {
  const image = await readFile(`public${special}`);
  assert.equal(image.subarray(8, 12).toString(), 'WEBP');
  assert.ok(image.length < 100000);
  const feed = await buildArtworkFeed(artistMapping);
  assert.equal(feed.schemaVersion, 1);
  assert.equal(feed.artists['ariana grande'].path, usual);
  assert.equal(Object.hasOwn(feed.artists, 'ariana grande last christmas'), false);
  assert.ok(!JSON.stringify(feed).includes(special));
  assert.ok(!JSON.stringify(feed).includes(winterSpecial));
  assert.deepEqual(Object.keys(feed).sort(), ['artists', 'fallback', 'refreshAfterSeconds', 'schemaVersion', 'version']);
});
