import express from 'express';
import { createHmac } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { get, issueSignedToken } from '@vercel/blob';
import { handleUploadPresigned } from '@vercel/blob/client';
import { privateResponse, trustedAddress } from '../server/santa-name-security.js';
import { requestLimit } from '../server/contenders-store.js';

const types = { mp3:'audio/mpeg', jpg:'image/jpeg', png:'image/png', webp:'image/webp' };
const filename = /^[a-f0-9]{32}\.(mp3|jpg|png|webp)$/;
const prefix = 'song-submissions/';
const app = express();
app.use(express.json({limit:'4kb'}));
app.use(async (req,res) => {
  privateResponse(res);
  try {
    if (req.method === 'GET') {
      const file = req.query.file;
      const match = typeof file === 'string' && filename.exec(file);
      if (!match) return res.status(404).end();
      const media = await get(prefix + file,{access:'private'});
      if (!media?.stream) return res.status(404).end();
      res.setHeader('Content-Type','application/octet-stream');
      res.setHeader('Content-Disposition',`attachment; filename="Santa-Radio-${file}"`);
      await pipeline(Readable.fromWeb(media.stream),res);
      return;
    }
    if (req.method !== 'POST') return res.status(405).end();
    if (req.headers.origin !== 'https://' + req.headers.host || req.body?.type !== 'blob.generate-presigned-url') return res.status(403).end();
    const path = req.body.payload?.pathname;
    const match = typeof path === 'string' && path.startsWith(prefix) && filename.exec(path.slice(prefix.length));
    if (!match || req.body.payload.multipart) return res.status(400).end();
    const hour = Math.floor(Date.now()/3600000);
    const key = value => createHmac('sha256',process.env.SESSION_SECRET).update('song-upload:'+hour+':'+value).digest('hex');
    await requestLimit(key(trustedAddress(req)),12);
    await requestLimit(key('all-uploads'),120);
    const ext = match[1];
    const result = await handleUploadPresigned({request:req,body:req.body,getSignedToken:async pathname=>({
      token:await issueSignedToken({pathname,operations:['put'],allowedContentTypes:[types[ext]],
        maximumSizeInBytes:(ext==='mp3'?10:4)*1024*1024,validUntil:Date.now()+15*60*1000}),
      urlOptions:{allowOverwrite:false,addRandomSuffix:false}
    })});
    res.json(result);
  } catch (error) {
    if (!res.headersSent) res.status(error.status===429?429:503).json({error:'File unavailable. Please retry or use a link.'});
  }
});
export default app;
