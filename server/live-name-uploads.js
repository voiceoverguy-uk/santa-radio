import { put, get, list } from '@vercel/blob';
import { createHash } from 'node:crypto';
import { recordingUploadName } from '../src/lib/recordingUploadName.js';
import { santaMessageDownloadName } from '../src/data/santaMessages.js';
const hash=data=>createHash('sha256').update(data).digest('hex');
const prefix='name-library/uploads/catalogue/';
export function createLiveNameUploads({storage={put,get,list},now=Date.now}={}) {
  let cache,expires=0;
  async function records({fresh=false}={}) {
    if(!fresh&&cache&&now()<expires)return cache;
    const rows=[];let cursor;
    do {
      const page=await storage.list({prefix,limit:1000,...(cursor?{cursor}:{}),abortSignal:AbortSignal.timeout(15000)});
      for(const b of page.blobs){
        const m=b.pathname.match(/^name-library\/uploads\/catalogue\/([a-f0-9]{64})\/([a-f0-9]+)\/(\d+)\.(mp3|wav)\.json$/);
        if(!m)continue;
        const name=Buffer.from(m[2],'hex').toString('utf8'),size=Number(m[3]);
        if(!/^[\p{L}\p{M}][\p{L}\p{M}0-9 '’_-]{0,79}$/u.test(name)||size<44||size>3*1024*1024)throw Error('Invalid live recording marker');
        const path=`name-library/uploads/audio/${m[1]}/${m[2]}.${m[4]}`;
        rows.push({id:`f-${hash(path)}`,name,file:`${name}.${m[4]}`,path,blobPath:path,sha256:m[1],size,uploadedAt:b.uploadedAt,source:'hosted',aliases:[],downloadName:santaMessageDownloadName(name)});
      }
      cursor=page.hasMore?page.cursor:null;if(page.hasMore&&!cursor)throw Error('Invalid Blob page');
      if(rows.length>20000)throw Error('Live upload limit exceeded');
    }while(cursor);
    cache=rows;expires=now()+10000;return rows;
  }
  async function publish(name,extension,bytes){
    name=recordingUploadName(name);
    if(!/^[\p{L}\p{M}][\p{L}\p{M}0-9 '’_-]{0,79}$/u.test(name)||!['mp3','wav'].includes(extension))throw Error('Invalid recording name');
    const sha=hash(bytes),encoded=Buffer.from(name.normalize('NFC')).toString('hex');
    const path=`name-library/uploads/audio/${sha}/${encoded}.${extension}`;
    await storage.put(path,bytes,{access:'private',addRandomSuffix:false,allowOverwrite:true,contentType:extension==='wav'?'audio/wav':'audio/mpeg'});
    const saved=await storage.get(path,{access:'private',useCache:false,abortSignal:AbortSignal.timeout(30000)});
    if(!saved||saved.statusCode!==200)throw Error('Cannot verify uploaded audio');
    const digest=createHash('sha256');let size=0;
    for await(const chunk of saved.stream){size+=chunk.length;if(size>bytes.length)throw Error('Uploaded audio size mismatch');digest.update(chunk);}
    if(size!==bytes.length||digest.digest('hex')!==sha)throw Error('Uploaded audio checksum mismatch');
    // This immutable marker is the publication commit. Independent uploads never
    // rewrite a shared manifest, so concurrent uploads cannot lose each other.
    await storage.put(`${prefix}${sha}/${encoded}/${size}.${extension}.json`,JSON.stringify({version:1,path,sha256:sha,size}),{access:'private',addRandomSuffix:false,allowOverwrite:true,contentType:'application/json'});
    cache=null;expires=0;
    return {name,path,status:'live'};
  }
  return {records,publish};
}
export const liveNameUploads=createLiveNameUploads();
