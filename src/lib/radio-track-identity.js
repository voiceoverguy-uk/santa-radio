// Do not collapse punctuation, accents or artist aliases: those can be different songs.
const normalise = value => value.trim().replace(/\s+/g, ' ').toLowerCase();
export const trackIdentity = track => track
  ? JSON.stringify([normalise(track.artist), normalise(track.title)]) : null;
