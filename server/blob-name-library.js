import { get } from '@vercel/blob';
import { createHash } from 'node:crypto';
import { santaMessageDownloadName } from '../src/data/santaMessages.js';
const hash = data => createHash('sha256').update(data).digest('hex');
export const ACTIVE_NAME_LIBRARY = 'name-library/active.json';
export function createBlobNameLibrary({ storage = { get }, env = process.env, now = Date.now } = {}) {
  let cached, expires = 0, pending;
  async function bytes(path, limit, signal) {
    const response = await storage.get(path, { access: 'private', useCache: false, abortSignal: signal || AbortSignal.timeout(30000) });
    if (!response) return null;
    if (response.statusCode !== 200) throw Error('Blob recording unavailable');
    const chunks=[]; let size=0;
    for await (const chunk of response.stream) { size+=chunk.length; if(size>limit) throw Error('Blob size limit exceeded'); chunks.push(Buffer.from(chunk)); }
    return Buffer.concat(chunks);
  }
  async function load() {
    if (!env.BLOB_READ_WRITE_TOKEN && !env.BLOB_STORE_ID) return null;
    if (now()<expires) return cached;
    if (pending) return pending;
    pending=(async()=>{
      const pointerBytes=await bytes(ACTIVE_NAME_LIBRARY,4096);
      if(!pointerBytes){cached=null;expires=now()+60000;return null;}
      const pointer=JSON.parse(pointerBytes);
      if(!/^[a-f0-9]{64}$/.test(pointer.release)||!/^[a-f0-9]{64}$/.test(pointer.manifestSha256))throw Error('Invalid library pointer');
      const raw=await bytes(`name-library/releases/${pointer.release}/verified-manifest.json`,20*1024*1024);
      if(!raw||hash(raw)!==pointer.manifestSha256)throw Error('Library manifest checksum mismatch');
      const manifest=JSON.parse(raw);
      if(manifest.release!==pointer.release||!Array.isArray(manifest.records)||manifest.count!==manifest.records.length||!manifest.count||manifest.count>20000)throw Error('Invalid library manifest');
      const seen=new Set();
      const records=manifest.records.map(r=>{
        const extension=/\.(mp3|wav)$/i.exec(r.file||'')?.[1].toLowerCase();
        if(!extension||typeof r.name!=='string'||!r.name||r.name.length>200||/[\x00-\x1f/\\]/.test(r.file)||r.id!==`f-${hash(r.file)}`||seen.has(r.id)||!/^[a-f0-9]{64}$/.test(r.sha256)||!Number.isInteger(r.size)||r.size<44||r.size>10*1024*1024)throw Error('Invalid library recording');
        const path=`name-library/releases/${pointer.release}/audio/${r.id}-${r.sha256}.${extension}`;
        if(r.path!==path)throw Error('Invalid recording path');
        seen.add(r.id);
        return {...r,source:'hosted',blobPath:path,aliases:[],downloadName:santaMessageDownloadName(r.name),uploadedAt:manifest.verifiedAt};
      });
      cached={release:pointer.release,records};expires=now()+60000;return cached;
    })().finally(()=>{pending=null;});
    return pending;
  }
  async function sourceBytes(record,{signal}={}) {
    const library=await load();const trusted=library?.records.find(r=>r.id===record.id);
    if(!trusted||trusted.blobPath!==record.blobPath)throw Error('Recording is not in the active library');
    const data=await bytes(trusted.blobPath,trusted.size,signal);
    if(!data||data.length!==trusted.size||hash(data)!==trusted.sha256)throw Error('Recording checksum mismatch');
    return data;
  }
  return {load,sourceBytes};
}
export const blobNameLibrary=createBlobNameLibrary();
