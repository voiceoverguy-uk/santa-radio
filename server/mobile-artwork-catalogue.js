// Earlier Santa Radio apps discover a same-origin script from the home page and read
// its literals. Keep that input current alongside the versioned JSON feed.
import songs from '../src/data/songs.json' with { type: 'json' };
import mugshots from '../src/data/mugshots.json' with { type: 'json' };
import biographies from '../src/data/mugshot-biographies.json' with { type: 'json' };
import { identityAliases } from '../src/data/mugshot-catalogue.js';
import { artistPortraits } from '../src/data/artistArtwork.js';
import { songPortraits } from '../src/data/songArtwork.js';

const literal = (name, value) => 'const ' + name + '=' + JSON.stringify(value) + ';\n';
const catalogue = literal('songs', songs.map(({ id, artist, song, info, image }) => ({ id, artist, song, info, image })))
  + literal('mugshots', mugshots) + literal('aliases', identityAliases) + literal('biographies', biographies);
export function mobileArtworkCatalogue(overrides) {
  const portraits = Object.fromEntries(Object.entries(artistPortraits).map(([key, name]) => [key, name.replace(/\.webp$/, '')]));
  for (const [key, path] of Object.entries(overrides.artists)) portraits[key] = path.split('/').pop().replace(/\.webp$/, '');
  return catalogue + literal('portraits', portraits) + literal('recordings', { ...songPortraits, ...overrides.recordings })
    + 'function portrait(key){return `/artist-artwork/${portraits[key]}.webp`}';
}
