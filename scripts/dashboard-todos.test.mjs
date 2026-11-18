import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dashboardTodos } from '../server/dashboard-todos.js';
import { createStatisticsHandler } from '../server/message-statistics.js';
test('tasks persist, repeated adds deduplicate, completion can be undone',{skip:!process.env.PGLITE_TEST_MODULE},async()=>{
 const { PGlite }=await import(process.env.PGLITE_TEST_MODULE); const db=new PGlite();
 const pool={query:async(sql,args)=>{const r=await db.query(sql,args);return {...r,rowCount:r.affectedRows??r.rows.length}}};
 try {
 await db.exec(await readFile(new URL('../database/santa-name-requests.sql',import.meta.url),'utf8'));
 const id='11111111-1111-4111-8111-111111111111';
 await dashboardTodos({action:'add',id,title:' Add an idea '},pool);
 assert.equal((await dashboardTodos({action:'add',id,title:'Add an idea'},pool)).tasks.length,1);
 assert.ok((await dashboardTodos({action:'complete',id,completed:'true'},pool)).tasks[0].completedAt);
 assert.equal((await dashboardTodos({action:'complete',id,completed:'false'},pool)).tasks[0].completedAt,null);
 await dashboardTodos({action:'complete',id,completed:'true'},pool);
 const edited=await dashboardTodos({action:'edit',id,title:'Updated idea'},pool);assert.equal(edited.tasks[0].title,'Updated idea');assert.ok(edited.tasks[0].completedAt);
 await assert.rejects(dashboardTodos({action:'edit',id,title:' '},pool),{status:400});
 assert.equal((await dashboardTodos({action:'delete',id},pool)).tasks.length,0);
 assert.equal((await dashboardTodos({action:'delete',id},pool)).tasks.length,0);
 await assert.rejects(dashboardTodos({action:'add',id,title:' '},pool),{status:400});
 await assert.rejects(dashboardTodos({action:'complete',id,completed:'maybe'},pool),{status:400});
 }finally{await db.close()}
});
test('task reads and writes require owner access and writes require same origin',async()=>{
 for(const [method,allowed,origin,code] of [['GET',false,undefined,401],['PATCH',false,'https://www.santaradio.co.uk',401],['PATCH',true,'https://other.example',403]]){
 let called=false;const res={set(){return this},status(n){this.code=n;return this},json(body){this.body=body;return this}};
 await createStatisticsHandler({allowed:()=>allowed,todos:()=>{called=true}})({method,query:{view:'todos'},headers:{host:'www.santaradio.co.uk',origin},body:{}},res);
 assert.equal(res.code,code);assert.equal(called,false);
 }
});
