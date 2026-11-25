import assert from 'node:assert/strict';
import { test } from 'node:test';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { BlobNotFoundError } from '@vercel/blob';
import { isMp4Video } from '../server/verify-demo-video.js';
import { createMessageDemos } from '../server/message-demos.js';

function atom(type, ...contents) {
  const data = Buffer.concat(contents);
  const header = Buffer.alloc(8);
  header.writeUInt32BE(data.length+8); header.write(type,4);
  return Buffer.concat([header,data]);
}
function movie(handler) {
  return Buffer.concat([atom('ftyp',Buffer.from('isom0000mp42')),atom('mdat',Buffer.alloc(8192)),
    atom('moov',atom('trak',atom('mdia',atom('hdlr',Buffer.alloc(8),Buffer.from(handler)))) )]);
}
test('validates the movie track even with media before the index',async()=>{
  for (const [data,expected] of [[movie('vide'),true],[movie('soun'),false],[Buffer.alloc(128),false],
    [Buffer.from('ID3 renamed MP3'.repeat(12)),false],[movie('vide').subarray(0,267),false]]) {
    assert.equal(await isMp4Video(data.length,async(pos,len)=>data.subarray(pos,pos+len)),expected);
  }
});

test('owner publishes, previews and deletes demos independently of other message pages', async () => {
  const objects = new Map(), grants = [];
  const storage = {
    async list({prefix, cursor}) {
      const all = Array.from(objects.keys()).filter(key => key.startsWith(prefix)).sort();
      const offset = Number(cursor || 0), chunk = all.slice(offset, offset + 1);
      return {blobs:chunk.map(pathname => ({pathname,uploadedAt:new Date()})), hasMore:offset + 1 < all.length, cursor:String(offset + 1)};
    },
    async put(pathname, data) { objects.set(pathname, data); },
    async head(pathname) {
      if (!objects.has(pathname)) throw new BlobNotFoundError();
      return {size:objects.get(pathname).length,contentType:'video/mp4'};
    },
    async copy(from,to) { assert.ok(objects.has(from)); objects.set(to,objects.get(from)); },
    async del(pathname) { objects.delete(pathname); },
    async issueSignedToken(grant) { grants.push(grant); return grant; },
    async presignUrl(grant, options) {
      assert.equal(grant.pathname, options.pathname);
      assert.equal(options.access, 'private');
      return {presignedUrl:'https://example.test/' + options.pathname};
    },
  };
  const fetchMedia = async (url,{headers}) => {
    const data=objects.get(new URL(url).pathname.slice(1));
    const [,start,end] = /^bytes=(\d+)-(\d+)$/.exec(headers.Range);
    return new Response(data.subarray(Number(start),Number(end)+1),{status:206});
  };
  const app = createMessageDemos({storage, fetchMedia, owner:req => req.headers.authorization === 'Bearer test-owner'});
  const origin = 'https://dashboard.test';
  function request(url, options = {}) {
    const target = new URL(url);
    const req = new IncomingMessage(new Socket());
    req.method = options.method || 'GET';
    req.url = target.pathname + target.search;
    req.headers = {host:target.host, ...Object.fromEntries(new Headers(options.headers))};
    if (options.body) {
      req.headers['content-length'] = String(Buffer.byteLength(options.body));
      req.push(Buffer.from(options.body));
    }
    req.push(null);
    return new Promise((resolve,reject) => {
      const res = new ServerResponse(req);
      res.end = body => resolve(new Response(body, {status:res.statusCode,headers:res.getHeaders()}));
      app(req,res,reject);
    });
  }
  const url = group => origin + '/api/message-demos?group=' + group;
  const list = async group => (await (await request(url(group))).json()).demos;
  const post = (group, body, headers={}) => request(url(group), {method:'POST',headers:{
    'Content-Type':'application/json', Authorization:'Bearer test-owner', Origin:origin, ...headers,
  }, body:JSON.stringify(body)});
  const video = movie('vide');
  const payload = {action:'upload', name:'A new demo 🎅', size:video.length, contentType:'video/mp4'};
  assert.equal((await post('dads',payload,{Authorization:''})).status,401);
  assert.equal((await post('free',{action:'delete',id:'01'},{Origin:'https://other.test'})).status,403);
  assert.equal((await post('dads',{...payload,size:101*1024*1024})).status,400);
  assert.equal((await post('dads',{...payload,contentType:'audio/mpeg'})).status,400);
  assert.equal((await post('invalid',payload)).status,400);
  for (const group of ['free','kids','dads']) {
    const before = await list(group);
    assert.ok(before.length && before.every(row => row.src.endsWith('.mp4')));
    const target = await (await post(group,payload)).json();
    const staged = grants.at(-1);
    assert.equal(target.headers['x-content-type'],'video/mp4');
    assert.equal(staged.maximumSizeInBytes,video.length);
    objects.set(staged.pathname,video);
    assert.deepEqual(await list(group),before);
    assert.equal((await post(group,{action:'publish',id:target.id})).status,200);
    assert.equal((await post(group,{action:'publish',id:target.id})).status,200);
    const [entry] = await list(group);
    assert.equal(entry.id,target.id); assert.equal(entry.name,payload.name);
    const play = await request(origin+entry.src);
    assert.equal(play.status,307); assert.ok(play.headers.get('location').includes('/files/'));
    assert.deepEqual(grants.at(-1).operations,['get']);
    assert.equal((await post(group,{action:'delete',id:entry.id})).status,200);
    assert.deepEqual(await list(group),before);
    assert.equal((await post(group,{action:'delete',id:before[0].id})).status,200);
    assert.deepEqual(await list(group),before.slice(1));
  }
  const target = await (await post('free',payload)).json();
  objects.set(grants.at(-1).pathname,movie('soun'));
  assert.equal((await post('free',{action:'publish',id:target.id})).status,400);
  assert.ok(!(await list('free')).some(row=>row.id===target.id));
});
