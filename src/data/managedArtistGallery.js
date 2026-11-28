import songs from './songs.json' with { type: 'json' };
import { artistGalleryImages } from './artistGalleryImages.js';
import { artistArtworkCandidates, songArtworkCandidates } from './songArtwork.js';

export function gallerySelection(songId, data) {
  const original = artistGalleryImages.find(image => (image.galleryId ?? image.songId) === songId);
  // Before alternate pictures had their own controls, any saved song choice
  // replaced all curated variants with the primary picture.
  const legacyAlternate = original?.galleryId && original.songId && Object.hasOwn(data?.gallery || {}, original.songId);
  return data?.gallery?.[songId]?.enabled ?? (legacyAlternate ? false : Boolean(original));
}

export function managedArtistGallery(data = {}) {
  const selections = data.gallery || {};
  const images = artistGalleryImages.filter(image => !Object.hasOwn(selections, image.galleryId ?? image.songId) && gallerySelection(image.galleryId ?? image.songId, data))
    .map(image => ({ ...image, src: data.recordings?.[image.songId]?.path || image.src }));
  for (const [id, selection] of Object.entries(selections)) {
    if (!selection.enabled) continue;
    const song = songs.find(song => song.id === Number(id));
    const original = artistGalleryImages.find(image => (image.galleryId ?? image.songId) === Number(id));
    if (!song) {
      if (original) images.push(original);
      continue;
    }
    const src = selection.scope === 'artist'
      ? artistArtworkCandidates(song.artist, data)[0]
      : data.recordings?.[id]?.path || original?.src || songArtworkCandidates(song, undefined, data)[0];
    images.push({ songId: song.id, artist: song.artist, title: song.song, src });
  }
  return images;
}
