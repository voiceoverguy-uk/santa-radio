import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
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
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || (existsSync('/repl/tools/bin/chromium') ? '/repl/tools/bin/chromium' : undefined),
    args: ['--no-sandbox'],
  });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/apps`);
  // Exercise the actual built URLs and decode response bytes in a browser,
  // including PNG recovery assets which are not visible in the SSR markup.
  const assets = (await readdir('dist/assets')).filter(name =>
    /^(?:christmas-radio-screen-[1-4]|santa-text-screen-(?:welcome|menu|promotion|chat)|santa-radio-ios-(?:radio|tracker|mugshots|artists|games|welcome)|santa-dash-screen)-.*\.(?:webp|png)$/.test(name));
  assert.equal(assets.length, 30);
  const decodedPixels = new Map();
  for (const name of assets) {
    const asset = await get(`/assets/${name}`);
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('content-type'), /image\/(webp|png)/);
    const bytes = Buffer.from(await asset.arrayBuffer()).toString('base64');
    const decoded = await page.evaluate(async ({ bytes, type }) => {
      const image = new Image();
      image.src = `data:${type};base64,${bytes}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const hash = await crypto.subtle.digest('SHA-256', pixels);
      return { dimensions: [image.naturalWidth, image.naturalHeight], hash: Array.from(new Uint8Array(hash)).join(',') };
    }, { bytes, type: asset.headers.get('content-type') });
    const expected = name.startsWith('christmas') ? [520, 1130] :
      /^(?:santa-text|santa-radio-ios)/.test(name) ? [603, 1311] : [1488, 676];
    assert.deepEqual(decoded.dimensions, expected, name);
    const key = name.replace(/-[^-]+\.(?:webp|png)$/, '');
    if (decodedPixels.has(key)) assert.equal(decoded.hash, decodedPixels.get(key), `${key} fallback must preserve every decoded pixel`);
    else decodedPixels.set(key, decoded.hash);
  }
  const response = await get('/apps');
  assert.equal(response.status, 200);
  const html = await response.text();
  const visibleHtml = html.replace(/<!--[\s\S]*?-->/g, '');
  // Production CSS must retain the plain green treatment, including on phones.
  const stylesheetUrls = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(match => match[1]);
  assert.ok(stylesheetUrls.length > 0);
  const css = (await Promise.all(stylesheetUrls.map(async url => {
    const response = await get(url);
    assert.equal(response.status, 200);
    return response.text();
  }))).join('\n');
  assert.doesNotMatch(css, /christmas-room-(wide|mobile)/);
  assert.match(css, /--apps-forest:\s*#092419/);
  for (const selector of ['app-section', 'apple-watch-showcase', 'apple-tv-showcase', 'mac-app-showcase']) {
    assert.match(css, new RegExp(`\\.apps-page \\.${selector}[^{}]*\\{[^{}]*background:\\s*var\\(--apps-forest\\)`));
  }
  assert.doesNotMatch(visibleHtml, /app-store-card|app-store-details/);
  assert.doesNotMatch(visibleHtml, obsoleteStoreCopy);
  assert.match(visibleHtml, /Check the linked stores for current pricing/);
  assert.match(visibleHtml, /<title[^>]*>Christmas Apps — App Store Downloads \| Santa Radio<\/title>/);
  assert.match(visibleHtml, /App Store and Amazon Appstore download links and device showcases/);
  assert.doesNotMatch(visibleHtml, /app-store-notice|seo-breadcrumbs|aria-label="Breadcrumb"/);
  assert.doesNotMatch(visibleHtml, /Amazon has ended Appstore support|Santa Radio’s catalogue screenshots show/);
  assert.doesNotMatch(visibleHtml, /Other app screenshots and catalogue feature descriptions are from the legacy catalogue/);
  assert.match(visibleHtml, /<link[^>]*rel="canonical"[^>]*href="https:\/\/www\.santaradio\.co\.uk\/apps"/);
  const navigation = visibleHtml.match(/<nav\b[^>]*aria-label="Main navigation"[\s\S]*?<\/nav>/)?.[0];
  assert.ok(navigation);
  assert.match(navigation, /href="\/"[^>]*>Home<\/a>/);
  assert.match(navigation, /href="\/apps"[^>]*>Apps<\/a>/);
  assert.equal((html.match(/class="app-section"/g) || []).length, 6);
  for (const app of appDownloads) {
    const appHtml = visibleHtml.match(new RegExp(`<section id="${app.id}"[\\s\\S]*?<\\/section>`))?.[0];
    assert.ok(appHtml, `${app.title} must remain in initial HTML`);
    assert.ok(appHtml.includes(app.title));
    assert.equal((appHtml.match(/class="feature-item"/g) || []).length, 6);
    assert.ok(appHtml.indexOf('class="app-download-btns"') > appHtml.indexOf('class="app-layout'), `${app.title} downloads must follow its artwork and features`);
    const links = [...appHtml.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)].map(match => match[0]);
    assert.equal(links.length, app.amazon ? 2 : 1);
    for (const [index, [store, href]] of [['the App Store', app.apple], ...(app.amazon ? [['Amazon Appstore', app.amazon]] : [])].entries()) {
      assert.ok(links[index].includes(`href="${href}"`));
      assert.match(links[index], /target="_blank" rel="noopener noreferrer"/);
      assert.ok(links[index].includes(`Download on ${store}</a>`));
    }
  }
  const graph = JSON.parse(html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/)[1]);
  const breadcrumbs = graph['@graph'].find(node => node['@type'] === 'BreadcrumbList');
  assert.deepEqual(breadcrumbs.itemListElement, [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.santaradio.co.uk/' },
    { '@type': 'ListItem', position: 2, name: 'Apps', item: 'https://www.santaradio.co.uk/apps' },
  ]);
  const appList = graph['@graph'].find(node => node['@type'] === 'ItemList');
  assert.equal(appList.numberOfItems, 7);
  assert.equal(appList.itemListElement.length, 7);
  assert.doesNotMatch(JSON.stringify(graph), /aggregateRating|SoftwareApplication|MobileApplication|"offers"/);
  assert.match(visibleHtml, /Find Santa Radio in the App Store on your Apple TV/);
  const section = html.match(/<section id="christmasradio"[\s\S]*?<\/section>/)?.[0];
  assert.ok(section, 'Christmas Radio must be in the initial HTML');
  assert.match(section, /aria-label="Christmas Radio promotional images"/);
  const images = [...section.matchAll(/<img\b[^>]*>/g)].map(match => match[0]);
  assert.equal(images.length, 4);
  for (const [index, image] of images.entries()) {
    const src = image.match(/src="([^"]+)"/)?.[1];
    assert.match(src, new RegExp(`^/assets/christmas-radio-screen-${index + 1}-.*\\.webp$`));
    assert.match(image, /width="520" height="1130"/);
    assert.match(image, /alt="Christmas Radio app/);
    assert.equal(image.includes(' is-active'), index === 0);
    assert.match(image, new RegExp(`aria-hidden="${index !== 0}"`));
    const asset = await get(src);
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('content-type'), /image\/webp/);
    const bytes = Buffer.from(await asset.arrayBuffer());
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    assert.ok(bytes.length < 400000);
  }
  assert.match(section, /<figcaption[^>]*>Christmas Radio promotional images<\/figcaption>/);
  assert.doesNotMatch(section, /Owner-supplied Christmas Radio promotional images|not interactive website controls/);
  assert.match(html, /Santa Radio current iOS app screenshots/);
  assert.match(html, /Santa Radio Apple Watch promotional images/);
  assert.match(html, /Available FREE on Apple TV/);
  assert.match(html, /Santa Radio for Mac/);
  const dash = html.match(/<section id="santadash"[\s\S]*?<\/section>/)?.[0];
  assert.ok(dash, 'Santa Dash must be in the initial HTML');
  assert.match(dash, /aria-label="Santa Dash promotional artwork"/);
  assert.match(dash, /app-screenshots-dark-landscape/);
  assert.doesNotMatch(dash, /app-screenshots-classic/);
  assert.match(dash, /--app-screenshots-max-width:760px/);
  assert.doesNotMatch(dash, /Owner-supplied Santa Dash promotional artwork|not live gameplay or interactive website controls/);
  assert.doesNotMatch(visibleHtml, /Santa Dash’s three owner-supplied promotional artworks are not live gameplay/);
  assert.doesNotMatch(visibleHtml, /iOS screenshots only; the Amazon app’s appearance may differ|app-screenshots-note/);
  const dashImages = [...dash.matchAll(/<img\b[^>]*>/g)].map(match => match[0]);
  assert.equal(dashImages.length, 1);
  for (const [index, image] of dashImages.entries()) {
    const src = image.match(/src="([^"]+)"/)?.[1];
    assert.match(src, /^\/assets\/santa-dash-screen-.*\.webp$/);
    assert.match(image, /width="1488" height="676"/);
    assert.match(image, /alt="Santa Dash — Back to the Grotto promotional artwork/);
    assert.equal(image.includes(' is-active'), index === 0);
    assert.match(image, new RegExp(`aria-hidden="${index !== 0}"`));
    const asset = await get(src);
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('content-type'), /image\/webp/);
    const bytes = Buffer.from(await asset.arrayBuffer());
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    assert.ok(bytes.length < 400000);
  }
  assert.match(dash, /<figcaption[^>]*>Santa Dash promotional artwork<\/figcaption>/);
  const mac = html.match(/<section id="santa-radio-mac"[\s\S]*?<\/section>/)?.[0];
  assert.ok(mac, 'Mac promotional artwork must be in the initial HTML');
  assert.match(mac, /Play Santa Radio and see the current song and artist\./);
  assert.match(mac, /<h2[^>]*>Santa Radio for Mac<\/h2>/);
  assert.doesNotMatch(mac, /Coming soon|mac-app-status|role="status"/i);
  assert.doesNotMatch(mac, /<button\b/);
  assert.match(mac, /href="https:\/\/apps\.apple\.com\/gb\/app\/santa-radio\/id1025312198\?mt=12"/);
  assert.match(mac, /src="\/images\/download-on-the-app-store\.svg"/);
  assert.match(mac, /<figcaption>Santa Radio for Mac promotional artwork<\/figcaption>/);
  const macImage = mac.match(/<figure\b[^>]*>\s*(<img\b[^>]*>)/)?.[1];
  assert.ok(macImage);
   assert.match(macImage, /width="1672" height="941"/);
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
   await page.getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
   const macSection = page.locator('#santa-radio-mac');
   const builtMacImage = macSection.locator('figure img');
   const storeBadge = macSection.locator('a img');
   await storeBadge.evaluate(image => image.decode());
   assert.ok(await storeBadge.evaluate(image => image.naturalWidth > 0));
   for (const width of [1440, 1024, 768, 767, 390, 320]) {
     await page.setViewportSize({ width, height: 1000 });
     await builtMacImage.evaluate(image => image.scrollIntoView({ block: 'center', behavior: 'instant' }));
     await builtMacImage.evaluate(image => image.decode());
     const geometry = await macSection.evaluate(section => {
       const image = section.querySelector('figure img');
       const bounds = image.getBoundingClientRect();
       const figure = section.querySelector('figure').getBoundingClientRect();
       const copy = section.querySelector('.mac-app-copy').getBoundingClientRect();
       const container = section.querySelector('.mac-app-inner').getBoundingClientRect();
       const dock = document.querySelector('.radio-dock').getBoundingClientRect();
       return {
         intrinsic: [image.naturalWidth, image.naturalHeight],
         ratio: bounds.width / bounds.height,
         fit: getComputedStyle(image).objectFit,
         imageInFigure: bounds.top >= figure.top && bounds.bottom <= figure.bottom,
         inViewport: bounds.left >= 0 && bounds.right <= innerWidth && bounds.top >= 85 && bounds.bottom <= dock.top,
         figureWidth: figure.width, copyWidth: copy.width, containerWidth: container.width,
         overflow: document.documentElement.scrollWidth > innerWidth,
       };
     });
     assert.deepEqual(geometry.intrinsic, [1672, 941]);
     assert.ok(Math.abs(geometry.ratio - 1672 / 941) < .001);
     assert.equal(geometry.fit, 'contain');
     assert.ok(geometry.imageInFigure && geometry.inViewport);
     assert.equal(geometry.overflow, false);
     if (width >= 768) assert.ok(geometry.figureWidth > geometry.copyWidth * 1.5);
     else assert.ok(Math.abs(geometry.figureWidth - geometry.containerWidth) < 1);
     assert.equal(await macSection.locator('button, .mac-app-status, [role="status"]').count(), 0);
     assert.equal(await macSection.locator('a').count(), 1);
     assert.equal(await macSection.locator('a').getAttribute('href'), 'https://apps.apple.com/gb/app/santa-radio/id1025312198?mt=12');
   }
  assert.doesNotMatch(visibleHtml, /Santa Text, Santa Voicemail and Santa Messages also use owner-supplied promotional artwork/);
  assert.doesNotMatch(visibleHtml, /not interactive website controls|iOS screenshots only; the Amazon app’s appearance may differ/);
  const text = html.match(/<section id="santatext"[\s\S]*?<\/section>/)?.[0];
  assert.ok(text, 'Santa Text must be in the initial HTML');
  assert.match(text, /aria-label="Santa Text app screenshots"/);
  assert.doesNotMatch(text, /app-screenshots-classic/);
  const textImages = [...text.matchAll(/<img\b[^>]*>/g)].map(match => match[0]);
  assert.equal(textImages.length, 4);
  for (const [index, label] of ['welcome', 'menu', 'promotion', 'chat'].entries()) {
    assert.match(textImages[index], new RegExp(`src="/assets/santa-text-screen-${label}-.*\\.webp"`));
    assert.match(textImages[index], /width="603" height="1311"/);
    assert.match(textImages[index], /alt="Santa Text app/);
    assert.equal(textImages[index].includes(' is-active'), index === 0);
    assert.match(textImages[index], new RegExp(`aria-hidden="${index !== 0}"`));
  }
  const textPhone = page.locator('#santatext .app-screenshots');
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await textPhone.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    for (const image of await textPhone.locator('img').all()) {
      await image.evaluate(image => image.decode());
      const geometry = await image.evaluate(el => {
        const bounds = el.getBoundingClientRect();
        const stack = el.closest('.app-screenshots-stack').getBoundingClientRect();
        return {
          ratio: bounds.width / bounds.height,
          full: Math.abs(bounds.width - stack.width) < .5 && Math.abs(bounds.height - stack.height) < .5,
          fit: getComputedStyle(el).objectFit,
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      assert.ok(Math.abs(geometry.ratio - 603 / 1311) < .001);
      assert.ok(geometry.full);
      assert.equal(geometry.fit, 'contain');
      assert.equal(geometry.overflow, false);
    }
  }
  for (const [id, filename, width, height] of [
    ['santavoicemail', 'santa-voicemail', 750, 1334],
    ['santamessages', 'santa-messages', 750, 1334],
  ]) {
    const app = html.match(new RegExp(`<section id="${id}"[\\s\\S]*?<\\/section>`))?.[0];
    assert.ok(app, `${id} must be in the initial HTML`);
    const image = app.match(/<img\b[^>]*>/)?.[0];
    assert.ok(image);
    assert.match(image, new RegExp(`width="${width}" height="${height}"`));
    assert.match(image, /app screen/);
    assert.match(app, /app-screenshots-device/);
    if (id === 'santamessages') {
      assert.match(image, /Arabella.*playback and sharing controls.*name picker.*Schedule a message/);
      assert.match(app, /Santa has a personal message just for your child\./);
      assert.doesNotMatch(app, /<button\b/);
    }
    const src = image.match(/src="([^"]+)"/)?.[1];
    assert.match(src, new RegExp(`^/assets/${filename}-screen-.*\\.webp$`));
    const asset = await get(src);
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('content-type'), /image\/webp/);
    const bytes = Buffer.from(await asset.arrayBuffer());
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    assert.ok(bytes.length < 500000);
  }
});
