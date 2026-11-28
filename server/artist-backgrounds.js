import express from 'express';
import { databasePool } from './name-request-store.js';
import { validOwnerToken } from './studio-owner-handler.js';
import { getClerkProxyHost } from './middlewares/clerkProxyMiddleware.js';
import { backgroundArtists, backgroundArtistByKey } from '../src/data/artist-backgrounds.js';

export async function readBackgrounds(pool = databasePool()) {
  const { rows } = await pool.query('SELECT artist_key, background, revision FROM santa_artist_backgrounds');
  return Object.fromEntries(rows.filter(row => backgroundArtistByKey.has(row.artist_key))
    .map(row => [row.artist_key, { text: row.background, revision: row.revision }]));
}
export async function saveBackground(body, pool = databasePool()) {
  if (!body || typeof body.key !== 'string' || !backgroundArtistByKey.has(body.key) ||
      typeof body.text !== 'string' || !body.text.trim() || body.text.trim().length > 8000 ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(body.text) ||
      !Number.isSafeInteger(body.revision) || body.revision < 0) {
    throw Object.assign(new Error('Choose an artist and enter between 1 and 8,000 characters.'), { status: 400 });
  }
  const text = body.text.trim();
  const result = body.revision === 0
    ? await pool.query(`INSERT INTO santa_artist_backgrounds(artist_key,background)
        VALUES($1,$2) ON CONFLICT(artist_key) DO NOTHING RETURNING revision`, [body.key, text])
    : await pool.query(`UPDATE santa_artist_backgrounds SET background=$2, revision=revision+1, updated_at=now()
        WHERE artist_key=$1 AND revision=$3 RETURNING revision`, [body.key, text, body.revision]);
  if (!result.rows.length) throw Object.assign(new Error('This artist was updated elsewhere. Reload the saved text before saving again.'), { status: 409 });
  return { key: body.key, text, revision: result.rows[0].revision };
}
export function createArtistBackgrounds({ owner = validOwnerToken, read = readBackgrounds, save = saveBackground } = {}) {
  const app = express();
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store').set('X-Content-Type-Options', 'nosniff');
    if (!['GET', 'HEAD', 'POST'].includes(req.method)) return res.status(405).set('Allow', 'GET, HEAD, POST').end();
    if ((req.method === 'POST' || req.query.edit === '1') && !owner(req)) return res.status(401).json({ error: 'Unlock the dashboard to edit artist backgrounds.' });
    if (req.method === 'POST') {
      let origin;
      try { origin = new URL(req.headers.origin).host; } catch { /* Reject missing origin. */ }
      if (!origin || origin !== getClerkProxyHost(req) || req.headers['sec-fetch-site'] === 'cross-site') return res.status(403).json({ error: 'Save from the owner dashboard.' });
      if (!req.is('application/json')) return res.status(415).end();
    }
    next();
  });
  app.use(express.json({ limit: '40kb', inflate: false }));
  app.use(async (req, res, next) => {
    try {
      if (req.method === 'POST') return res.json(await save(req.body));
      const backgrounds = await read();
      if (req.query.edit === '1') return res.json({ artists: backgroundArtists.map(artist => ({ ...artist,
        text: backgrounds[artist.key]?.text ?? artist.text, revision: backgrounds[artist.key]?.revision ?? 0 })) });
      return res.json({ backgrounds: Object.fromEntries(Object.entries(backgrounds).map(([key, value]) => [key, value.text])) });
    } catch (error) { next(error); }
  });
  app.use((error, _req, res, _next) => {
    const status = [400, 409, 413].includes(error.status) ? error.status : 503;
    res.status(status).json({ error: status === 503 ? 'Artist backgrounds are temporarily unavailable. Please try again.' : error.message });
  });
  return app;
}
export default createArtistBackgrounds();
