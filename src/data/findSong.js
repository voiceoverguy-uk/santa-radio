import songs from './songs.json' with { type: 'json' };
import { duplicateRecordings } from '../seo/catalogue.js';

export default function findSong(rawSlug = '') {
  const slug = rawSlug.replace(/[?&#]/g, '');
  // Old URLs take priority when a historic ID pointed to a different song.
  const alias = songs.find(song => song.aliases?.includes(slug));
  if (alias) return songs.find(s => s.id === duplicateRecordings.get(alias.id)) || alias;
  const exact = songs.find(song => `${song.id}-${song.link}` === slug);
  if (exact) return songs.find(s => s.id === duplicateRecordings.get(exact.id)) || exact;
  if (/^\d+$/.test(slug)) return songs.find(song => song.id === Number(slug));
  return songs.find(song => song.link === slug.replace(/^\d+-/, ''));
}
