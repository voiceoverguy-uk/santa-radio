import test from 'node:test';
import assert from 'node:assert/strict';
import {tidyCompletedRequest} from '../server/name-request-history.js';
import {listNameRequests} from '../server/name-request-store.js';
import {readFile} from 'node:fs/promises';
test('history delete and undo affect only one completed entry, never recording or email state', {skip:!process.env.PGLITE_TEST_MODULE}, async()=>{
 const {PGlite}=await import(process.env.PGLITE_TEST_MODULE);const db=new PGlite();const pool={query:async(...args)=>{const r=await db.query(...args);return {...r,rowCount:r.affectedRows};}};
 try{
 await db.exec(await readFile('database/santa-name-requests.sql','utf8'));
 await db.exec("INSERT INTO santa_name_requests(request_key,name,first_requested_at,last_requested_at,recorded_at) VALUES('eray','Eray',now(),now(),now()); INSERT INTO santa_name_request_history(request_key,name,request_count,first_requested_at,last_requested_at,recorded_at) VALUES('eray','Eray',1,now(),now(),now()),('eray','Eray',1,now(),now(),now());");
 await tidyCompletedRequest('1',false,pool);assert.equal((await db.query('SELECT count(*)::int AS n FROM santa_name_request_history WHERE deleted_at IS NULL')).rows[0].n,1);
 await tidyCompletedRequest('1',false,pool);await tidyCompletedRequest('1',true,pool);assert.equal((await db.query('SELECT count(*)::int AS n FROM santa_name_request_history WHERE deleted_at IS NULL')).rows[0].n,2);
 assert.ok((await db.query('SELECT recorded_at FROM santa_name_requests')).rows[0].recorded_at);
 await assert.rejects(tidyCompletedRequest('999',false,pool),{status:404});await assert.rejects(tidyCompletedRequest('eray',false,pool),{status:400});
 }finally{await db.close();}
});
