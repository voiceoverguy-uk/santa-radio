import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import sharp from 'sharp';
import { promotionFields,preparePromotionImage,publicPromotion,addPromotion,editPromotion,publishPromotion,promotionLibrary,promotionImage } from '../server/app-promotions.js';
import { createAppPromotionsHandler } from '../api/app-promotions.js';
test('promotion links allow only owned website and App Store HTTPS destinations',()=>{
 const good={title:'Christmas',label:'Christmas offer',linkURL:'https://www.santaradio.co.uk/'};
 assert.equal(promotionFields(good).title,'Christmas');
 for(const linkURL of ['javascript:alert(1)','http://www.santaradio.co.uk/','https://evil.test','https://www.santaradio.co.uk.evil.test','https://a:b@www.santaradio.co.uk/','https://www.santaradio.co.uk:444/'])assert.throws(()=>promotionFields({...good,linkURL}));
 assert.throws(()=>promotionFields({...good,label:''}));
});
test('images are decoded, bounded, stripped of metadata and normalised',async()=>{
 const png=await sharp({create:{width:1920,height:800,channels:3,background:'#123321'}}).png().toBuffer();
 const image=await preparePromotionImage(png);assert.equal(image.width,1920);assert.equal(image.height,800);assert(image.data.length<=1048576);
 assert.equal((await sharp(image.data).metadata()).format,'jpeg');
 await assert.rejects(()=>preparePromotionImage(Buffer.from('<svg>bad</svg>')));
 const portrait=await sharp({create:{width:800,height:1920,channels:3,background:'red'}}).png().toBuffer();
 await assert.rejects(()=>preparePromotionImage(portrait),/1920/);
 await assert.rejects(()=>preparePromotionImage(Buffer.alloc(4*1024*1024+1)),/4 MB/);
});
test('anonymous clients cannot read drafts or write, and errors stay uncached',async()=>{
 const calls=[];
 const handler=createAppPromotionsHandler({authorize:req=>req.headers.authorization==='Bearer test',library:async()=>({items:[],live:{revision:0}}),publicConfig:async app=>({version:1,mode:'default',app}),image:async(id,owner)=>{calls.push(owner);if(!owner)throw Object.assign(Error('Image not found'),{status:404});return Buffer.from('jpeg');},publish:async b=>calls.push(b.action)});
 const server=createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 try{
  assert.equal((await fetch(base+'?view=manage')).status,401);
  assert.equal((await fetch(base,{method:'PATCH',headers:{'Content-Type':'application/json'},body:'{"action":"off"}'})).status,401);
  assert.equal((await fetch(base,{method:'PATCH',headers:{Authorization:'Bearer test',Origin:'https://evil.test','Content-Type':'application/json'},body:'{}'})).status,403);
  const draft=await fetch(base+'?image=x');assert.equal(draft.status,404);assert.match(draft.headers.get('cache-control'),/no-store/);
  assert.equal((await fetch(base+'?view=manage',{headers:{Authorization:'Bearer test'}})).status,200);
  const pub=await fetch(base+'?app=santaRadio');assert.equal((await pub.json()).mode,'default');assert.match(pub.headers.get('cache-control'),/s-maxage=30/);
  assert.equal((await fetch(base,{method:'PATCH',headers:{Authorization:'Bearer test','Content-Type':'application/json'},body:'{"action":"off"}'})).status,200);
  assert(calls.includes('off'));
 }finally{await new Promise(r=>server.close(r));}
});
// Optional real PostgreSQL-compatible engine for isolated release verification.
if(process.env.PROMOTION_PGLITE_MODULE) test('library, publication snapshots, draft privacy, switching and stale-write protection',async()=>{
 const {PGlite}=await import(process.env.PROMOTION_PGLITE_MODULE);const db=new PGlite();
 const pool={query:async(sql,args)=>{const r=await db.query(sql,args);return {...r,rowCount:r.affectedRows??r.rows.length};},connect:async()=>({...pool,release(){}})};
 try{
  const schema=await readFile(new URL('../database/app-promotions.sql',import.meta.url),'utf8');await db.exec(schema);await db.exec(schema);
  assert.equal((await publicPromotion('santaRadio',pool)).mode,'default');
  const image=await sharp({create:{width:960,height:400,channels:3,background:'green'}}).png().toBuffer();
  const fields={title:'First',label:'First offer',linkURL:'https://www.santaradio.co.uk/'};
  const a=await addPromotion(image,fields,pool);const b=await addPromotion(image,{...fields,title:'Second'},pool);
  assert.equal((await promotionLibrary(pool)).items.length,2);
  await assert.rejects(()=>promotionImage(a.id,false,pool),/not found/);
  assert((await promotionImage(a.id,true,pool)).length>0);
  await publishPromotion({action:'publish',id:a.id,revision:1,liveRevision:0,santaRadio:true,christmasRadio:true},pool);
  assert.equal((await publicPromotion('santaRadio',pool)).label,'First offer');
  assert.equal((await publicPromotion('christmasRadio',pool)).mode,'promotion');
  await editPromotion({...fields,id:a.id,revision:1,label:'Changed draft'},pool);
  assert.equal((await publicPromotion('santaRadio',pool)).label,'First offer');
  await assert.rejects(()=>publishPromotion({action:'publish',id:a.id,revision:1,liveRevision:1,santaRadio:true,christmasRadio:true},pool),/changed/);
  await assert.rejects(()=>publishPromotion({action:'off',liveRevision:0},pool),/changed/);
  await publishPromotion({action:'publish',id:b.id,revision:1,liveRevision:1,santaRadio:true,christmasRadio:false},pool);
  assert.equal((await publicPromotion('christmasRadio',pool)).mode,'off');
  await publishPromotion({action:'publish',id:a.id,revision:2,liveRevision:2,santaRadio:true,christmasRadio:true},pool);
  assert.equal((await publicPromotion('santaRadio',pool)).label,'Changed draft');
  await publishPromotion({action:'off',liveRevision:3},pool);assert.equal((await publicPromotion('santaRadio',pool)).mode,'off');
  await publishPromotion({action:'default',liveRevision:4},pool);assert.equal((await publicPromotion('santaRadio',pool)).mode,'default');
  assert.equal((await promotionLibrary(pool)).items.length,2);
 }finally{await db.close();}
});
