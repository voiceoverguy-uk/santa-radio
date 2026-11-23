import { VERSION, MAX_BYTES, problem, rateLimit, authorise, readTicket, validateAudio, saveRecording } from '../server/helper-submissions.js';
export const config={api:{bodyParser:false}};
export default async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST')return res.status(405).json({error:'Use POST.'});
  const origin=req.headers.origin;
  if(req.headers['sec-fetch-site']==='cross-site'||(origin&&!['https://www.santaradio.co.uk','https://santaradio.co.uk'].includes(origin)))return res.status(403).json({error:'Request not allowed.'});
  const action=req.query?.action;
  try {
    if(!['authorise','upload'].includes(action))throw problem('Unknown action.');
    let ticket;
    if(action==='upload') {
      ticket=readTicket(String(req.headers.authorization||'').replace(/^Bearer /,''));
      if(!ticket)throw problem('Permission session expired. Please review and send again.',401);
      await rateLimit(req,undefined,true);
    }
    const limit=action==='upload'?MAX_BYTES:2048;
    if(Number(req.headers['content-length'])>limit)throw problem('Request too large.',413);
    const chunks=[];let size=0;
    for await(const chunk of req){size+=chunk.length;if(size>limit)throw problem('Request too large.',413);chunks.push(chunk);}
    const buffer=Buffer.concat(chunks);
    if(action==='authorise') {
      if(!String(req.headers['content-type']||'').startsWith('application/json'))throw problem('Use JSON.');
      let fields;try{fields=JSON.parse(buffer);}catch{throw problem('Invalid request.');}
      if(fields.adult!==true||fields.permission!==true||fields.version!==VERSION)throw problem('An adult must agree to the recording permissions.');
      await rateLimit(req);
      return res.status(201).json(await authorise(fields));
    }
    let duration;try{duration=await validateAudio(buffer,String(req.headers['content-type']||'').split(';')[0]);}catch{throw problem('Please send a valid recording of up to 20 seconds.');}
    return res.status(201).json(await saveRecording(ticket,buffer,duration));
  } catch(error) {return res.status(error.status||503).json({error:error.status?error.message:'Sending is temporarily unavailable. Your recording is still on this device; please retry.'});}
}
