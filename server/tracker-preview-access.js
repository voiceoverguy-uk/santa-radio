import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { consumeLiveAttempt } from './studio-live-store.js';
const cookieName = 'santa_tracker_preview';
const passwordHash = () => process.env.TRACKER_PREVIEW_PASSWORD ? createHash('sha256').update(process.env.TRACKER_PREVIEW_PASSWORD).digest('hex') : null;
const localSecret = randomBytes(32).toString('hex');
const secret = () => process.env.STUDIO_RETURN_SECRET || (!process.env.VERCEL ? localSecret : '');
const sign = (value,key) => createHmac('sha256',key).update('tracker-preview:'+value).digest('hex');
export const isPreviewPath = path => /^\/santa-tracker\/preview\/?$/.test(path);
export function previewAuthorized(req,key=secret(),now=Date.now()) {
 if(!key || key.length<32)return false;
 const tokens=String(req.headers.cookie||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(cookieName+'='));
 if(tokens.length!==1)return false;
 const [expiry,signature,...extra]=tokens[0].slice(cookieName.length+1).split('.');
 if(extra.length || !/^\d{13}$/.test(expiry||'') || !/^[a-f0-9]{64}$/.test(signature||'') || +expiry<=now || +expiry>now+28800000)return false;
 return timingSafeEqual(Buffer.from(signature),Buffer.from(sign(expiry,key)));
}
export function previewHeaders(res){
 for(const name of ['Cache-Control','CDN-Cache-Control','Vercel-CDN-Cache-Control'])res.setHeader(name,'private, no-store');
 res.setHeader('X-Robots-Tag','noindex, nofollow');
 res.setHeader('X-Content-Type-Options','nosniff');
}
export function previewGate(res,{error='',postcards=false,status=200,head=false}={}){
 previewHeaders(res);res.statusCode=status;res.setHeader('Content-Type','text/html; charset=utf-8');
 res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
 res.end(head?'':`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Santa Tracker Preview</title><style>body{margin:0;background:#08251b;color:#fff7df;font:18px system-ui;display:grid;place-items:center;min-height:100dvh}main{width:min(400px,85vw);padding:30px;border:1px solid #d8bd64;border-radius:16px}h1{color:#f0d785;font:30px Georgia}input,button{box-sizing:border-box;width:100%;padding:12px;margin:12px 0;font:inherit;border-radius:6px;border:1px solid #d8bd64}button{background:#a20e19;color:white;cursor:pointer}a{color:#f0d785}</style></head><body><main><h1>Santa Tracker Preview</h1><p>Enter the password to explore Santa’s journey and postcards.</p>${error?`<p role="alert">${error}</p>`:''}<form method="post" action="/api/tracker-preview-access"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required autofocus><input type="hidden" name="postcards" value="${postcards?'1':'0'}"><button>Unlock preview</button></form><a href="/santa-tracker">Back to the live tracker</a></main></body></html>`);
}
const localAttempts=new Map();
async function consume(req,key){
 if(process.env.VERCEL)return consumeLiveAttempt(req,{secret:key},'tracker-preview-login');
 const id=req.socket?.remoteAddress||'local',now=Date.now(),entry=localAttempts.get(id);
 if(!entry||entry.expires<now){localAttempts.set(id,{count:1,expires:now+900000});return true;}
 return ++entry.count<=10;
}
export default async function handler(req,res){
 previewHeaders(res);
 if(req.method==='GET'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({authorized:previewAuthorized(req)}));}
 if(req.method!=='POST'){res.statusCode=405;res.setHeader('Allow','GET, POST');return res.end();}
 let postcards=false;
 try{
  const key=secret();if(!key||key.length<32||!passwordHash())return previewGate(res,{error:'Preview temporarily unavailable.',status:503});
  const origin=new URL(req.headers.origin||'');
  if(origin.host!==req.headers.host||req.headers['sec-fetch-site']==='cross-site')return previewGate(res,{error:'Please open the preview page and try again.',status:403});
  if(!await consume(req,key))return previewGate(res,{error:'Too many attempts. Please try again in 15 minutes.',status:429});
  let body=typeof req.body==='string'?req.body:req.body&&typeof req.body==='object'?new URLSearchParams(req.body).toString():'';
  if(req.body===undefined)for await(const part of req){body+=part;if(Buffer.byteLength(body)>2048){res.statusCode=413;return res.end();}}
  if(Buffer.byteLength(body)>2048){res.statusCode=413;return res.end();}
  const form=new URLSearchParams(body);postcards=form.get('postcards')==='1';
  if(createHash('sha256').update(form.get('password')||'').digest('hex')!==passwordHash())return previewGate(res,{error:'That password wasn’t right. Try again.',postcards,status:401});
  const expiry=String(Date.now()+28800000);
  res.setHeader('Set-Cookie',`${cookieName}=${expiry}.${sign(expiry,key)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800${process.env.VERCEL?'; Secure':''}`);
  res.statusCode=303;res.setHeader('Location','/santa-tracker/preview'+(postcards?'?postcards=1':''));res.end();
 }catch{return previewGate(res,{error:'Preview temporarily unavailable. Please try again shortly.',postcards,status:503});}
}
