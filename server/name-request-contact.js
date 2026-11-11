import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import { freeSession } from './santa-message-access.js';
import { livePaidPurchaseId, singleCookie } from './studio-live-access.js';
import { liveStudioConfig } from './studio-live-config.js';
import { liveStripeClient } from './studio-live-stripe.js';
export const CONTACT_COOKIE = '__Host-santa-request-contact';
const secret = () => {
  if ((process.env.SESSION_SECRET || '').length < 32) throw new Error('CONTACT_SECRET_REQUIRED');
  return createHash('sha256').update(`name-notification:${process.env.SESSION_SECRET}`).digest();
};
export function sealContact(data) {
  const iv=randomBytes(12), cipher=createCipheriv('aes-256-gcm',secret(),iv);
  const content=Buffer.concat([cipher.update(JSON.stringify(data),'utf8'),cipher.final()]);
  return Buffer.concat([iv,cipher.getAuthTag(),content]).toString('base64url');
}
export function openContact(value) {
  try {
    if(typeof value!=='string'||value.length>2000)return null;
    const bytes=Buffer.from(value,'base64url'),cipher=createDecipheriv('aes-256-gcm',secret(),bytes.subarray(0,12));
    cipher.setAuthTag(bytes.subarray(12,28));
    return JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)),cipher.final()]).toString());
  }catch{return null;}
}
export function contactIdentity(email) {
  return createHmac('sha256',secret()).update(email.trim().normalize('NFKC').toLowerCase()).digest('hex');
}
export async function requestContact(req) {
  const source=req.body?.source==='paid'?'paid':'free';
  if(source==='paid') {
    const id=await livePaidPurchaseId(req);
    if(id) {
      const config=liveStudioConfig(),stripe=await liveStripeClient(config);
      const session=await stripe.checkout.sessions.retrieve(id);
      const email=session.customer_details?.email;
      if(session.livemode&&session.payment_status==='paid'&&typeof email==='string'&&email.length<=254)
        return {email,source,identity:contactIdentity(email)};
    }
    return null;
  }
  if(!String(req.headers.cookie||'').includes('santa-free-message='))return null;
  const session=freeSession(req),contact=openContact(singleCookie(req,CONTACT_COOKIE));
  if(session&&contact?.subject===session.subject&&contact.exp>Date.now()&&typeof contact.email==='string')
    return {email:contact.email,source,identity:contactIdentity(contact.email)};
  if(session)throw Object.assign(new Error('Please re-enter your adult details once so we can email you when the requested name is available.'),{status:401,code:'NAME_CONTACT_REQUIRED'});
  return null;
}
