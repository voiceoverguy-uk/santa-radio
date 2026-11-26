import { randomUUID } from 'node:crypto';
import { dadSupportStatus, recordDadFailure } from './dad-recording-support.js';
import { dadVoucherAllowanceIdentity, dadVoucherSession } from './dad-vouchers.js';
import {existsSync} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {blobDadLibrary} from './blob-dad-library.js';
import {santaNameLibrary} from './santa-name-library.js';
import {consumeNameAccess,privateResponse,readNameJson} from './santa-name-security.js';
import {sameStudioOrigin} from './santa-studio-message.js';
import {livePaidPurchaseId} from './dad-live-access.js';
import {workshopSession} from './santa-workshop-access.js';
import {digest} from './dad-live-store.js';
import {studioAllowanceStore} from './dad-creation-allowance.js';
import {studioAllowanceStore as sharedAllowanceStore} from './studio-creation-allowance.js';
import {renderDadMessage} from './dad-render.js';
const fail=(status,message)=>Object.assign(new Error(message),{status});
export async function dadIdentity(req){
 if(workshopSession(req)?.admin)return null;
 const voucher=dadVoucherSession(req);
 if(voucher)return dadVoucherAllowanceIdentity(voucher);
 const purchase=await livePaidPurchaseId(req);
 if(!purchase)throw fail(403,'Please purchase Dad Studio access or reopen your private return link.');
 return {key:digest(`dad-purchase:${purchase}`),expiresAt:null};
}
export function createDadMessageHandler({identity=dadIdentity,library=blobDadLibrary,names=santaNameLibrary,allowances=studioAllowanceStore,sharedAllowances=sharedAllowanceStore,render=renderDadMessage,limit=consumeNameAccess,supportStatus=dadSupportStatus,recordFailure=recordDadFailure}={}){
 let active=0;
 return async(req,res)=>{
 privateResponse(res);let directory,reservation,who,credits;const controller=new AbortController();
 let stage = 'access', handlingRecording = false;
 const timer=setTimeout(()=>controller.abort(),110000);const abort=()=>controller.abort();
 const json=(status,body)=>{if(!res.headersSent&&!res.destroyed){res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body));}};
 if(!['GET','POST'].includes(req.method)){clearTimeout(timer);return json(405,{error:'Use Dad Studio.'});}
 if(req.headers['sec-fetch-site']==='cross-site'||req.method==='POST'&&!sameStudioOrigin(req)){clearTimeout(timer);return json(403,{error:'Open Dad Studio on this website.'});}
 req.once?.('aborted',abort);res.once?.('close',abort);
 try{
 who=await identity(req);credits=who?.maker==='dads'?sharedAllowances:allowances;await limit(req,req.method==='GET'?'studioRead':'studioMessage');
 if (req.method === 'POST') {
  if (active >= 2) throw fail(429, 'Santa’s studio is busy. Keep this page open and retry in a few minutes.');
  active++;
  handlingRecording = true;
 }
 stage = 'catalogue';
 const inventory=await library.load();if(!inventory)throw Error('Dad library unavailable');
 if (req.method === 'GET') {
  stage = 'credit-status';
  const allowance = who ? await credits.status(who) : { remaining: 1, limit: 1, admin: true };
  const categories = Object.fromEntries(Object.entries(inventory.catalogue.categories)
   .map(([key, rows]) => [key, rows.map(({ file, ...record }) => record)]));
  const support = who ? await supportStatus(who).catch(() => null) : null;
  return json(200, { authorized: true, ...allowance, categories, support });
 }
 const data=await readNameJson(req),keys=['name','age','habit','viewing','treat'];
 if(Object.keys(data).length!==5||keys.some(k=>typeof data[k]!=='string'))throw fail(400,'Please complete all Dad choices.');
 const selected={};for(const key of keys.slice(1)){selected[key]=inventory.catalogue.categories[key].find(r=>r.id===data[key]);if(!selected[key])throw fail(400,'Please select a recorded choice.');}
 stage = 'name-lookup';
 const record=await names.resolve(data.name);if(!record||record.id!==data.name)throw fail(400,'Please select a recorded name.');
 const operation=req.headers['idempotency-key'];if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(operation||''))throw fail(400,'Please create this message in Dad Studio.');
 stage = 'reserve-credit';
 if(who)reservation=await credits.reserve(who,operation);
 controller.signal.throwIfAborted();directory=await mkdtemp(join(tmpdir(),'santa-dad-'));
 stage = 'name-audio';
 let name=fileURLToPath(new URL(`./santa-audio/names/${record.id}.wav`,import.meta.url));
 if(record.source==='hosted'){name=join(directory,'name.wav');await names.download(record,name,undefined,{signal:controller.signal});}
 stage = 'dad-audio';
 const choices={},fixed=[];
 for(const [key,row]of Object.entries(selected)){choices[key]=join(directory,`${key}.flac`);await library.download(row.file,choices[key],inventory.release,controller.signal);}
 if(inventory.catalogue.fixed.length!==7)throw Error('Incomplete script');
 for (const [index, file] of inventory.catalogue.fixed.entries()) {
   controller.signal.throwIfAborted();
   const hash = inventory.records?.get(file)?.sha256;
   const bundled = /^[a-f0-9]{64}$/.test(hash || '')
     ? fileURLToPath(new URL(`./dad-fixed-audio/${hash}.flac`, import.meta.url))
     : null;
   if (bundled && existsSync(bundled)) {
     fixed.push(bundled);
     continue;
   }
   const path = join(directory, `fixed-${index}.flac`);
   await library.download(file, path, inventory.release, controller.signal);
   fixed.push(path);
 }
 stage = 'render';
 const {audio,clipStarts,clipEnds}=await render({name,choices,fixed,directory,signal:controller.signal});controller.signal.throwIfAborted();
 stage = 'commit-credit';
 if(who)await credits.succeed(who,reservation);
 stage = 'deliver';
 res.setHeader('X-Studio-Selection',Buffer.from(JSON.stringify({record:{id:record.id,name:record.name},clipStarts,clipEnds})).toString('base64'));
 res.writeHead(200,{'Content-Type':'audio/mpeg','Content-Length':audio.length});res.end(audio);
 } catch (error) {
  const status = error.status || 503;
  if (status < 500 && status !== 429) return json(status, { error: error.message });
  const reference = randomUUID();
  const code = typeof error.code === 'string' && /^[A-Z0-9_]{1,32}$/.test(error.code) ? error.code : undefined;
  const failure = { stage, code, status, aborted: controller.signal.aborted, at: new Date().toISOString() };
  const support = who && req.method === 'POST'
    ? await recordFailure(who, reference, failure).catch(() => null) : null;
  console.error('[dad-studio] request failed', { ...failure, reference: support?.reference || reference, method: req.method });
  if (status === 429 && !res.headersSent) res.setHeader('Retry-After', '60');
  json(status, {
   error: status === 429 ? 'Santa’s studio is busy. Keep this page open and retry in a few minutes.'
    : 'Your message could not be prepared. Please try again.',
   reference: support?.reference || reference,
   failedAttempts: support?.failedAttempts,
  });
 }
 finally{clearTimeout(timer);req.removeListener?.('aborted',abort);res.removeListener?.('close',abort);controller.abort();if(directory)await rm(directory,{recursive:true,force:true}).catch(()=>{});if(reservation)await credits.release(who,reservation).catch(()=>{});if(handlingRecording)active--;}
 };
}
export default createDadMessageHandler();
