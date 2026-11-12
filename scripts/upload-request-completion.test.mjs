import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {completeUploadedName} from '../server/upload-request-completion.js';
test('live upload completes matching pending spellings and queues once without touching dismissed names',async()=>{
 const {PGlite}=await import(process.env.PGLITE_TEST_MODULE);const db=new PGlite();
 const pool={query:async(sql,args)=>{const r=args?await db.query(sql,args):await db.exec(sql);return Array.isArray(r)?r:{...r,rowCount:r.affectedRows??r.rows.length}},connect:async()=>({query:pool.query,release(){}})};
 try {
 await db.exec(await readFile(new URL('../database/santa-name-requests.sql',import.meta.url),'utf8'));
 for(const key of ['élodie may','élodie-may','elodie-may','dismissed']) {
 await db.query('INSERT INTO santa_name_requests(request_key,name,first_requested_at,last_requested_at) VALUES($1,$1,now(),now())',[key]);
 await db.query("INSERT INTO santa_name_request_notifications(request_key,recipient_key,source) VALUES($1,'test','free')",[key]);
 }
 await db.query("UPDATE santa_name_requests SET dismissed_at=now() WHERE request_key='dismissed'");
 assert.equal((await completeUploadedName('Élodie-May',{pool})).requests,2);
 assert.equal((await completeUploadedName('Élodie May',{pool})).requests,0);
 assert.equal((await completeUploadedName('Dismissed',{pool})).requests,0);
 assert.equal((await completeUploadedName('Unknown',{pool})).requests,0);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM santa_name_request_history')).rows[0].n,2);
 assert.deepEqual((await db.query('SELECT request_key,state FROM santa_name_request_notifications ORDER BY request_key')).rows,[{request_key:'dismissed',state:'waiting'},{request_key:'elodie-may',state:'waiting'},{request_key:'élodie may',state:'pending'},{request_key:'élodie-may',state:'pending'}]);
 } finally {await db.close()}
});
