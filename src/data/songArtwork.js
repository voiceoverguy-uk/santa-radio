import { artistArtwork, fallbackArtwork, normalizeArtistName } from './artistArtwork.js';
import { normalizeTrackText } from './matchLiveSong.js';

// Website-only assignments, never added to the artist-based mobile feed.
// Verify the catalogue ID, artist and title before assigning a supplied image.
export const songPortraits = Object.freeze({
  24: Object.freeze({
    artist: 'Mariah Carey',
    title: 'All I Want For Christmas Is You',
    path: '/artist-artwork/mariah-carey-all-i-want-for-christmas-is-you.webp',
  }),
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
  40: Object.freeze({
    artist: 'The Jackson 5',
    title: 'Santa Claus Is Coming To Town',
    path: '/artist-artwork/jackson-5-santa-claus-is-coming-to-town.webp',
  }),
  43: Object.freeze({
    artist: 'Gabriella Cilmi',
    title: 'Warm this Winter',
    path: '/artist-artwork/gabriella-cilmi-warm-this-winter.webp',
  }),
  46: Object.freeze({
    artist: 'Frank Sinatra',
    title: 'Let It Snow! Let It Snow! Let It Snow!',
    path: '/artist-artwork/frank-sinatra-let-it-snow.webp',
  }),
  457: Object.freeze({
    artist: 'Sia',
    title: "Santa's Coming For Us",
    path: '/artist-artwork/sia-santas-coming-for-us.webp',
  }),
  480: Object.freeze({
    artist: 'Sia',
    title: 'My Old Santa Claus',
    path: '/artist-artwork/sia-my-old-santa-claus.webp',
  }),
  527: Object.freeze({
    artist: 'Ariana Grande',
    title: 'Winter Things',
    path: '/artist-artwork/ariana-grande-winter-things.webp',
  }),
  537: Object.freeze({
    artist: 'Sia',
    title: 'Candy Cane Lane',
    path: '/artist-artwork/sia-candy-cane-lane.webp',
  }),
  538: Object.freeze({
    artist: 'Sia',
    title: 'Naughty & Nice',
    path: '/artist-artwork/sia-naughty-and-nice.webp',
  }),
  557: Object.freeze({
    artist: 'Freya Skye',
    title: 'Snow Angels',
    path: '/artist-artwork/freya-skye-snow-angels.webp',
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
