import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { yesterdayWindow } from '../server/radio-history-time.js';

for (const mode of ['Node', 'Vercel']) test(`${mode} top-ten route is inactive by default and read-only`, async t => {
  const args = mode === 'Node' ? ['index.js', '--port=0'] : ['--input-type=module', '-e', `
    import {createServer} from 'node:http';
    import handler from './api/radio-top-ten.js';
    const server=createServer(handler);
    server.listen(0,'127.0.0.1',()=>console.log('listening on port '+server.address().port));
    process.on('SIGTERM',()=>server.close());
  `];
  const server = spawn(process.execPath, args, { env: { ...process.env, RADIO_HISTORY_ENABLED: 'false' }, stdio: ['ignore','pipe','pipe'] });
  t.after(async () => { if (server.exitCode === null) { const exited=once(server,'exit'); server.kill(); await exited; } });
  const base = await new Promise((resolve,reject) => {
    let output='';
    const timer=setTimeout(()=>reject(Error(output)),10000);
    server.stdout.on('data', chunk => {
      output+=chunk;
      const match=output.match(/listening on port (\d+)/);
      if(match) { clearTimeout(timer); resolve(`http://127.0.0.1:${match[1]}`); }
    });
    server.stderr.on('data', chunk=>{output+=chunk;});
    server.once('exit',()=>{ clearTimeout(timer); reject(Error(output)); });
  });
  const response=await fetch(`${base}/api/radio-top-ten`);
  assert.equal(response.status,200); assert.equal(response.headers.get('cache-control'),'no-store');
  const result=await response.json();
  assert.equal(result.state,'inactive'); assert.deepEqual(result.songs,[]);
  assert.equal(result.date,yesterdayWindow().date);
  const post=await fetch(`${base}/api/radio-top-ten`,{method:'POST'});
  assert.equal(post.status,405); assert.equal(post.headers.get('allow'),'GET');
});
