import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEntries } from '../server/radio-metadata.js';
import { websiteNowPlayingTrack } from '../src/lib/websiteNowPlayingTrack.js';
import songs from '../src/data/songs.json' with { type: 'json' };
import { matchLiveSong } from '../src/data/matchLiveSong.js';
import { artistArtwork } from '../src/data/artistArtwork.js';
test('repairs verified reversed live credits and resolves duet artwork', () => {
 const [raw] = parseEntries("Santa, Can't You Hear Me - Kelly Clarkson & Ariana Grande");
 assert.equal(raw.artist, "Santa, Can't You Hear Me");
 const track = websiteNowPlayingTrack(raw);
 assert.equal(track.artist, 'Kelly Clarkson & Ariana Grande');
 assert.equal(track.title, "Santa Can't You Hear Me");
 assert.ok(matchLiveSong(track).song);
 assert.equal(artistArtwork(track.artist), '/artist-artwork/kelly-clarkson-and-ariana-grande.webp');
});
test('preserves correct credits, unknown pairs and announcements', () => {
 for(const track of [{artist:'Kelly Clarkson & Ariana Grande',title:"Santa Can't You Hear Me"},{artist:'Unknown Artist',title:'Unknown Song'},{artist:'',title:'Station announcement'}]){
  assert.deepEqual(parseEntries(`${track.artist} - ${track.title}`),[track]);
 }
});

test('all catalogue credits stay unchanged; reversed matches recover only verified songs', () => {
 let corrected = 0;
 for (const song of songs) {
  const track = {artist: song.artist, title: song.song};
  assert.deepEqual(websiteNowPlayingTrack(track), track);
  const reversed = {artist: song.song, title: song.artist};
  const result = websiteNowPlayingTrack(reversed);
  if (result !== reversed) { assert.equal(result.artist,song.artist); assert.equal(result.title,song.song); corrected++; }
 }
 console.log(`Checked ${songs.length} catalogue entries; ${corrected} verified reversed matches recovered.`);
});
