import express from 'express';
import { clerkMiddleware, getAuth } from '@clerk/express';
import { createClerkClient } from '@clerk/backend';
import { clerkPublishableKey } from '../src/lib/clerkPublishableKey.js';
import { getClerkProxyHost } from './middlewares/clerkProxyMiddleware.js';
import { get, del, issueSignedToken } from '@vercel/blob';
import { handleUploadPresigned } from '@vercel/blob/client';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { timingSafeEqual } from 'node:crypto';
import { databasePool } from './contenders-database.js';
import { databasePool as payments } from './name-request-store.js';
import { liveStudioConfig } from './studio-live-config.js';
import { emailDigest, transaction } from './studio-live-store.js';
import { livePaidPurchaseId, livePaidSummary, issueLiveAccess } from './studio-live-access.js';
import { accountEnabled, kinds, assetPath, committed, acceptAsset } from './message-account-store.js';
import { privateResponse } from './santa-name-security.js';
import { deleteSavedMessage } from './message-account-delete.js';
const app = express();
app.disable('x-powered-by');
app.use(express.json({limit:'32kb'}));
app.use((req,res,next)=> { privateResponse(res); next(); });
const validId = value => /^[0-9a-f-]{36}$/.test(value || '');
async function giftRow(req, id) {
 if (!validId(id)) throw new Error('Invalid message');
 const purchase = await livePaidPurchaseId(req);
 const {rows:[row]} = await databasePool().query('SELECT * FROM santa_saved_messages WHERE id=$1 AND purchase_id=$2 AND expires_at>now()',[id,purchase || '']);
 if (!row || !await committed(row)) throw new Error('Message unavailable');
 return row;
}
app.use(async(req,res,next)=> {
 try {
  if (!accountEnabled()) return res.status(503).json({error:'Accounts are not open yet.'});
  if (req.query.action==='cleanup') {
   const expected=`Bearer ${process.env.CRON_SECRET || ''}`, supplied=String(req.headers.authorization || '');
   if (!process.env.CRON_SECRET || supplied.length!==expected.length || !timingSafeEqual(Buffer.from(supplied),Buffer.from(expected))) return res.status(401).end();
   const {rows}=await databasePool().query("SELECT id FROM santa_saved_messages WHERE expires_at<=now()-interval '15 minutes' LIMIT 50");
   for (const row of rows) { for(const kind of Object.keys(kinds)) await del(assetPath(row.id,kind)); await databasePool().query('DELETE FROM santa_saved_messages WHERE id=$1',[row.id]); }
   return res.json({removed:rows.length});
  }
  if (req.method==='POST') {
   const callback=req.query.action==='upload' && req.body?.type==='blob.upload-completed';
   if (!callback && (req.headers.origin!==liveStudioConfig().origin || req.headers['sec-fetch-site']==='cross-site')) return res.status(403).end();
  }
  if (req.query.action==='upload' && req.method==='POST') {
   return res.json(await handleUploadPresigned({request:req,body:req.body,
    getSignedToken:async(path,payload)=> {
     const {id,kind}=JSON.parse(payload || '{}');
     if (!['certificate','letter','picture'].includes(kind)) throw new Error('Invalid gift');
     const row=await giftRow(req,id);
     if (path!==assetPath(row.id,kind)) throw new Error('Invalid path');
     const constraints={pathname:path,operations:['put'],allowedContentTypes:[kinds[kind]],maximumSizeInBytes:16*1024*1024,validUntil:Math.min(Date.now()+600000,new Date(row.expires_at).getTime())};
     return {token:await issueSignedToken(constraints),urlOptions:{addRandomSuffix:false,allowOverwrite:false,ttlDays:Math.max(1,Math.ceil((new Date(row.expires_at)-Date.now())/86400000)),tokenPayload:JSON.stringify({id,kind})}};
    },
    onUploadCompleted:async({blob,tokenPayload})=> {
     const {id,kind}=JSON.parse(tokenPayload || '{}');
     if (!validId(id) || !kinds[kind] || blob.pathname!==assetPath(id,kind)) throw new Error('Invalid gift');
     const {rows:[row]}=await databasePool().query('SELECT * FROM santa_saved_messages WHERE id=$1 AND expires_at>now()',[id]);
     if (row && await committed(row)) await acceptAsset(row,kind);
    }
   }));
  }
  if(req.query.action==='gift' && req.method==='POST') {
   const {id,kind}=req.body;
   if(!['certificate','letter','picture'].includes(kind)) return res.status(400).end();
   const row=await giftRow(req,id);
   try {await acceptAsset(row,kind); return res.json({saved:true});} catch {return res.json({saved:false});}
  }
  next();
 } catch {res.status(503).json({error:'Your collection could not be updated. Please retry.'});}
});
app.use((req,res,next)=> {
 if (!req.headers.authorization && !/(?:^|;\s*)__session(?:_[^=;]+)?=/.test(req.headers.cookie || '')) return res.status(401).json({error:'Please sign in.'});
 next();
});
app.use(clerkMiddleware(req=>({publishableKey:clerkPublishableKey(getClerkProxyHost(req) || '',process.env.CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)})));
app.use(async(req,res)=> {
 try {
  const {userId}=getAuth(req);
  if(!userId) return res.status(401).json({error:'Please sign in.'});
  const user=await createClerkClient({secretKey:process.env.CLERK_SECRET_KEY}).users.getUser(userId);
  const email=user.emailAddresses.find(item=>item.id===user.primaryEmailAddressId);
  if(email?.verification?.status!=='verified') return res.status(403).json({error:'Please verify your email address.'});
  const db=databasePool();
  if(req.method==='POST' && req.query.action==='delete') {
   if(req.body?.confirmed!==true)return res.status(400).json({error:'Confirm deletion first.'});
   if(!await deleteSavedMessage(db,userId,req.body.id))return res.status(404).json({error:'Message not found.'});
   return res.json({deleted:true});
  }
  if(req.method==='POST' && req.query.action==='link') {
   const {rows}=await payments().query('SELECT checkout_session_id FROM santa_studio_live_purchases WHERE email_sha256=$1',[emailDigest(email.emailAddress,liveStudioConfig())]);
   for(const row of rows) await db.query('INSERT INTO santa_message_accounts(purchase_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[row.checkout_session_id,userId]);
   return res.json({linked:true});
  }
  if(req.method==='POST' && req.query.action==='resume') {
   const {rows:[row]}=await db.query('SELECT purchase_id FROM santa_message_accounts WHERE purchase_id=$1 AND user_id=$2',[req.body.purchaseId,userId]);
   if(!row) return res.status(404).end();
   const summary=await livePaidSummary(payments(),row.purchase_id);
   if(!summary.remaining) return res.status(409).json({error:'Both messages have already been created.'});
   const grant=await transaction(payments(),client=>issueLiveAccess(res,row.purchase_id,client)); grant(); return res.json({ready:true});
  }
  if(req.method!=='GET') return res.status(405).end();
  if(req.query.action==='file') {
   const {id,kind}=req.query;
   if(!validId(id)||!kinds[kind]) return res.status(404).end();
   const {rows:[row]}=await db.query(`SELECT m.* FROM santa_saved_messages m JOIN santa_message_accounts a ON a.purchase_id=m.purchase_id WHERE m.id=$1 AND a.user_id=$2 AND m.expires_at>now()`,[id,userId]);
   if(!row?.assets[kind] || !await committed(row)) return res.status(404).end();
   const file=await get(assetPath(id,kind),{access:'private'});
   if(file?.statusCode!==200) return res.status(404).end();
   res.set('Content-Type',kinds[kind]);res.set('Content-Disposition',`attachment; filename="Santa-${kind}.${kind==='audio'?'mp3':kind==='picture'?'png':'pdf'}"`);
   await pipeline(Readable.fromWeb(file.stream),res); return;
  }
  const {rows:purchases}=await db.query('SELECT purchase_id FROM santa_message_accounts WHERE user_id=$1',[userId]);
  const credits=await Promise.all(purchases.map(async row=>({purchaseId:row.purchase_id,...await livePaidSummary(payments(),row.purchase_id)})));
  const {rows}=await db.query(`SELECT m.* FROM santa_saved_messages m JOIN santa_message_accounts a ON a.purchase_id=m.purchase_id WHERE a.user_id=$1 AND m.expires_at>now() ORDER BY m.created_at DESC`,[userId]);
  const messages=[];
  for(const row of rows) if(await committed(row)) messages.push({id:row.id,name:row.child_name,expiresAt:row.expires_at,assets:Object.keys(row.assets)});
  res.json({messages,credits});
 } catch {if(!res.headersSent)res.status(503).json({error:'Your collection is temporarily unavailable. Please try again.'});else res.destroy();}
});
export default app;
