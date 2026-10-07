import songs from './songs.json' with { type: 'json' };

// Add only verified exceptions: { artist: feedArtist, title: feedTitle, songId: catalogueId }.
// Never strip version labels or guess an artist from a title alone.
export const liveSongAliases = [
  { artist: 'Gladys Knight & The Pips', title: "It's Christmas Everyday", songId: 212 },
  { artist: 'Mike Oldfield', title: 'Il Dulci Jubilo', songId: 135 },
  // Feed repeats the artist in the title; verified against the catalogue lyrics.
  { artist: 'Bo Selecta', title: 'Bo Selecta - Proper Crimbo', songId: 66 },
  // Truncated titles observed in the live feed; explicit rather than fuzzy prefixes.
  { artist: 'Michael Buble', title: 'Santa Claus Is Co', songId: 335 },
  { artist: 'Dean Martin', title: 'Let It Snow! Let It Snow! Let I', songId: 369 },
];
export const normalizeTrackText = text => text.normalize('NFKC').toLowerCase()
  .replace(/[’‘']/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');

// Standardise credit markers, but preserve the credited names and version labels.
// The feed sometimes leaves a dangling "ft." with no credited artist (Bad Sharon).
const normalizeTitleCredits = text => normalizeTrackText(text)
  .replace(/\s+(?:ft|feat|featuring)$/, '')
  .replace(/\s+(?:ft|featuring)\s+/g, ' feat ');

export const hasUsableLyrics = song => Boolean(song.lyrics?.trim()) &&
  !/^We are working on it\. If you can help, please use the form below$/i.test(song.lyrics.trim());

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
  if (!matches.length) {
    matches = catalogue.filter(s => same(s.artist, track.artist) &&
      normalizeTitleCredits(s.song) === normalizeTitleCredits(track.title));
  }
  if (matches.length > 1) {
    // Historical duplicates may keep their URLs without blocking identical lyrics.
    // Different wording or different title/version labels still require review.
    const first = matches[0];
    const identical = matches.every(s => s.artist === first.artist && s.song === first.song &&
      s.lyrics?.trim() === first.lyrics?.trim());
    if (!identical) return { status: 'ambiguous' };
    matches = [matches.reduce((a, b) => a.id < b.id ? a : b)];
  }
  if (!matches.length) return { status: 'unmatched' };
  return { status: hasUsableLyrics(matches[0]) ? 'ready' : 'empty', song: matches[0] };
}
