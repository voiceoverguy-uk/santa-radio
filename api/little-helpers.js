import express from 'express';
import { Readable } from 'node:stream';
import { validOwnerToken } from '../server/studio-owner-handler.js';
import { syncClips, maintainClips, clipReport, changeClip, clipAudio } from '../server/little-helpers.js';
export function createLittleHelpersHandler({authorize=validOwnerToken,sync=syncClips,maintain=maintainClips,report=clipReport,change=changeClip,audio=clipAudio}={}) {
const app=express();
app.use((req,res,next)=>{
 res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(!authorize(req)) return res.status(401).json({error:'Owner sign-in required.'});
 if(!['GET','PATCH'].includes(req.method)) return res.status(405).end();
 if(req.headers['sec-fetch-site']==='cross-site' || (req.method==='PATCH' && req.headers.origin && req.headers.origin!=='https://www.santaradio.co.uk' && req.headers.origin!==`https://${req.headers.host}`)) return res.status(403).end();
 if(req.method==='PATCH' && !req.is('application/json')) return res.status(415).end();
 next();
});
app.use(express.json({limit:'2kb'}));
app.use(async(req,res)=>{
 try {
  if(req.method==='GET' && req.query.audio){
   const recording=await audio(req.query.audio);
   if(!recording)return res.status(404).json({error:'Recording unavailable.'});
   res.setHeader('Content-Type',recording.pathname.endsWith('.wav')?'audio/wav':recording.pathname.endsWith('.mp3')?'audio/mpeg':'audio/mp4');
   res.setHeader('Content-Disposition',`inline; filename="${recording.pathname.split('/').pop()}"`);
   const stream=Readable.fromWeb(recording.stream);stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());return stream.pipe(res);
  }
  if(req.method==='PATCH') await change(req.body || {});
  else await sync();
  await maintain();
  res.json(await report(req.query));
 }catch(e){res.status(e.status || 503).json({error:e.status?e.message:'Little Helpers could not load. Please retry.'});}
});
app.use((_e,_req,res,_next)=>res.status(400).json({error:'Invalid request.'}));
return app;
}
export default createLittleHelpersHandler();
