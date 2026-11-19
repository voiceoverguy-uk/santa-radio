import { matchLiveSong } from '../data/matchLiveSong.js';

// Website presentation only. Do not change the shared app feed or queue identity.
export function websiteNowPlayingTrack(track) {
  if (matchLiveSong(track).status !== 'unmatched') return track;
  const reversed = matchLiveSong({ artist: track.title, title: track.artist });
  return reversed.song ? { ...track, artist: reversed.song.artist, title: reversed.song.song } : track;
}
