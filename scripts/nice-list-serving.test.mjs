import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';

test('built Node SSR serves the exact generic master and font without loading certificate work into documents', async t => {
  const child = spawn(process.execPath, ['index.js', '--port=0'], { stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => child.kill('SIGTERM'));
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Built server did not start')), 10000);
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Server exited: ${code}`)); });
    child.stdout.on('data', data => {
      const match = data.toString().match(/listening on port (\d+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
  });
  const get = path => fetch(`http://127.0.0.1:${port}${path}`);
  for (const file of ['master.pdf', 'GreatVibes-Regular.ttf', 'cormorantgaramond-OFL.txt', 'greatvibes-OFL.txt']) {
    const response = await get(`/certificates/nice-list/${file}`);
    assert.equal(response.status, 200);
    if (file.endsWith('.pdf')) assert.match(response.headers.get('content-type'), /application\/pdf/);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), await readFile(`public/certificates/nice-list/${file}`));
  }
  for (const name of ['edward', 'ayla']) {
    const path = `/certificates/examples/${name}.webp`;
    const response = await get(path);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /image\/webp/);
    assert.equal(response.headers.get('cache-control'), 'no-cache');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), await readFile(`public${path}`));
  }
  for (const path of ['/', '/free-santa-message']) {
    const response = await get(path);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /FREE Personalised message from Santa/);
    assert.ok(!html.includes('personaliseNiceListCertificate'));
    assert.ok(!html.includes('GreatVibes-Regular.ttf'));
    assert.ok(!html.includes('/certificates/nice-list/master.pdf'));
  }
});
