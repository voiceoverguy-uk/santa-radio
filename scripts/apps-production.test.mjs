import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { appDownloads, obsoleteStoreCopy } from '../tests/fixtures/apps-downloads.js';

// Run after npm run build; exercise the actual Node production server, not Vite.
test('built Apps HTML starts on first promotional images and serves all local WebP assets', async t => {
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
  const visibleHtml = html.replace(/<!--[\s\S]*?-->/g, '');
  assert.doesNotMatch(visibleHtml, /app-store-card|app-store-details/);
  assert.doesNotMatch(visibleHtml, obsoleteStoreCopy);
  assert.match(visibleHtml, /Check the linked stores for current pricing/);
  assert.match(visibleHtml, /<title[^>]*>Christmas Apps — App Store Downloads \| Santa Radio<\/title>/);
  assert.match(visibleHtml, /App Store and Amazon Appstore download links and device showcases/);
  assert.match(visibleHtml, /its Appstore continues on Fire devices/);
  assert.match(visibleHtml, /Other app screenshots and catalogue feature descriptions are from the legacy catalogue/);
  assert.equal((html.match(/class="app-section"/g) || []).length, 6);
  for (const app of appDownloads) {
    const appHtml = visibleHtml.match(new RegExp(`<section id="${app.id}"[\\s\\S]*?<\\/section>`))?.[0];
    assert.ok(appHtml, `${app.title} must remain in initial HTML`);
    assert.ok(appHtml.includes(app.title));
    assert.equal((appHtml.match(/class="feature-item"/g) || []).length, 6);
    const links = [...appHtml.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)].map(match => match[0]);
    assert.equal(links.length, app.amazon ? 2 : 1);
    for (const [index, [store, href]] of [['the App Store', app.apple], ...(app.amazon ? [['Amazon Appstore', app.amazon]] : [])].entries()) {
      assert.ok(links[index].includes(`href="${href}"`));
      assert.match(links[index], /target="_blank" rel="noopener noreferrer"/);
      assert.ok(links[index].includes(`Download on ${store}</a>`));
    }
  }
  const graph = JSON.parse(html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/)[1]);
  assert.doesNotMatch(JSON.stringify(graph), /aggregateRating|SoftwareApplication|MobileApplication|"offers"/);
  assert.match(visibleHtml, /Find Santa Radio in the App Store on your Apple TV/);
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
  const dash = html.match(/<section id="santadash"[\s\S]*?<\/section>/)?.[0];
  assert.ok(dash, 'Santa Dash must be in the initial HTML');
  assert.match(dash, /aria-label="Santa Dash promotional artwork"/);
  assert.match(dash, /--app-screenshots-max-width:760px/);
  assert.match(dash, /not live gameplay or interactive website controls/);
  assert.match(visibleHtml, /Santa Dash’s three owner-supplied promotional artworks are not live gameplay/);
  const dashImages = [...dash.matchAll(/<img\b[^>]*>/g)].map(match => match[0]);
  assert.equal(dashImages.length, 3);
  for (const [index, image] of dashImages.entries()) {
    const src = image.match(/src="([^"]+)"/)?.[1];
    assert.match(src, new RegExp(`^/assets/santa-dash-promo-${index + 1}-.*\\.webp$`));
    assert.match(image, /width="1672" height="941"/);
    assert.match(image, /alt="Santa Dash promotional artwork:/);
    assert.equal(image.includes(' is-active'), index === 0);
    assert.match(image, new RegExp(`aria-hidden="${index !== 0}"`));
    const asset = await get(src);
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('content-type'), /image\/webp/);
    const bytes = Buffer.from(await asset.arrayBuffer());
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    assert.ok(bytes.length < 400000);
  }
  assert.match(dash.replace(/<!--.*?-->/g, ''), /A festive rooftop adventure · 1 of 3/);
  const mac = html.match(/<section id="santa-radio-mac"[\s\S]*?<\/section>/)?.[0];
  assert.ok(mac, 'Mac promotional artwork must be in the initial HTML');
  assert.match(mac, /Play Santa Radio and see the current song and artist\./);
  assert.match(mac, /role="status">Coming soon/);
  assert.doesNotMatch(mac, /<a\b|<button\b/);
  assert.match(mac, /<figcaption>Santa Radio for Mac promotional artwork<\/figcaption>/);
  const macImage = mac.match(/<img\b[^>]*>/)?.[0];
  assert.ok(macImage);
  assert.match(macImage, /width="941" height="1672"/);
  assert.match(macImage, /alt="Santa Radio for Mac promotional artwork: Festive music for your desktop,/);
  assert.match(macImage, /icons for live Christmas music, snow effect, Xmas lights and playback controls\./);
  const macSrc = macImage.match(/src="([^"]+)"/)?.[1];
  assert.match(macSrc, /^\/assets\/santa-radio-mac-.*\.webp$/);
  const macAsset = await get(macSrc);
  assert.equal(macAsset.status, 200);
  assert.match(macAsset.headers.get('content-type'), /image\/webp/);
  const macBytes = Buffer.from(await macAsset.arrayBuffer());
  assert.equal(macBytes.toString('ascii', 8, 12), 'WEBP');
  assert.ok(macBytes.length < 250000, 'Mac artwork must stay within its existing 250 kB budget');
  assert.match(visibleHtml, /Santa Text, Santa Voicemail and Santa Messages also use owner-supplied promotional artwork/);
  assert.match(visibleHtml, /not interactive website controls/);
  for (const [id, filename, width, height] of [
    ['santatext', 'santa-text', 851, 1849],
    ['santavoicemail', 'santa-voicemail', 851, 1849],
    ['santamessages', 'santa-messages', 941, 1672],
  ]) {
    const app = html.match(new RegExp(`<section id="${id}"[\\s\\S]*?<\\/section>`))?.[0];
    assert.ok(app, `${id} must be in the initial HTML`);
    const image = app.match(/<img\b[^>]*>/)?.[0];
    assert.ok(image);
    assert.match(image, new RegExp(`width="${width}" height="${height}"`));
    assert.match(image, /promotional artwork/);
    if (id === 'santamessages') {
      assert.match(image, /Santa beside a phone showing Arabella.*Pick a name, Hear Santa and Schedule a message/);
      assert.match(app, /Santa has a personal message just for your child\./);
      assert.doesNotMatch(app, /<button\b|app-screenshots/);
    }
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
