import test from 'node:test';
import assert from 'node:assert/strict';
import { sealContact, openContact, requestContact, CONTACT_COOKIE } from '../server/name-request-contact.js';
import { issueFreeAccess, freeSession, FREE_ACCESS_COOKIE } from '../server/santa-message-access.js';
import { nameAvailableEmail, nameRejectedEmail, sendNameNotifications } from '../server/name-request-email.js';
process.env.SESSION_SECRET='test-only-notification-secret-'.repeat(3);
test('contact details are encrypted, authenticated and tied to the existing free session',async()=>{
 const grant=issueFreeAccess('parent@example.test');
 const session=freeSession({headers:{cookie:`${FREE_ACCESS_COOKIE}=${grant}`}});
 const sealed=sealContact({email:'parent@example.test',subject:session.subject,exp:session.exp});
 assert.ok(!sealed.includes('parent'));assert.equal(openContact(sealed).email,'parent@example.test');
 assert.equal(openContact('x'+sealed),null);
 const req={headers:{cookie:`${FREE_ACCESS_COOKIE}=${grant}; ${CONTACT_COOKIE}=${sealed}`}};
 assert.equal((await requestContact(req)).email,'parent@example.test');
 req.headers.cookie=`${FREE_ACCESS_COOKIE}=${issueFreeAccess('other@example.test')}; ${CONTACT_COOKIE}=${sealed}`;
 await assert.rejects(()=>requestContact(req),{code:'NAME_CONTACT_REQUIRED'});
});
test('email escapes names and links to the correct maker',()=>{
 const email=nameAvailableEmail('<name>','paid');assert.ok(email.html.includes('&lt;name&gt;'));
 assert.ok(email.text.includes('/bespoke-personalised-message-from-santa'));
 assert.ok(nameAvailableEmail('Erin','free').text.includes('/free-santa-message'));
});
test('delivery removes addresses only after acceptance and holds ambiguous failures',async()=>{
 process.env.BREVO_API_KEY='test-only';
 for(const [status,expected] of [[201,'sent'],[403,'pending'],[429,'pending'],[400,'review'],[503,'review']]){
  const updates=[];const pool={query:async(sql,args)=>{
   if(sql.startsWith('WITH selected'))return{rows:[{request_key:'erin',recipient_key:'x',name:'Erin',source:'free',contact:sealContact({email:'parent@example.test'})}],rowCount:1};
   updates.push({sql,args});return{rows:[],rowCount:1};
  }};
  await sendNameNotifications({pool,fetcher:async(_url,options)=>{
   const body=JSON.parse(options.body);assert.equal(body.to[0].email,'parent@example.test');assert.ok(body.htmlContent);return{ok:status===201,status};
  }});
  assert.equal(updates.at(-1).args[2],expected);
 }
});

test('rejection explains the rule, escapes the name and preserves allowance wording',()=>{
 const email=nameRejectedEmail('<Oliver Smith>','paid');
 assert.ok(email.html.includes('&lt;Oliver Smith&gt;'));
 assert.ok(email.text.includes('Amelia Rose or Lily-Mae'));
 assert.ok(email.text.includes('remaining credits are unchanged'));
 assert.ok(email.text.includes('/bespoke-personalised-message-from-santa'));
});
test('queued rejection sends the rejection template rather than availability news',async()=>{
 process.env.BREVO_API_KEY='test-only';
 const updates=[];
 const pool={query:async(sql,args)=>{
  if(sql.startsWith('WITH selected'))return {rows:[{request_key:'oliver smith',recipient_key:'x',name:'Oliver Smith',source:'free',notification_kind:'rejected',contact:sealContact({email:'parent@example.test'})}],rowCount:1};
  updates.push({sql,args});return {rows:[],rowCount:1};
 }};
 await sendNameNotifications({pool,fetcher:async(_url,options)=>{
  const body=JSON.parse(options.body);
  assert.equal(body.subject,'An update about your Santa name request');
  assert.ok(body.textContent.includes('surname'));
  assert.ok(!body.textContent.includes('now available'));
  return {ok:true,status:201};
 }});
 assert.equal(updates.at(-1).args[2],'sent');
});
