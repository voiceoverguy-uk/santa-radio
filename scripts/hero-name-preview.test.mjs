import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { render } from '../dist/server/entry-server.js';
import { canonicalPaths, resolvePublicRequest } from '../src/seo/routes.js';
import publicPage from '../api/public-page.js';

const path = '/preview/hero-name-checker';

test('built preview renders a complete noindex page without affecting the home hero', async () => {
  const preview = render(path);
  assert.equal(preview.status, 200);
  assert.equal(preview.noindex, true);
  assert.match(preview.head, /name="robots" content="noindex, follow"/);
  assert.doesNotMatch(preview.head, /rel="canonical"/);
  assert.match(preview.markup, /Does Santa have your child/);
  assert.match(preview.markup, /Start typing a name/);
  assert.match(preview.markup, /id="santa-messages"/);
  assert.match(preview.markup, /name="FIRSTNAME"/);
  assert.doesNotMatch(preview.markup, /app-store-badge/);
  assert.equal(canonicalPaths.includes(path), false);
  assert.equal(resolvePublicRequest(`${path}/`).location, path);
  const html = await readFile(`dist${path}/index.html`, 'utf8');
  assert.match(html, /Hero preview/);
  assert.match(html, /name="robots" content="noindex, follow"/);
  const functionHtml = await readFile(`dist/server/pages${path}/index.html`, 'utf8');
  assert.equal(html, functionHtml);
  const home = render('/');
  assert.equal(home.status, 200);
  assert.match(home.markup, /app-store-badge/);
  assert.doesNotMatch(home.markup, /hero-name-checker/);
  assert.match(home.markup, /FREE Santa Message/);
});

test('Vercel document handler delivers the prerendered preview, not its 404 or homepage', async () => {
  const headers = {};
  let status, body;
  const res = {
    setHeader: (name, value) => { headers[name] = value; },
    status(code) { status = code; return this; },
    end(value) { body = value; },
  };
  await publicPage({ method: 'GET', url: `/api/public-page?__sr_route=${path}` }, res);
  assert.equal(status, 200);
  assert.equal(headers['X-Santa-Page-Mode'], 'prerendered');
  assert.equal(headers['X-Robots-Tag'], 'noindex, follow');
  assert.match(body, /Does Santa have your child/);
});

test('actual Node production delivery hydrates and supports phone lookup without render errors', async t => {
  const child = spawn(process.execPath, ['index.js', '--port=0'], { stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => child.kill('SIGTERM'));
  const port = await new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(new Error(`Production server did not start: ${output}`)), 10000);
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Production server exited: ${code}: ${output}`)); });
    child.stdout.on('data', data => {
      output += data.toString();
      const match = output.match(/listening on port (\d+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
    child.stderr.on('data', data => { output += data.toString(); });
  });
  const base = `http://127.0.0.1:${port}`;
  const response = await fetch(`${base}${path}`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('x-robots-tag'), /noindex/);
  assert.match(await response.text(), /Does Santa have your child/);
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || (existsSync('/repl/tools/bin/chromium') ? '/repl/tools/bin/chromium' : undefined),
    args: ['--no-sandbox'],
  });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /hydrat|React error/i.test(message.text())) errors.push(message.text()); });
  await page.route('**/api/santa-names?*', route => route.fulfill({ json: {
    records: [{ id: 'arabella', name: 'Arabella' }], hostedCount: 1, warning: null,
  } }));
  await page.route(/sibforms\.com|youtube\.com|googlevideo\.com|global\.citrus3\.com/, route => route.abort());
  await page.goto(`${base}${path}`);
  await page.getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
  const input = page.getByRole('combobox', { name: 'Child’s first name' });
  await input.fill('Arab');
  await page.getByRole('option', { name: 'Arabella', exact: true }).click();
  assert.equal(await input.inputValue(), 'Arabella');
  assert.match(await page.locator('.hero-name-checker [role="status"]').textContent(), /Yes! Santa can record for Arabella/);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(errors, []);
});
