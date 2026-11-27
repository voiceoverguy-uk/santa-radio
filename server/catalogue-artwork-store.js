import { createHash } from 'node:crypto';
import { databasePool } from './name-request-store.js';
import { normalizeArtistName } from '../src/data/artistArtwork.js';
import songs from '../src/data/songs.json' with { type: 'json' };

const recordings = new Map(songs.map(song => [song.id, song]));
const digest = data => createHash('sha256').update(data).digest('hex');
// Explicit alternate credits also used by the native artwork readers. Artists
// sharing a stock picture (e.g. Holly Johnson and Frankie) remain independent.
const creditGroups = [
  ['Beverley Knight','Beverly Knight'],
  ['Tom Jones & Cerys Matthews','Tom Jones & C Matthews','Tom Jones and Cerys Matthews'],
  ['The Pointer Sisters','Pointer Sisters'], ['Waitresses','The Waitresses'],
  ['Tom Petty & Heartbreakers','Tom Petty & The Heartbreakers','Tom Petty and the Heartbreakers'],
  ['Hall & Oates','Hall and Oates'], ['The Beach Boys','Beach Boys'],
  ['Ella Fitzgerald & Louis Armstrong','Ella Fitzgerald and Louis Armstrong'],
  ['Bing Crosby & Rosemary Clooney','Bing Crosby and Rosemary Clooney'],
  ['Elsa and Anna','Elsa & Anna'], ['Lindsey Lohan','Lindsay Lohan'],
  ['Paul Burling & Joseph Bell','Paul Burling and Joseph Bell'],
].map(group => group.map(normalizeArtistName));
const credits = new Map(creditGroups.flatMap(group => group.map(key => [key, group])));
const imagePath = hash => '/artist-artwork/upload-' + hash + '.webp';

export function artworkTarget(id, scope) {
  const song = recordings.get(id);
  if (!song || !['artist', 'song'].includes(scope)) return null;
  const artistKey = normalizeArtistName(song.artist);
  const key = scope === 'artist' ? credits.get(artistKey)?.[0] ?? artistKey : String(id);
  return { scope, key, artist: song.artist, title: scope === 'song' ? song.song : '' };
}

export async function saveArtwork(target, bytes, pool = databasePool()) {
  const hash = digest(bytes);
  // One statement commits the immutable image and the chosen assignment together.
  await pool.query(`
    WITH stored AS (
      INSERT INTO santa_catalogue_artwork_images(hash, webp) VALUES ($1,$2)
      ON CONFLICT (hash) DO NOTHING
    )
    INSERT INTO santa_catalogue_artwork_assignments(scope,target_key,artist,title,hash)
    VALUES ($3,$4,$5,$6,$1)
    ON CONFLICT (scope,target_key) DO UPDATE SET
      artist=EXCLUDED.artist, title=EXCLUDED.title, hash=EXCLUDED.hash
  `, [hash, bytes, target.scope, target.key, target.artist, target.title]);
  return imagePath(hash);
}

export async function readArtworkOverrides(pool) {
  const artists = {}, recordings = {};
  if (pool || process.env.DATABASE_URL) {
    const { rows } = await (pool || databasePool()).query(
      'SELECT scope,target_key,artist,title,hash FROM santa_catalogue_artwork_assignments ORDER BY scope,target_key'
    );
    for (const row of rows) {
      const path = imagePath(row.hash);
      if (row.scope === 'artist') {
        for (const key of credits.get(row.target_key) ?? [row.target_key]) artists[key] = path;
      } else {
        const target = artworkTarget(Number(row.target_key), 'song');
        // Preserve artwork saved before this catalogue spelling correction.
        const legacyBeverley = Number(row.target_key) === 493 &&
          target?.artist === 'Beverley Knight' && row.artist === 'Beverly Knight';
        if (target && (target.artist === row.artist || legacyBeverley) && target.title === row.title) {
          recordings[row.target_key] = { artist: target.artist, title: target.title, path };
        }
      }
    }
  }
  return { artists, recordings };
}

export async function readArtworkImage(hash, pool = databasePool()) {
  const { rows } = await pool.query('SELECT webp FROM santa_catalogue_artwork_images WHERE hash=$1', [hash]);
  return rows[0]?.webp;
}

export function mergeArtworkFeed(base, overrides) {
  if (!Object.keys(overrides.artists).length && !Object.keys(overrides.recordings).length) return base;
  function image(path) {
    const version = path.slice('/artist-artwork/upload-'.length, -'.webp'.length);
    return { path, version, url: path + '?v=' + version };
  }
  const { version: oldVersion, ...content } = base;
  const artists = { ...base.artists }, recordings = { ...base.recordings };
  for (const [key, path] of Object.entries(overrides.artists)) artists[key] = image(path);
  for (const [id, { artist, title, path }] of Object.entries(overrides.recordings)) {
    recordings[id] = { artist, title, image: image(path) };
  }
  const merged = { ...content, artists, recordings };
  return { ...merged, version: digest(JSON.stringify(merged)) };
}
