import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createMessageTest} from '../server/message-test.js';
const handler=createMessageTest({secret:()=> 'test-secret-only-'.repeat(3),consume:async()=>true});
async function request(method='GET',body='',cookie='',origin='https://example.com'){
 const req=Readable.from([body]);Object.assign(req,{method,headers:{host:'example.com',origin,cookie}});
 const res={headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v},end(v=''){this.body=v}};
 await handler(req,res);return res;
}
test('gate protects content; password issues signed session; tampering and cross-site fail',async()=>{
 const gate=await request();assert.match(gate.body,/type="password"/);assert.doesNotMatch(gate.body,/Kids’ Message|headelf/);assert.equal(gate.headers['Cache-Control'],'private, no-store, max-age=0');
 assert.equal((await request('POST','password=wrong')).statusCode,401);
 assert.equal((await request('POST','password=headelf','','https://evil.example')).statusCode,403);
 const login=await request('POST','password=headelf');assert.equal(login.statusCode,303);assert.match(login.headers['Set-Cookie'],/HttpOnly/);
 const cookie=login.headers['Set-Cookie'].split(';')[0];const page=await request('GET','',cookie);assert.match(page.body,/Kids’ Message/);assert.match(page.body,/Dad’s Message/);assert.match(page.body,/Purchases opening soon/);assert.match(page.body,/data-demo-player="Kids"/);assert.match(page.body,/data-demo-player="Dad"/);assert.match(page.body,/dad-adam-demo-v1.mp3/);assert.match(page.body,/santa-premium-charlotte-demo-v1.mp3/);assert.doesNotMatch(page.body,/dad-studio-jack.mp3/);
 assert.match((await request('GET','',cookie+'0')).body,/type="password"/);
 assert.match((await request('GET','',cookie+'; '+cookie)).body,/type="password"/);
});
