import songs from './songs.json' with { type: 'json' };
import { duplicateRecordings, songs as publicSongs } from '../seo/catalogue.js';

export default function findSong(rawSlug = '') {
  const slug = rawSlug.replace(/[?&#]/g, '');
  const match = songs.find(song => song.aliases?.includes(slug)) ||
    songs.find(song => `${song.id}-${song.link}` === slug) ||
    (/^\d+$/.test(slug) ? songs.find(song => song.id === Number(slug)) : null) ||
    songs.find(song => song.link === slug.replace(/^\d+-/, ''));
  if (!match) return undefined;
  // Every historic route, including ID-only and link-only forms, resolves to
  // the same retained record used by the public catalogue.
  const canonicalId = duplicateRecordings.get(match.id) ?? match.id;
  return publicSongs.find(song => song.id === canonicalId);
}
