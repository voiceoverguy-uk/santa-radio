export interface Song {
  id: number;
  artist: string;
  song: string;
  info: string;
  image: string;
  lyrics: string;
}

import legacySongs from './legacy-songs.js';
const songs: Song[] = legacySongs;

export default songs;
