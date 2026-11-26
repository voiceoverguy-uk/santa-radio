import express from 'express';
import { validOwnerToken } from '../server/studio-owner-handler.js';
import { promotionLibrary,addPromotion,editPromotion,publishPromotion,publicPromotion,promotionImage } from '../server/app-promotions.js';
export const config={api:{bodyParser:false}};
export function createAppPromotionsHandler({authorize=validOwnerToken,library=promotionLibrary,add=addPromotion,edit=editPromotion,publish=publishPromotion,publicConfig=publicPromotion,image=promotionImage}={}) {
 const app=express();
 app.use((req,res,next)=>{
  res.set('Cache-Control','private, no-store').set('X-Content-Type-Options','nosniff');
  if(!['GET','POST','PATCH'].includes(req.method))return res.status(405).set('Allow','GET, POST, PATCH').end();
  const management=req.method!=='GET'||req.query.view==='manage';
  if(management&&!authorize(req))return res.status(401).json({error:'Owner sign-in required.'});
  if(management&&(req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&!['https://www.santaradio.co.uk',`https://${req.headers.host}`].includes(req.headers.origin))))return res.status(403).json({error:'Use the dashboard to make changes.'});
  if(req.method==='POST'&&!['image/png','image/jpeg','image/webp'].includes(req.get('Content-Type')?.split(';')[0]))return res.status(415).json({error:'Upload a PNG, JPEG or WebP.'});
  if(req.method==='PATCH'&&!req.is('application/json'))return res.status(415).end();
  next();
 });
 app.use(express.raw({type:['image/png','image/jpeg','image/webp'],limit:'4mb',inflate:false}));
 app.use(express.json({limit:'4kb',inflate:false}));
 app.use(async(req,res)=>{
  try {
   if(req.method==='GET'&&req.query.image) {
    const owner=authorize(req),data=await image(req.query.image,owner);
    if(!owner)res.set('Cache-Control','public, max-age=31536000, immutable');
    return res.type('jpeg').send(data);
   }
   if(req.method==='GET'&&req.query.view!=='manage') {
    const result=await publicConfig(req.query.app);
    return res.set('Cache-Control','public, max-age=0, s-maxage=30').json(result);
   }
   if(req.method==='POST')await add(req.body,{title:req.query.title,label:req.query.label,linkURL:req.query.linkURL});
   if(req.method==='PATCH') {
    if(req.body.action==='edit')await edit(req.body);else await publish(req.body);
   }
   return res.json(await library());
  }catch(e){return res.status(e.status||503).json({error:e.status?e.message:'Banner settings are temporarily unavailable. Please try again.'});}
 });
 app.use((e,_req,res,_next)=>res.status(e.type==='entity.too.large'?413:400).json({error:e.type==='entity.too.large'?'Choose an image under 4 MB.':'Invalid banner request.'}));
 return app;
}
export default createAppPromotionsHandler();
