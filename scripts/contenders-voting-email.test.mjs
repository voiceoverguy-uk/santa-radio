import test from 'node:test';
import assert from 'node:assert/strict';
import {votingCodeEmail} from '../server/contenders-voting-email.js';
import {sendVotingCode} from '../server/contenders-live.js';
test('branded code email has matching accessible text and HTML with no dynamic markup',()=>{
 const email=votingCodeEmail('001234');assert.match(email.text,/001234/);assert.match(email.html,/>001234</);assert.match(email.html,/alt="Santa Radio"/);assert.match(email.html,/40px/);assert.match(email.text,/15 minutes/);assert.throws(()=>votingCodeEmail('<img>'));
});
test('sender supplies HTML and plain text to the email provider',async()=>{
 let body;
 await sendVotingCode({email:'test@example.com',code:'001234',id:'test-only'},async(_url,options)=>{body=JSON.parse(options.body);return{ok:true,json:async()=>({id:'test'})}}, {CONTENDERS_LIVE_ENABLED:'true',RESEND_API_KEY:'test-only',STUDIO_EMAIL_SENDER_APPROVED:'true',STUDIO_EMAIL_FROM:'santa@santaradio.co.uk'});
 assert.match(body.html,/001234/);assert.match(body.text,/001234/);assert.equal(body.to[0],'test@example.com');
});
