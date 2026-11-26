import express from 'express';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import ffmpeg from 'ffmpeg-static';
import { validOwnerToken } from './studio-owner-handler.js';
import { getClerkProxyHost } from './middlewares/clerkProxyMiddleware.js';
import { mobileArtworkCatalogue } from './mobile-artwork-catalogue.js';
import { artworkTarget, mergeArtworkFeed, readArtworkImage, readArtworkOverrides, saveArtwork } from './catalogue-artwork-store.js';

const run = promisify(execFile);
const badImage = () => Object.assign(new Error('Choose a readable JPG, PNG or WebP image.'), { status: 400 });
export async function encodeArtwork(jpeg) {
  if (typeof jpeg !== 'string' || jpeg.length > 2100000 || !jpeg.startsWith('/9j/')) throw badImage();
  const input = Buffer.from(jpeg, 'base64');
  const dir = await mkdtemp(join(tmpdir(), 'sr-art-'));
  try {
    const file = join(dir, 'art.jpg');
    await writeFile(file, input);
    // The editor supplies a square JPEG. Decode and re-encode one frame before publication.
    try {
      const { stdout } = await run(ffmpeg, ['-hide_banner','-loglevel','error','-nostdin','-xerror',
        '-f','mjpeg','-max_pixels','1048576','-i',file,'-frames:v','1','-vf','crop=min(iw\\,ih):min(iw\\,ih)',
        '-map_metadata','-1','-c:v','libwebp','-quality','88','-f','webp','pipe:1'],
        { encoding:'buffer', maxBuffer:2097152, timeout:15000 });
      if (stdout.length < 20 || stdout.toString('ascii',8,12) !== 'WEBP') throw badImage();
      return stdout;
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'EACCES') throw error;
      throw badImage();
    }
  } finally { await rm(dir, { recursive:true, force:true }); }
}

const readBase = async () => JSON.parse(await readFile(join(process.cwd(), 'dist/artist-artwork/catalogue.json'), 'utf8'));
export function createCatalogueArtwork({ owner = validOwnerToken, list = readArtworkOverrides,
  image = readArtworkImage, save = saveArtwork, encode = encodeArtwork, base = readBase } = {}) {
  const app = express();
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store').set('X-Content-Type-Options', 'nosniff');
    if (req.method === 'OPTIONS') return res.set('Access-Control-Allow-Origin','*').set('Access-Control-Allow-Methods','GET, HEAD, OPTIONS').status(204).end();
    if (['GET','HEAD'].includes(req.method)) return next();
    if (req.method !== 'POST') return res.status(405).set('Allow','GET, HEAD, OPTIONS, POST').end();
    if (!owner(req)) return res.status(401).json({ error: 'Unlock the dashboard to save artwork.' });
    let origin;
    try { origin = new URL(req.headers.origin).host; } catch { /* No matching origin. */ }
    if (!origin || origin !== getClerkProxyHost(req) || req.headers['sec-fetch-site'] === 'cross-site') {
      return res.status(403).json({ error: 'Save artwork from the owner dashboard.' });
    }
    if (!req.is('application/json')) return res.status(415).end();
    next();
  });
  app.use(express.json({ limit:'2200kb', inflate:false }));
  app.use(async (req, res) => {
    if (req.method === 'POST') {
      if (req.query.feed || req.query.image || req.query.mobile) return res.status(405).end();
      const target = artworkTarget(req.body?.id, req.body?.scope);
      if (!target) return res.status(400).json({ error: 'Choose a catalogue recording and artwork scope.' });
      const path = await save(target, await encode(req.body.jpeg));
      return res.json({ path });
    }
    res.set('Access-Control-Allow-Origin','*');
    if (req.query.image !== undefined) {
      if (typeof req.query.image !== 'string' || !/^[a-f0-9]{64}$/.test(req.query.image)) return res.status(404).end();
      const bytes = await image(req.query.image);
      if (!bytes) return res.status(404).end();
      return res.set('Cache-Control','public, max-age=31536000, immutable').type('image/webp').send(bytes);
    }
    const overrides = await list();
    if (req.query.mobile === '1') {
      return res.set('Vercel-CDN-Cache-Control','public, s-maxage=30').type('application/javascript').send(mobileArtworkCatalogue(overrides));
    }
    if (req.query.feed === '1') {
      const feed = mergeArtworkFeed(await base(), overrides);
      return res.set('Cache-Control','no-cache').set('Vercel-CDN-Cache-Control','public, s-maxage=30').json(feed);
    }
    if (req.query.edit !== '1') res.set('Vercel-CDN-Cache-Control','public, s-maxage=30');
    return res.json(overrides);
  });
  app.use((error, _req, res, _next) => {
    const status = error.status === 413 ? 413 : error.status === 400 ? 400 : 503;
    const message = status === 413 ? 'This image is too large.' : status === 400 ? 'Choose a readable JPG, PNG or WebP image.' : 'The artwork library is temporarily unavailable. Please try again.';
    res.status(status).json({ error: message });
  });
  return app;
}
const catalogueArtwork = createCatalogueArtwork();
export default catalogueArtwork;

// The public feed and image URLs stay on the website origin for existing app clients.
export function catalogueArtworkRoute(req, res, next) {
  const pathname = new URL(req.url, 'http://local').pathname;
  const image = /^\/artist-artwork\/upload-([a-f0-9]{64})\.webp$/.exec(pathname);
  let query;
  if (image) query = 'image=' + image[1];
  else if (pathname === '/artist-artwork/catalogue.json') query = 'feed=1';
  else if (pathname === '/assets/radio-catalogue.js') query = 'mobile=1';
  else return next();
  if (!['GET','HEAD','OPTIONS'].includes(req.method)) return res.writeHead(405, { Allow:'GET, HEAD, OPTIONS' }).end();
  req.url = '/api/catalogue-artwork?' + query;
  return catalogueArtwork(req, res);
}
