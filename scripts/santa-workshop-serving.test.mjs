import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { canonicalPaths, resolvePublicRequest } from '../src/seo/routes.js';
import { sitemap } from '../server/public-html.js';
import publicPage from '../api/public-page.js';

const path = '/santa-message-workshop';

test('workshop is directly accessible but never canonical or in the sitemap', () => {
  assert.deepEqual(resolvePublicRequest(path), { status: 200, noindex: true });
  assert.deepEqual(resolvePublicRequest(`${path}/`), { status: 308, location: path });
  assert.ok(!canonicalPaths.includes(path));
  assert.ok(!sitemap().includes(path));
  assert.deepEqual(resolvePublicRequest('/free-santa-message'), { status: 200 });
});

function assertPreview(html) {
  assert.match(html, /Santa’s Message Workshop/);
  assert.match(html, /name="robots" content="noindex, follow"/);
  assert.doesNotMatch(html, /rel="canonical"/);
  assert.doesNotMatch(html, /Page not found/);
}

test('built preview HTML and serverless document have honest noindex content', async () => {
  assertPreview(await readFile(`dist${path}/index.html`, 'utf8'));
  const response = {
    headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    status(value) { this.code = value; return this; },
    end(body) { this.body = body; },
  };
  await publicPage({ method: 'GET', url: `/api/public-page?__sr_route=${path}` }, response);
  assert.equal(response.code, 200);
  assert.equal(response.headers['X-Robots-Tag'], 'noindex, follow');
  assert.equal(response.headers['X-Santa-Page-Mode'], 'prerendered');
  assertPreview(response.body);
});

test('compiled Node SSR serves the preview, headers and unchanged free maker', async t => {
  const child = spawn(process.execPath, ['index.js', '--port=0'], { stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => child.kill('SIGTERM'));
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Node server did not start')), 15000);
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Node server exited ${code}`)); });
    child.stdout.on('data', data => {
      const match = data.toString().match(/listening on port (\d+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
  });
  const response = await fetch(`http://127.0.0.1:${port}${path}`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, follow');
  assertPreview(await response.text());
  const maker = await fetch(`http://127.0.0.1:${port}/free-santa-message`);
  assert.equal(maker.status, 200);
  const makerHtml = await maker.text();
  assert.match(makerHtml, /Free Personalised Santa Message/);
  assert.doesNotMatch(makerHtml, /href="\/santa-message-workshop/);
});
