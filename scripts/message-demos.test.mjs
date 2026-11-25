import assert from 'node:assert/strict';
import { test } from 'node:test';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { createMessageDemos } from '../server/message-demos.js';

test('owner publishes, previews and deletes demos independently of other message pages', async () => {
  const objects = new Map(), grants = [];
  const storage = {
    async list({prefix, cursor}) {
      const all = Array.from(objects.keys()).filter(key => key.startsWith(prefix)).sort();
      const offset = Number(cursor || 0), chunk = all.slice(offset, offset + 1);
      return {blobs:chunk.map(pathname => ({pathname,uploadedAt:new Date()})), hasMore:offset + 1 < all.length, cursor:String(offset + 1)};
    },
    async put(pathname, data) { objects.set(pathname, data); },
    async del(pathname) { objects.delete(pathname); },
    async issueSignedToken(grant) { grants.push(grant); return grant; },
    async presignUrl(grant, options) {
      assert.equal(grant.pathname, options.pathname);
      assert.equal(options.access, 'private');
      return {presignedUrl:'https://example.test/' + options.pathname};
    },
  };
  const app = createMessageDemos({storage, owner:req => req.headers.authorization === 'Bearer test-owner'});
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
  assert.equal((await list('free')).length, 5);
  assert.equal((await list('kids')).length, 4);
  assert.deepEqual(await list('dads'), []);
  const payload = {action:'upload',name:'A new demo 🎅',size:9000};
  assert.equal((await post('dads',payload,{Authorization:''})).status,401);
  assert.equal((await post('free',{action:'delete',id:'boy'},{Origin:'https://other.test'})).status,403);
  assert.equal((await post('dads',{...payload,size:50*1024*1024})).status,400);
  assert.equal((await post('invalid',payload)).status,400);
  const upload = await (await post('dads',payload)).json();
  assert.equal(upload.headers['x-content-type'],'audio/mpeg');
  const grant = grants.at(-1);
  assert.deepEqual(grant.operations,['put']); assert.equal(grant.maximumSizeInBytes,9000);
  assert.deepEqual(await list('dads'),[]); // An interrupted upload is never listed.
  objects.set(grant.pathname,'audio');
  const [demo] = await list('dads');
  assert.equal(demo.name,payload.name); assert.equal(demo.id,upload.id);
  const play = await request(origin + demo.src, {redirect:'manual'});
  assert.equal(play.status,307); assert.equal(play.headers.get('location'),upload.url);
  assert.deepEqual(grants.at(-1).operations,['get']);
  assert.equal((await post('free',{action:'delete',id:'boy'})).status,200);
  assert.equal((await list('free')).some(row=>row.id==='boy'),false);
  assert.equal((await list('kids')).length,4);
  assert.equal((await list('dads')).length,1);
  assert.equal((await post('dads',{action:'delete',id:upload.id})).status,200);
  assert.equal((await post('dads',{action:'delete',id:upload.id})).status,200);
  assert.deepEqual(await list('dads'),[]);
});
