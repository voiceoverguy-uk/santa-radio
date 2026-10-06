import songs from './songs.json' with { type: 'json' };

export default function findSong(rawSlug = '') {
  const slug = rawSlug.replace(/[?&#]/g, '');
  // Old URLs take priority when a historic ID pointed to a different song.
  const alias = songs.find(song => song.aliases?.includes(slug));
  if (alias) return alias;
  const exact = songs.find(song => `${song.id}-${song.link}` === slug);
  if (exact) return exact;
  if (/^\d+$/.test(slug)) return songs.find(song => song.id === Number(slug));
  return songs.find(song => song.link === slug.replace(/^\d+-/, ''));
}
