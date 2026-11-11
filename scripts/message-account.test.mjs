import test from 'node:test';
import assert from 'node:assert/strict';
import {expiryFor,assetPath,archiveRecording} from '../server/message-account-store.js';
import account from '../server/message-account.js';
import http from 'node:http';
test('Christmas recordings remain through January 31, excluding February 1',()=>{
 for(const [start,end] of [['2026-11-11T12:00:00Z','2027-02-01T00:00:00.000Z'],['2027-01-31T23:59:59Z','2027-02-01T00:00:00.000Z'],['2027-02-01T00:00:00Z','2028-02-01T00:00:00.000Z'],['2028-12-25T00:00:00Z','2029-02-01T00:00:00.000Z']])assert.equal(expiryFor(new Date(start)).toISOString(),end);
});
test('feature-off generation never contacts storage',async()=>{
 const old=process.env.STUDIO_ACCOUNTS_ENABLED;delete process.env.STUDIO_ACCOUNTS_ENABLED;
 try{assert.equal(await archiveRecording({},Buffer.from('audio'),'operation','Name'),null)}finally{if(old)process.env.STUDIO_ACCOUNTS_ENABLED=old}
});
test('account assets are separate private paths',()=>{
 const paths=['audio','certificate','letter','picture'].map(k=>assetPath('message',k));assert.equal(new Set(paths).size,4);assert.ok(paths.every(p=>p.startsWith('santa-messages/message/')));
});
test('anonymous account and unauthenticated cleanup are denied',async()=>{
 const old=process.env.STUDIO_ACCOUNTS_ENABLED;process.env.STUDIO_ACCOUNTS_ENABLED='true';
 const server=http.createServer(account);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try {for(const query of ['', '?action=file&id=00000000-0000-0000-0000-000000000000&kind=audio','?action=cleanup']){const r=await fetch(`http://127.0.0.1:${server.address().port}/${query}`);assert.equal(r.status,401)}}
 finally{await new Promise(r=>server.close(r));if(old)process.env.STUDIO_ACCOUNTS_ENABLED=old;else delete process.env.STUDIO_ACCOUNTS_ENABLED}
});
