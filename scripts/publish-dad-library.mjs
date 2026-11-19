import {get,put} from '@vercel/blob';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
if(process.env.VERCEL_ENV!=='production')throw Error('Production publication only');
const root=new URL('../server/dad-release/',import.meta.url),raw=await readFile(new URL('manifest.json',root)),manifest=JSON.parse(raw);
if(manifest.records.length!==233)throw Error('Incomplete Dad release');
async function bytes(path){const r=await get(path,{access:'private',useCache:false});if(!r)return null;if(r.statusCode!==200)throw Error('Blob read failed');const chunks=[];for await(const c of r.stream)chunks.push(Buffer.from(c));return Buffer.concat(chunks);}
const previous=await bytes('dad-library/active.json');
for(const row of manifest.records){
 const data=await readFile(new URL(`flac/${row.local}`,root));if(data.length!==row.size||hash(data)!==row.sha256)throw Error('Invalid local FLAC');
 const old=await bytes(row.path);if(old){if(hash(old)!==row.sha256)throw Error('Blob collision');continue;}
 await put(row.path,data,{access:'private',addRandomSuffix:false,contentType:'audio/flac'});
 if(hash(await bytes(row.path))!==row.sha256)throw Error('Upload checksum mismatch');
}
const path=`dad-library/releases/${manifest.release}/manifest.json`;
const old=await bytes(path);if(old&&hash(old)!==hash(raw))throw Error('Manifest conflict');if(!old)await put(path,raw,{access:'private',addRandomSuffix:false,contentType:'application/json'});
const current=await bytes('dad-library/active.json');if(String(current)!==String(previous))throw Error('Dad pointer changed during publication');
const pointer=Buffer.from(JSON.stringify({release:manifest.release,sha256:hash(raw)}));
await put('dad-library/active.json',pointer,{access:'private',addRandomSuffix:false,allowOverwrite:true,contentType:'application/json'});
if(hash(await bytes('dad-library/active.json'))!==hash(pointer))throw Error('Dad activation failed');
console.log(JSON.stringify({dadLibraryPublished:true,recordings:233,release:manifest.release}));
