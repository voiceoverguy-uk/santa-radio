import { artistArtwork, fallbackArtwork } from './artistArtwork.js';

export function randomSongOrder(catalogue, random = Math.random) {
  const songs = [...catalogue];
  for (let i = songs.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [songs[i], songs[j]] = [songs[j], songs[i]];
  }
  // Partition after shuffling: both groups stay random, with no songs removed.
  const portraits = [];
  const placeholders = [];
  for (const song of songs) {
    (artistArtwork(song.artist) === fallbackArtwork ? placeholders : portraits).push(song);
  }
  return [...portraits, ...placeholders];
}
