import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { artistGalleryImages } from '../src/data/artistGalleryImages.js';
import { galleryPlayTime } from '../src/lib/artistGallerySchedule.js';
import songs from '../src/data/songs.json' with { type: 'json' };

test('selected gallery assets exist and catalogue assignments agree with both artist and title', () => {
  assert.equal(artistGalleryImages.length, 102);
  for (const image of artistGalleryImages) {
    assert.ok(existsSync(new URL(`../public${image.src}`, import.meta.url)), image.src);
    if (image.songId != null) {
      const song = songs.find(song => song.id === image.songId);
      assert.equal(image.artist, song.artist);
      assert.equal(image.title, song.song);
    }
  }
});
test('play time requires the exact recording in NEXT 4 and a future known time', () => {
  const image = { songId: 57 };
  const right = { artist: 'Cliff Richard', title: 'Mistletoe And Wine', estimatedAt: 2000 };
  const wrong = { artist: 'Cliff Richard', title: 'Saviours Day', estimatedAt: 2000 };
  assert.equal(galleryPlayTime(image, [wrong, right], 1000), 2000);
  assert.equal(galleryPlayTime(image, [wrong], 1000), null);
  assert.equal(galleryPlayTime(image, [wrong, wrong, wrong, wrong, right], 1000), null);
  assert.equal(galleryPlayTime(image, [right], 3000), null);
  assert.equal(galleryPlayTime(image, [{ ...right, estimatedAt: null }], 1000), null);
  assert.equal(galleryPlayTime({ artist: 'Cliff Richard' }, [right], 1000), null);
});

test('dashboard selections add, remove and replace exact-song gallery images', async () => {
  const { managedArtistGallery, gallerySelection } = await import('../src/data/managedArtistGallery.js');
  const song = songs.find(song => song.id === 37);
  const replacement = '/artist-artwork/upload-new.webp';
  assert.equal(gallerySelection(37, {}), true);
  assert.equal(gallerySelection(37, { gallery: { 37: { enabled: false } } }), false);
  assert.equal(managedArtistGallery({ gallery: { 37: { enabled: false, scope: 'song' } } }).some(image => image.songId === 37), false);
  const data = { recordings: { 37: { artist: song.artist, title: song.song, path: replacement } }, gallery: { 37: { enabled: true, scope: 'song' } } };
  const selected = managedArtistGallery(data).filter(image => image.songId === 37);
  assert.equal(selected.length, 1);
  assert.equal(selected[0].src, replacement);
  assert.equal(selected[0].title, song.song);
  const newSong = songs.find(song => !artistGalleryImages.some(image => image.songId === song.id));
  const added = managedArtistGallery({ gallery: { [newSong.id]: { enabled: true, scope: 'song' } } });
  assert.equal(added.filter(image => image.songId === newSong.id).length, 1);
  assert.equal(managedArtistGallery({ gallery: { 999999: { enabled: true, scope: 'song' } } }).length, 102);
});
