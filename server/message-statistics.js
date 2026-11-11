import { dismissNameRequest, databasePool } from './name-request-store.js';
import express from 'express';
import { validOwnerToken } from './studio-owner-handler.js';
import { verifyReceipt, recordDownload, statisticsReport } from './message-statistics-store.js';
import { listNameRequests, recordNameRequest } from './name-request-store.js';
import { normaliseRequestedName } from '../src/lib/santaNameRequests.js';
import { getClerkProxyHost } from './middlewares/clerkProxyMiddleware.js';
export function createStatisticsHandler({ allowed=validOwnerToken, report=statisticsReport, download=recordDownload,
  requests=listNameRequests, complete=recordNameRequest, dismiss=dismissNameRequest }={}) {
  return async (req,res) => {
    res.set('Cache-Control','private, no-store').set('CDN-Cache-Control','no-store').set('X-Robots-Tag','noindex, nofollow');
    try {
      if (!['GET','POST','PATCH'].includes(req.method)) return res.status(405).json({error:'Method not allowed.'});
      if (req.method !== 'GET') {
        let origin; try { origin=new URL(req.headers.origin); } catch { /* rejected below */ }
        if (!origin || origin.host !== getClerkProxyHost(req) || req.headers['sec-fetch-site']==='cross-site') return res.status(403).json({error:'Please use the Santa Radio website.'});
      }
      if(req.method==='POST') {
        const id=verifyReceipt(req.body?.receipt);
        if(!id) return res.status(400).json({error:'Invalid or expired recording receipt.'});
        await download(id); return res.json({ok:true});
      }
      if(!allowed(req)) return res.status(401).json({error:'Enter your private Studio owner token to view this dashboard.'});
      if(req.method==='PATCH') {
        const name=normaliseRequestedName(req.body?.name);
        if(!['recorded','dismiss','restore'].includes(req.body?.action)||!name) return res.status(400).json({error:'Choose a requested name.'});
        if(req.body.action==='recorded')await complete(name.key);else await dismiss(name.key,req.body.action==='restore');return res.json({ok:true});
      }
      const data=await report();
      try { data.requests=(await requests(1,'','outstanding',false)).requests; }
      catch { data.requests=null; }
      try { data.nameNotifications=(await databasePool().query("SELECT state,count(*)::integer AS count FROM santa_name_request_notifications WHERE state IN ('pending','sending','review') GROUP BY state")).rows; } catch { data.nameNotifications=null; }
      return res.json(data);
    }catch {return res.status(503).json({error:'The dashboard is temporarily unavailable. Please try again.'});}
  };
}
const app=express();app.disable('x-powered-by');app.use(express.json({limit:'2kb',inflate:false}));app.use(createStatisticsHandler());
app.use((_err,_req,res,_next)=>res.status(400).json({error:'Invalid request.'}));
export default app;
