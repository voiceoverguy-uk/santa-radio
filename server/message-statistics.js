import { visitorReport } from './google-analytics-statistics.js';
import { listDadVouchers } from './dad-vouchers.js';
import { gameReport, recordGameRound } from './christmas-game-statistics.js';
import { dashboardTodos } from './dashboard-todos.js';
import { appleDownloadReport } from './apple-download-statistics.js';
import { recordCheckerDownload, checkerDownloadReport, validDownloadId } from './checker-download-statistics.js';
import { consumeNameAccess } from './santa-name-security.js';
import { listFriendVouchers } from './friend-vouchers.js';
import { requestRecordingStatus } from './request-recording-status.js';
import { dismissNameRequest, rejectNameRequest, databasePool } from './name-request-store.js';
import express from 'express';
import { websiteEmailStatistics } from './website-email-statistics.js';
import { paidStatistics } from './paid-statistics.js';
import { songSubmissionStatistics } from './song-submission-statistics.js';
import { validOwnerToken } from './studio-owner-handler.js';
import { verifyReceipt, recordEngagement, recordDownload, statisticsReport } from './message-statistics-store.js';
import { listNameRequests, recordNameRequest } from './name-request-store.js';
import { normaliseRequestedName } from '../src/lib/santaNameRequests.js';
import { getClerkProxyHost } from './middlewares/clerkProxyMiddleware.js';
export function createStatisticsHandler({ allowed=validOwnerToken, todos=dashboardTodos, report=statisticsReport, download=recordDownload, engagement=recordEngagement,
  appleDownloads=appleDownloadReport, checkerDownloads=checkerDownloadReport, checkerDownload=recordCheckerDownload, checkerLimit=consumeNameAccess,
  requests=listNameRequests, complete=recordNameRequest, dismiss=dismissNameRequest, paid=paidStatistics, emails=websiteEmailStatistics, songs=songSubmissionStatistics, recordingStatus=requestRecordingStatus, friends=listFriendVouchers, dadVouchers=listDadVouchers }={}) {
  return async (req,res) => {
    res.set('Cache-Control','private, no-store').set('CDN-Cache-Control','no-store').set('X-Robots-Tag','noindex, nofollow');
    try {
      if (!['GET','POST','PATCH'].includes(req.method)) return res.status(405).json({error:'Method not allowed.'});
      if (req.method !== 'GET') {
        let origin; try { origin=new URL(req.headers.origin); } catch { /* rejected below */ }
        if (!origin || origin.host !== getClerkProxyHost(req) || req.headers['sec-fetch-site']==='cross-site') return res.status(403).json({error:'Please use the Santa Radio website.'});
      }
      if(req.method==='POST') {
        if (['game-start','game-reveal'].includes(req.body?.action)) {
          const { eventId, title, action } = req.body;
          if (!validDownloadId(eventId) || (action === 'game-reveal'
            ? typeof title !== 'string' || !title.trim() || title.length > 160 : title !== undefined))
            return res.status(400).json({error:'Invalid round.'});
          await checkerLimit(req, 'checkerDownload');
          await recordGameRound(eventId, title?.trim());
          return res.json({ok:true});
        }
        if (req.body?.action === 'checker-pdf-download') {
          if (!validDownloadId(req.body.eventId) || Object.keys(req.body).some(key => !['action','eventId'].includes(key)))
            return res.status(400).json({error:'Invalid download event.'});
          await checkerLimit(req, 'checkerDownload');
          await checkerDownload(req.body.eventId);
          return res.json({ok:true});
        }
        const id=verifyReceipt(req.body?.receipt);
        if(!id) return res.status(400).json({error:'Invalid or expired recording receipt.'});
        const action = req.body?.action ?? 'download';
        if (!['download','mp4-download','listen','share'].includes(action)) return res.status(400).json({error:'Invalid recording action.'});
        if (action === 'download') await download(id); else await engagement(id, action);
        return res.json({ok:true});
      }
      if(!allowed(req)) return res.status(401).json({error:'Enter your private Studio owner token to view this dashboard.'});
      if(req.method==='GET' && req.query?.view==='visitors') return res.json(await visitorReport());
      if(req.query?.view==='todos') {
        try { return res.json(await todos(req.method==='PATCH'?req.body:undefined)); }
        catch(error) { if([400,404].includes(error.status))return res.status(error.status).json({error:error.message}); throw error; }
      }
      if(req.method==='GET' && req.query?.view==='dad-vouchers') return res.json(await dadVouchers());
      if(req.method==='GET' && req.query?.view==='friends') return res.json(await friends());
      if(req.method==='GET' && req.query?.view==='songs') {
        const raw=req.query.offset ?? '0';
        if(typeof raw!=='string' || !/^\d{1,7}$/.test(raw)) return res.status(400).json({error:'Invalid page.'});
        return res.json(await songs({offset:Number(raw)}).catch(()=>({error:'service_unavailable'})));
      }
      if(req.method==='PATCH') {
        const name=normaliseRequestedName(req.body?.name);
        if(!['recorded','dismiss','restore','reject'].includes(req.body?.action)||!name) return res.status(400).json({error:'Choose a requested name.'});
        if(req.body.action==='reject')return res.json(await rejectNameRequest(name.key));
        if(req.body.action==='recorded')await complete(name.key);else await dismiss(name.key,req.body.action==='restore');return res.json({ok:true});
      }
      const [data,paidResult,emailResult]=await Promise.all([report(),paid().catch(()=>null),emails().catch(()=>null)]);
      data.christmasGame=await gameReport().catch(()=>null);
      data.appleDownloads=await appleDownloads().catch(()=>null);
      data.checkerDownloads=await checkerDownloads().catch(()=>null);
      data.paid=paidResult; data.brevo=null; data.websiteEmails=emailResult;
      try { data.requests=await recordingStatus((await requests(1,'','outstanding',false)).requests); }
      catch { data.requests=null; }
      try { data.nameNotifications=(await databasePool().query("SELECT state,count(*)::integer AS count FROM santa_name_request_notifications WHERE state IN ('pending','sending','review') GROUP BY state")).rows; } catch { data.nameNotifications=null; }
      return res.json(data);
    }catch {return res.status(503).json({error:'The dashboard is temporarily unavailable. Please try again.'});}
  };
}
const app=express();app.disable('x-powered-by');app.use(express.json({limit:'2kb',inflate:false}));app.use(createStatisticsHandler());
app.use((_err,_req,res,_next)=>res.status(400).json({error:'Invalid request.'}));
export default app;
