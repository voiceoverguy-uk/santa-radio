import songs from './songs.json' with { type: 'json' };

const normalize = value => value.normalize('NFKD').replace(/\p{M}/gu, '')
  .toLowerCase().replace(/\s*&\s*/g, ' and ').replace(/[’']/g, '')
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export default function relatedSongs(current, catalogue = songs) {
  if (!current) return [];
  const titles = new Set([normalize(current.song)]);
  return catalogue.filter(song => normalize(song.artist) === normalize(current.artist))
    .sort((a, b) => a.id - b.id)
    .filter(song => {
      const title = normalize(song.song);
      if (song.id === current.id || titles.has(title)) return false;
      titles.add(title);
      return true;
    }).sort((a, b) => a.song.localeCompare(b.song, 'en'));
}
