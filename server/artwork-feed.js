import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import songs from '../src/data/songs.json' with { type: 'json' };
import { songPortraits } from '../src/data/songArtwork.js';

export const artworkFeedPath = '/artist-artwork/catalogue.json';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

// Pure contract builder with an injectable file reader for replacement/missing-file tests.
export async function buildArtworkFeed(mapping, {
  readImage = path => readFile(resolve('public', `.${path}`)),
  recordingMapping = songPortraits,
  catalogue = songs,
} = {}) {
  const verifiedRecordings = Object.entries(recordingMapping).sort(([a], [b]) => Number(a) - Number(b))
    .map(([id, assignment]) => {
      const matches = catalogue.filter(song => String(song.id) === id);
      if (!/^[1-9]\d*$/.test(id) || matches.length !== 1) {
        throw new Error(`Cannot publish artwork catalogue: recording ${id} must identify exactly one catalogue song`);
      }
      const song = matches[0];
      if (!assignment || typeof song.artist !== 'string' || !song.artist.trim() ||
          typeof song.song !== 'string' || !song.song.trim() ||
          assignment.artist !== song.artist || assignment.title !== song.song) {
        throw new Error(`Cannot publish artwork catalogue: recording ${id} artist/title does not match canonical catalogue`);
      }
      return [id, { artist: song.artist, title: song.song, path: assignment.path }];
    });
  const paths = [...new Set([mapping.fallbackArtwork,
    ...Object.keys(mapping.artistPortraits).map(mapping.artistArtwork),
    ...verifiedRecordings.map(([, recording]) => recording.path)])].sort();
  const images = new Map(await Promise.all(paths.map(async path => {
    if (!/^\/artist-artwork\/[a-z0-9-]+\.webp$/.test(path)) throw new Error(`Invalid artwork path: ${path}`);
    let bytes;
    try { bytes = await readImage(path); }
    catch (error) { throw new Error(`Cannot publish artwork catalogue: missing or unreadable image ${path}`, { cause: error }); }
    if (bytes.subarray(0, 4).toString() !== 'RIFF' || bytes.subarray(8, 12).toString() !== 'WEBP') {
      throw new Error(`Cannot publish artwork catalogue: invalid WebP ${path}`);
    }
    const version = digest(bytes);
    return [path, { path, version, url: `${path}?v=${version}` }];
  })));
  // Explicit Santa entries support mobile clients that only look up artist keys.
  // Keep the portrait mapping separate so website artwork-first ordering stays intact.
  const artistKeys = [...new Set([
    ...Object.keys(mapping.artistPortraits),
    ...catalogue.map(song => mapping.normalizeArtistName(song.artist)),
  ])].sort();
  const artists = Object.fromEntries(artistKeys.map(key =>
    [key, images.get(mapping.artistArtwork(key))]));
  const content = {
    schemaVersion: 1,
    refreshAfterSeconds: 300,
    fallback: images.get(mapping.fallbackArtwork),
    artists,
    recordings: Object.fromEntries(verifiedRecordings.map(([id, { artist, title, path }]) =>
      [id, { artist, title, image: images.get(path) }])),
  };
  return { ...content, version: digest(JSON.stringify(content)) };
}

// These are public, non-personal resources; no cookies or credentials are required.
export function artworkHeaders(req, res, next) {
  const pathname = new URL(req.url, 'http://server').pathname;
  if (!pathname.startsWith('/artist-artwork/')) { next(); return; }
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Cache-Control', 'no-cache');
  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
  next();
}
