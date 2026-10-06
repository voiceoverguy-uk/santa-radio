import songs from './songs.json' with { type: 'json' };

// Add only verified exceptions: { artist: feedArtist, title: feedTitle, songId: catalogueId }.
// Never strip version labels or guess an artist from a title alone.
export const liveSongAliases = [
  // Feed repeats the artist in the title; verified against the catalogue lyrics.
  { artist: 'Bo Selecta', title: 'Bo Selecta - Proper Crimbo', songId: 66 },
];
export const normalizeTrackText = text => text.normalize('NFKC').toLowerCase()
  .replace(/[’‘']/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');

export function matchLiveSong(track, catalogue = songs, aliases = liveSongAliases) {
  if (!track || typeof track.artist !== 'string' || typeof track.title !== 'string' ||
      !track.artist.trim() || !track.title.trim()) return { status: 'unavailable' };
  const same = (a, b) => normalizeTrackText(a) === normalizeTrackText(b);
  let matches = catalogue.filter(s => s.artist === track.artist && s.song === track.title);
  if (!matches.length) matches = catalogue.filter(s => same(s.artist, track.artist) && same(s.song, track.title));
  if (!matches.length) {
    const verified = aliases.filter(a => same(a.artist, track.artist) && same(a.title, track.title));
    if (verified.length > 1) return { status: 'ambiguous' };
    if (verified.length === 1) matches = catalogue.filter(s => s.id === verified[0].songId);
  }
  if (matches.length > 1) return { status: 'ambiguous' };
  if (!matches.length) return { status: 'unmatched' };
  return { status: matches[0].lyrics?.trim() ? 'ready' : 'empty', song: matches[0] };
}
