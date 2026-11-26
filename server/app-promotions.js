import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { databasePool } from './name-request-store.js';
export const promotionError = (message,status=400) => Object.assign(new Error(message),{status});
export const validID = value => typeof value==='string' && /^[a-f0-9-]{36}$/.test(value);
export function promotionFields(body) {
 const title=typeof body.title==='string'?body.title.trim():'';
 const label=typeof body.label==='string'?body.label.trim():'';
 let link;try {link=new URL(body.linkURL);}catch{throw promotionError('Enter a valid website link.');}
 if(link.protocol!=='https:' || link.username || link.password || link.port ||
    !['www.santaradio.co.uk','santaradio.co.uk','apps.apple.com','itunes.apple.com'].includes(link.hostname))
   throw promotionError('Use an HTTPS SantaRadio.co.uk or Apple App Store link.');
 if(!title || title.length>100 || !label || label.length>240) throw promotionError('Add a title and a short description (up to 240 characters).');
 return {title,label,linkURL:link.href};
}
export async function preparePromotionImage(buffer) {
 if(!Buffer.isBuffer(buffer)||buffer.length>4*1024*1024||buffer.length<16)throw promotionError('Choose a PNG, JPEG or WebP image up to 4 MB.');
 try {
  const input=sharp(buffer,{limitInputPixels:16000000,failOn:'warning'});
  const meta=await input.metadata();
  if(!['png','jpeg','webp'].includes(meta.format)||(meta.pages||1)!==1)throw Error('format');
  const width=meta.autoOrient?.width || meta.width, height=meta.autoOrient?.height || meta.height;
  if(width<960 || height<400 || Math.abs(width/height-2.4)>0.12)throw promotionError('Use a wide banner around 1920 × 800 pixels (2.4:1). Minimum 960 × 400.');
  const image=await input.rotate().resize({width:1920,height:800,fit:'contain',background:'#06251b',withoutEnlargement:true}).flatten({background:'#06251b'}).jpeg({quality:88}).toBuffer({resolveWithObject:true});
  if(image.data.length>1048576)throw promotionError('The image is too detailed. Please export a smaller JPEG.');
  const thumbnail=await sharp(image.data).resize({width:320}).jpeg({quality:65}).toBuffer();
  return {data:image.data,thumbnail,width:image.info.width,height:image.info.height};
 }catch(e){if(e.status)throw e;throw promotionError('This image could not be read. Please export a PNG, JPEG or WebP and try again.');}
}
const fieldsSQL='id,title,label,link_url AS "linkURL",width,height,revision,created_at AS "createdAt",updated_at AS "updatedAt"';
export async function promotionLibrary(pool=databasePool()) {
 const [library,live]=await Promise.all([
  pool.query(`SELECT ${fieldsSQL},thumbnail FROM santa_app_promotions ORDER BY created_at DESC LIMIT 100`),
  pool.query('SELECT campaign,revision,updated_at AS "updatedAt" FROM santa_app_promotion_live WHERE singleton')]);
 return {items:library.rows.map(({thumbnail,...row})=>({...row,thumbnail:`data:image/jpeg;base64,${Buffer.from(thumbnail).toString('base64')}`})),live:live.rows[0]||{campaign:null,revision:0}};
}
export async function addPromotion(buffer,body,pool=databasePool()) {
 const fields=promotionFields(body),image=await preparePromotionImage(buffer);
 const client=await pool.connect();
 try {
  await client.query('BEGIN');
  await client.query('SELECT singleton FROM santa_app_promotion_live WHERE singleton FOR UPDATE');
  const count=await client.query('SELECT count(*)::int AS count FROM santa_app_promotions');
  if(count.rows[0].count>=100)throw promotionError('The library has reached 100 banners. Contact support to archive older designs.');
  const id=randomUUID();
  await client.query('INSERT INTO santa_app_promotions(id,title,label,link_url,image_data,thumbnail,width,height) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,fields.title,fields.label,fields.linkURL,image.data,image.thumbnail,image.width,image.height]);
  await client.query('COMMIT');return {id};
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
export async function editPromotion(body,pool=databasePool()) {
 if(!validID(body.id)||!Number.isInteger(body.revision))throw promotionError('Select a saved banner.');
 const fields=promotionFields(body);
 const result=await pool.query('UPDATE santa_app_promotions SET title=$1,label=$2,link_url=$3,revision=revision+1,updated_at=now() WHERE id=$4 AND revision=$5 RETURNING id',[fields.title,fields.label,fields.linkURL,body.id,body.revision]);
 if(!result.rowCount)throw promotionError('This banner changed in another window. Reload the library.',409);
}
export async function publishPromotion(body,pool=databasePool()) {
 if(!Number.isInteger(body.liveRevision))throw promotionError('Reload the current live setting.');
 const client=await pool.connect();
 try {
  await client.query('BEGIN');
  const live=await client.query('SELECT revision FROM santa_app_promotion_live WHERE singleton FOR UPDATE');
  if(live.rows[0]?.revision!==body.liveRevision)throw promotionError('The live banner changed in another window. Reload before publishing.',409);
  let campaign={mode:body.action==='default'?'default':'off'};
  if(body.action==='publish') {
   if(!validID(body.id)||!Number.isInteger(body.revision)||typeof body.santaRadio!=='boolean'||typeof body.christmasRadio!=='boolean'||(!body.santaRadio&&!body.christmasRadio))throw promotionError('Select a saved banner and at least one app.');
   const item=await client.query(`SELECT ${fieldsSQL} FROM santa_app_promotions WHERE id=$1 AND revision=$2 FOR UPDATE`,[body.id,body.revision]);
   if(!item.rows[0])throw promotionError('The saved banner changed. Reload it before publishing.',409);
   const row=item.rows[0];campaign={mode:'promotion',id:row.id,title:row.title,label:row.label,linkURL:row.linkURL,width:row.width,height:row.height,santaRadio:body.santaRadio,christmasRadio:body.christmasRadio};
   await client.query('UPDATE santa_app_promotions SET ever_published=true WHERE id=$1',[row.id]);
  }else if(!['off','default'].includes(body.action))throw promotionError('Unknown action.');
  await client.query('UPDATE santa_app_promotion_live SET campaign=$1,revision=revision+1,updated_at=now() WHERE singleton',[JSON.stringify(campaign)]);
  await client.query('COMMIT');
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
export async function publicPromotion(app,pool=databasePool()) {
 if(!['santaRadio','christmasRadio'].includes(app))throw promotionError('Unknown app.');
 const result=await pool.query('SELECT campaign,revision FROM santa_app_promotion_live WHERE singleton');
 const {campaign,revision=0}=result.rows[0]||{};
 if(!campaign||campaign.mode==='default')return {version:1,revision,mode:'default'};
 if(campaign.mode==='off'||!campaign[app])return {version:1,revision,mode:'off'};
 return {version:1,revision,mode:'promotion',label:campaign.label,linkURL:campaign.linkURL,width:campaign.width,height:campaign.height,imageURL:`https://www.santaradio.co.uk/api/app-promotions?image=${campaign.id}`};
}
export async function promotionImage(id,owner,pool=databasePool()) {
 if(!validID(id))throw promotionError('Image not found.',404);
 const result=await pool.query('SELECT image_data FROM santa_app_promotions WHERE id=$1 AND (ever_published OR $2)',[id,owner]);
 if(!result.rows[0])throw promotionError('Image not found.',404);
 return Buffer.from(result.rows[0].image_data);
}

export async function seedPromotionLibrary(client,buffer,kind='blackFriday') {
 const dash=kind==='santaDash';
 const id=dash?'bb202611-2700-4000-8000-000000000002':'bb202611-2700-4000-8000-000000000001';
 if((await client.query('SELECT id FROM santa_app_promotions WHERE id=$1',[id])).rowCount)return;
 const image=await preparePromotionImage(buffer);
 await client.query('INSERT INTO santa_app_promotions(id,title,label,link_url,image_data,thumbnail,width,height) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING',[id,dash?'Santa Dash':'Black Friday · 50% off',dash?'Santa Dash. Rooftops, mince pies and Christmas magic.':'Black Friday. 50% off at SantaRadio.co.uk.',dash?'https://apps.apple.com/app/id1057048397':'https://www.santaradio.co.uk/',image.data,image.thumbnail,image.width,image.height]);
}
