import songs from './songs.json' with { type: 'json' };
import { artistGalleryImages } from './artistGalleryImages.js';
import { artistArtworkCandidates, songArtworkCandidates } from './songArtwork.js';

export function gallerySelection(songId, data) {
  return data?.gallery?.[songId]?.enabled ?? artistGalleryImages.some(image => image.songId === songId);
}

export function managedArtistGallery(data = {}) {
  const selections = data.gallery || {};
  const images = artistGalleryImages.filter(image => !Object.hasOwn(selections, image.songId))
    .map(image => ({ ...image, src: data.recordings?.[image.songId]?.path || image.src }));
  for (const [id, selection] of Object.entries(selections)) {
    if (!selection.enabled) continue;
    const song = songs.find(song => song.id === Number(id));
    if (!song) continue;
    const src = selection.scope === 'artist'
      ? artistArtworkCandidates(song.artist, data)[0]
      : songArtworkCandidates(song, undefined, data)[0];
    images.push({ songId: song.id, artist: song.artist, title: song.song, src });
  }
  return images;
}
