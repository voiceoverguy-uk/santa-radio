import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';

let server, base;
const path = '/media/santa-dash-gameplay-v1.mp4';
before(async () => {
  server = spawn(process.execPath, ['index.js', '--port=0'], { stdio: ['ignore', 'pipe', 'pipe'] });
  base = await new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => { server.kill(); reject(new Error('Production server failed to start')); }, 10000);
    server.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/listening on port (\d+)/);
      if (match) { clearTimeout(timeout); resolve(`http://127.0.0.1:${match[1]}`); }
    });
    server.once('exit', () => { clearTimeout(timeout); reject(new Error('Production server exited')); });
  });
});
after(async () => {
  if (server?.exitCode === null) await new Promise(resolve => { server.once('exit', resolve); server.kill(); });
});
test('production serves versioned H264 video with correct MIME, caching and HEAD metadata', async () => {
  const info = await stat(`public${path}`);
  const response = await fetch(base + path, { method: 'HEAD' });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'video/mp4');
  assert.equal(Number(response.headers.get('content-length')), info.size);
  assert.equal(response.headers.get('accept-ranges'), 'bytes');
  assert.match(response.headers.get('cache-control'), /immutable/);
  assert.equal((await response.arrayBuffer()).byteLength, 0);
  const poster = await fetch(base + '/media/santa-dash-gameplay-poster.webp');
  assert.equal(poster.status, 200);
  assert.equal(poster.headers.get('content-type'), 'image/webp');
  await poster.body.cancel();
});
test('production accepts Safari-style bounded/open/suffix ranges and rejects invalid ranges', async () => {
  const bytes = await readFile(`public${path}`);
  for (const [range, start, end] of [['bytes=0-1', 0, 1], ['bytes=-8', bytes.length - 8, bytes.length - 1],
    [`bytes=${bytes.length - 8}-`, bytes.length - 8, bytes.length - 1]]) {
    const response = await fetch(base + path, { headers: { range } });
    assert.equal(response.status, 206);
    assert.equal(response.headers.get('content-range'), `bytes ${start}-${end}/${bytes.length}`);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes.subarray(start, end + 1));
  }
  for (const range of ['bytes=999999999-', 'bytes=8-2', 'bytes=-0', 'bytes=0-1,3-4', 'invalid']) {
    const response = await fetch(base + path, { headers: { range } });
    assert.equal(response.status, 416);
    assert.equal(response.headers.get('content-range'), `bytes */${bytes.length}`);
  }
});
test('MP4 has faststart metadata before media bytes and the approved exact landscape aspect ratio', async () => {
  const bytes = await readFile(`public${path}`);
  let offset = 0, moov = -1, mdat = -1;
  while (offset + 8 <= bytes.length) {
    const size = bytes.readUInt32BE(offset);
    assert.ok(size >= 8, 'bounded MP4 atom');
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    if (type === 'moov') moov = offset;
    if (type === 'mdat') mdat = offset;
    offset += size;
  }
  assert.ok(moov >= 0 && mdat > moov);
  assert.ok(bytes.length < 1_500_000);
});
