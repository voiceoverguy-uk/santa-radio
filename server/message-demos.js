import express from 'express';
import { randomUUID } from 'node:crypto';
import { del, list, put, issueSignedToken, presignUrl } from '@vercel/blob';
import { validOwnerToken } from './studio-owner-handler.js';
import { getClerkProxyHost } from './middlewares/clerkProxyMiddleware.js';
import { builtInDemos, demoGroups, maxDemoBytes } from '../src/lib/messageDemoCatalogue.js';

const uploadId = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\.([A-Za-z0-9_-]{2,320})\.mp3$/;
const prefix = group => 'message-example-audio/' + group + '/';
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const mime = 'audio/mpeg';

export function createMessageDemos({ storage = { list, put, del, issueSignedToken, presignUrl }, owner = validOwnerToken } = {}) {
  const app = express();
  app.use((req, res, next) => {
    res.set('Cache-Control', 'private, no-store').set('X-Robots-Tag', 'noindex');
    if (typeof req.query.group !== 'string' || !Object.hasOwn(demoGroups, req.query.group)) return res.status(400).json({error: 'Choose Free, Kids or Dads.'});
    if (req.method === 'GET' || req.method === 'HEAD') return next();
    if (req.method !== 'POST') return res.status(405).set('Allow', 'GET, HEAD, POST').end();
    if (!owner(req)) return res.status(401).json({error: 'Owner sign-in required.'});
    let origin;
    try { origin = new URL(req.headers.origin).host; } catch { /* Missing origin. */ }
    if (origin !== getClerkProxyHost(req) || req.headers['sec-fetch-site'] === 'cross-site') return res.status(403).json({error:'Open the owner dashboard to manage demos.'});
    next();
  });
  app.use(express.json({ limit: '4kb' }));
  app.use(async (req, res) => {
    const group = req.query.group;
    const root = prefix(group);
    try {
      if (req.method === 'GET' || req.method === 'HEAD') {
        if (req.query.play !== undefined) {
          const id = req.query.play;
          if (typeof id !== 'string' || !uploadId.test(id)) return res.status(404).end();
          const pathname = root + 'files/' + id;
          const signed = await storage.issueSignedToken({pathname, operations:['get'], validUntil:Date.now() + 1800000});
          const {presignedUrl} = await storage.presignUrl(signed, {pathname, operation:'get', access:'private'});
          return res.redirect(307, presignedUrl);
        }
        const hidden = new Set(), additions = [];
        let cursor;
        do {
          const page = await storage.list({prefix:root, cursor, limit:1000});
          for (const blob of page.blobs) {
            const relative = blob.pathname.slice(root.length);
            if (relative.startsWith('hidden/')) hidden.add(relative.slice(7));
            if (!relative.startsWith('files/')) continue;
            const id = relative.slice(6), match = uploadId.exec(id);
            if (match) additions.push({id, name:Buffer.from(match[1],'base64url').toString('utf8'), src:'/api/message-demos?group=' + group + '&play=' + id, added:new Date(blob.uploadedAt).getTime()});
          }
          cursor = page.hasMore ? page.cursor : undefined;
        } while (cursor);
        additions.sort((a,b) => b.added - a.added || a.id.localeCompare(b.id));
        return res.json({demos:[...additions, ...builtInDemos[group].filter(demo => !hidden.has(demo.id))]});
      }

      const body = req.body ?? {};
      if (body.action === 'upload') {
        const name = typeof body.name === 'string' ? body.name.trim().normalize('NFC') : '';
        if (!name || /[\x00-\x1f\x7f]/u.test(name) || name.length > 60) fail(400,'Enter a demo name of up to 60 characters.');
        const size = typeof body.size === 'string' && /^\d+$/.test(body.size) ? Number(body.size) : body.size;
        if (!Number.isInteger(size) || size < 1 || size > maxDemoBytes) fail(400,'Choose an MP3 of up to 40 MB.');
        const id = randomUUID() + '.' + Buffer.from(name).toString('base64url') + '.mp3';
        const pathname = root + 'files/' + id;
        const signed = await storage.issueSignedToken({pathname, operations:['put'], allowedContentTypes:[mime], maximumSizeInBytes:size, validUntil:Date.now() + 900000});
        const {presignedUrl} = await storage.presignUrl(signed,{pathname, operation:'put', access:'private', addRandomSuffix:false, allowOverwrite:false});
        return res.json({id, url:presignedUrl, headers:{'Content-Type':mime, 'x-content-type':mime, 'x-vercel-blob-access':'private', 'x-api-version':'13'}});
      }
      if (body.action === 'delete') {
        if (typeof body.id !== 'string') fail(400,'Choose a demo.');
        if (builtInDemos[group].some(demo => demo.id === body.id)) {
          await storage.put(root+'hidden/'+body.id, '1', {access:'private',allowOverwrite:true,addRandomSuffix:false});
        } else if (uploadId.test(body.id)) {
          await storage.del(root+'files/'+body.id);
        } else fail(400,'Choose a demo from this category.');
        return res.json({ok:true});
      }
      fail(400,'Unknown demo action.');
    } catch (error) {
      if (error.status === 400) return res.status(400).json({error:error.message});
      return res.status(503).json({error:'The demo library is temporarily unavailable. Please try again.'});
    }
  });
  return app;
}
export default createMessageDemos();
