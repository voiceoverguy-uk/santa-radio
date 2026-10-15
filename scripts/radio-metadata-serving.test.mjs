import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

const current = { current: { artist: 'Leona Lewis', title: 'One More Sleep' }, currentStatus: 'ready' };
const tracks = [
  { artist: 'Bryan Adams', title: 'Christmas Time' },
  { artist: 'Leona Lewis', title: 'One More Sleep' },
];

for (const mode of ['built Node server', 'Vercel API export']) {
  test(`${mode} serves corrected combined and partial metadata with unchanged HTTP contract`, async t => {
    const args = ['--import', './scripts/fixtures/radio-metadata-fetch.mjs'];
    if (mode === 'built Node server') args.push('index.js', '--port=0');
    else args.push('--input-type=module', '-e', `
      import { createServer } from 'node:http';
      import handler from './api/radio-metadata.js';
      const server = createServer(handler);
      server.listen(0, '127.0.0.1', () => console.log('listening on port ' + server.address().port));
      process.on('SIGTERM', () => server.close());
    `);
    const server = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    t.after(async () => {
      if (server.exitCode === null) {
        const exited = once(server, 'exit');
        server.kill();
        await exited;
      }
    });
    const base = await new Promise((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => reject(new Error(`Server startup timed out: ${output}`)), 10000);
      server.stdout.on('data', chunk => {
        output += chunk;
        const match = output.match(/listening on port (\d+)/);
        if (match) { clearTimeout(timer); resolve(`http://127.0.0.1:${match[1]}`); }
      });
      server.stderr.on('data', chunk => { output += chunk; });
      server.once('exit', code => { clearTimeout(timer); reject(new Error(`Server exited ${code}: ${output}`)); });
    });
    for (const part of ['upcoming', 'current', 'all', '']) {
      const response = await fetch(`${base}/api/radio-metadata${part ? `?part=${part}` : ''}`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.match(response.headers.get('content-type'), /application\/json/);
      const data = await response.json();
      if (part === 'current') assert.deepEqual(data, current);
      else {
        assert.deepEqual(data.upcoming, tracks);
        assert.equal(data.upcomingStatus, 'ready');
        assert.ok(Number.isFinite(data.upcomingUpdatedAt));
        if (part === 'upcoming') {
          assert.deepEqual(Object.keys(data).sort(), ['upcoming', 'upcomingStatus', 'upcomingUpdatedAt'].sort());
        } else assert.deepEqual({ current: data.current, currentStatus: data.currentStatus }, current);
      }
    }
    assert.equal((await fetch(`${base}/api/radio-metadata?part=wrong`)).status, 400);
    const post = await fetch(`${base}/api/radio-metadata`, { method: 'POST' });
    assert.equal(post.status, 405);
    assert.equal(post.headers.get('allow'), 'GET');
  });
}
