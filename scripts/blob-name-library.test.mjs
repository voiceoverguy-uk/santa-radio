import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {createBlobNameLibrary,ACTIVE_NAME_LIBRARY} from '../server/blob-name-library.js';
const hash=x=>createHash('sha256').update(x).digest('hex');
function fixture(){const audio=Buffer.alloc(100,1),file='Áine Rose.mp3',release='a'.repeat(64);const r={file,name:'Áine Rose',id:`f-${hash(file)}`,size:audio.length,sha256:hash(audio)};r.path=`name-library/releases/${release}/audio/${r.id}-${r.sha256}.mp3`;const manifest=Buffer.from(JSON.stringify({release,count:1,records:[r],verifiedAt:new Date().toISOString()}));const objects=new Map([[ACTIVE_NAME_LIBRARY,Buffer.from(JSON.stringify({release,manifestSha256:hash(manifest)}))],[`name-library/releases/${release}/verified-manifest.json`,manifest],[r.path,audio]]);const storage={get:async path=>objects.has(path)?{statusCode:200,stream:new Response(objects.get(path)).body}:null};return {objects,storage,r,audio};}
test('preserves accented labels and verifies bytes',async()=>{const f=fixture(),lib=createBlobNameLibrary({visibility:{hidden:async()=>new Set()},uploads:{records:async()=>[]},storage:f.storage,env:{BLOB_STORE_ID:'store'}});const l=await lib.load();assert.equal(l.records[0].name,'Áine Rose');assert.deepEqual(await lib.sourceBytes(l.records[0]),f.audio);});
test('rejects corrupt audio and unknown recordings',async()=>{const f=fixture(),lib=createBlobNameLibrary({visibility:{hidden:async()=>new Set()},uploads:{records:async()=>[]},storage:f.storage,env:{BLOB_STORE_ID:'store'}}),l=await lib.load();f.objects.set(f.r.path,Buffer.alloc(100,2));await assert.rejects(lib.sourceBytes(l.records[0]),/checksum/);await assert.rejects(lib.sourceBytes({...l.records[0],id:'other'}),/active library/);});
test('absent pointer preserves legacy library',async()=>{const lib=createBlobNameLibrary({visibility:{hidden:async()=>new Set()},uploads:{records:async()=>[]},storage:{get:async()=>null},env:{BLOB_STORE_ID:'store'}});assert.equal(await lib.load(),null);});
test('rejects a modified manifest',async()=>{const f=fixture();f.objects.set([...f.objects.keys()].find(x=>x.endsWith('verified-manifest.json')),Buffer.from('{}'));await assert.rejects(createBlobNameLibrary({visibility:{hidden:async()=>new Set()},uploads:{records:async()=>[]},storage:f.storage,env:{BLOB_STORE_ID:'store'}}).load(),/checksum/);});
test('newly published recordings merge with the migrated library and play back',async()=>{
 const {createLiveNameUploads}=await import('../server/live-name-uploads.js');const f=fixture();
 f.storage.put=async(p,b)=>f.objects.set(p,Buffer.from(b));
 f.storage.list=async({prefix})=>({blobs:[...f.objects.keys()].filter(p=>p.startsWith(prefix)).map(pathname=>({pathname,uploadedAt:new Date()})),hasMore:false});
 const uploads=createLiveNameUploads({storage:f.storage}),lib=createBlobNameLibrary({visibility:{hidden:async()=>new Set()},storage:f.storage,env:{BLOB_STORE_ID:'store'},uploads});
 assert.equal((await lib.load()).records.length,1);
 const data=Buffer.alloc(100,3);await uploads.publish('Élodie May','mp3',data);
 const active=await lib.load({fresh:true});assert.equal(active.records.length,2);const added=active.records.find(r=>r.name==='élodie-may');assert.ok(added);assert.deepEqual(await lib.sourceBytes(added),data);
});

test('hidden names disappear from public catalogue and can be restored without removing audio',async()=>{
 const f=fixture();let hidden=new Set(['áine-rose']);const lib=createBlobNameLibrary({visibility:{hidden:async()=>hidden},uploads:{records:async()=>[]},storage:f.storage,env:{BLOB_STORE_ID:'test'}});
 assert.equal((await lib.load()).records.length,0);assert.equal((await lib.load({includeHidden:true})).records.length,1);assert.ok(f.objects.has(f.r.path));
 hidden=new Set();assert.equal((await lib.load()).records.length,1);
});
