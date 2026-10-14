import { artistArtwork, fallbackArtwork, normalizeArtistName } from './artistArtwork.js';
import { normalizeTrackText } from './matchLiveSong.js';

// Website-only assignments, never added to the artist-based mobile feed.
// Verify the catalogue ID, artist and title before assigning a supplied image.
export const songPortraits = Object.freeze({
  75: Object.freeze({
    artist: 'Ariana Grande',
    title: 'Last Christmas',
    path: '/artist-artwork/ariana-grande-last-christmas.webp',
  }),
  399: Object.freeze({
    artist: 'Elvis Presley',
    title: 'Blue Christmas',
    path: '/artist-artwork/elvis-presley-blue-christmas.webp',
  }),
  527: Object.freeze({
    artist: 'Ariana Grande',
    title: 'Winter Things',
    path: '/artist-artwork/ariana-grande-winter-things.webp',
  }),
});

export function songArtworkCandidates(song, overrides = songPortraits) {
  const artist = typeof song?.artist === 'string' ? song.artist : '';
  const override = Object.hasOwn(overrides, song?.id) ? overrides[song.id] : null;
  const verified = override && artist && typeof song?.song === 'string' &&
    normalizeArtistName(artist) === normalizeArtistName(override.artist) &&
    normalizeTrackText(song.song) === normalizeTrackText(override.title);
  return [...new Set([
    verified ? override.path : null,
    artistArtwork(artist),
    fallbackArtwork,
  ].filter(Boolean))];
}

export function songArtwork(song, overrides = songPortraits) {
  return songArtworkCandidates(song, overrides)[0];
}
