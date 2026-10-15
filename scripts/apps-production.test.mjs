import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

// Run after npm run build; exercise the actual Node production server, not Vite.
test('built Apps HTML starts on Christmas Radio image 1 and serves all four WebP assets', async t => {
  const child = spawn(process.execPath, ['index.js', '--port=0'], { stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => child.kill('SIGTERM'));
  const port = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Production server did not start')), 10000);
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Production server exited: ${code}`)); });
    child.stdout.on('data', data => {
      const match = data.toString().match(/listening on port (\d+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
    child.stderr.on('data', data => console.error(data.toString()));
  });
  const get = path => fetch(`http://127.0.0.1:${port}${path}`);
  const response = await get('/apps');
  assert.equal(response.status, 200);
  const html = await response.text();
  const section = html.match(/<section id="christmasradio"[\s\S]*?<\/section>/)?.[0];
  assert.ok(section, 'Christmas Radio must be in the initial HTML');
  assert.match(section, /aria-label="Christmas Radio promotional images"/);
  const images = [...section.matchAll(/<img\b[^>]*>/g)].map(match => match[0]);
  assert.equal(images.length, 4);
  for (const [index, image] of images.entries()) {
    const src = image.match(/src="([^"]+)"/)?.[1];
    assert.match(src, new RegExp(`^/assets/christmas-radio-promo-${index + 1}-.*\\.webp$`));
    assert.match(image, /width="851" height="1849"/);
    assert.match(image, /alt="Christmas Radio promotional image:/);
    assert.equal(image.includes(' is-active'), index === 0);
    assert.match(image, new RegExp(`aria-hidden="${index !== 0}"`));
    const asset = await get(src);
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('content-type'), /image\/webp/);
    const bytes = Buffer.from(await asset.arrayBuffer());
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    assert.ok(bytes.length < 400000);
  }
  assert.match(section.replace(/<!--.*?-->/g, ''), /From the makers of Santa Radio · 1 of 4/);
  assert.match(section, /not interactive website controls/);
  assert.match(html, /Santa Radio current iOS app screenshots/);
  assert.match(html, /Santa Radio Apple Watch promotional images/);
  assert.match(html, /Available FREE on Apple TV/);
  assert.match(html, /Santa Radio for Mac/);
  for (const [id, filename] of [['santatext', 'santa-text'], ['santavoicemail', 'santa-voicemail']]) {
    const app = html.match(new RegExp(`<section id="${id}"[\\s\\S]*?<\\/section>`))?.[0];
    assert.ok(app, `${id} must be in the initial HTML`);
    const image = app.match(/<img\b[^>]*>/)?.[0];
    assert.ok(image);
    assert.match(image, /width="851" height="1849"/);
    assert.match(image, /promotional artwork/);
    const src = image.match(/src="([^"]+)"/)?.[1];
    assert.match(src, new RegExp(`^/assets/${filename}-promo-.*\\.webp$`));
    const asset = await get(src);
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('content-type'), /image\/webp/);
    const bytes = Buffer.from(await asset.arrayBuffer());
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    assert.ok(bytes.length < 500000);
  }
});
