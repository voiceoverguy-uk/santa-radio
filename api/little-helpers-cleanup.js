import { timingSafeEqual } from 'node:crypto';
import { maintainClips, syncClips } from '../server/little-helpers.js';
export const config={maxDuration:60};
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');
 const expected=Buffer.from('Bearer '+(process.env.CRON_SECRET||'')),given=Buffer.from(req.headers.authorization||'');
 if(!process.env.CRON_SECRET || expected.length!==given.length || !timingSafeEqual(expected,given))return res.status(401).end();
 if(req.method!=='GET')return res.status(405).end();
 try{await syncClips();res.json(await maintainClips());}catch{res.status(503).json({error:'Clip cleanup needs retry.'});}
}
