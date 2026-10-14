import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { homeMetadata, appsMetadata, appsBreadcrumbs, messageMetadata, messageBreadcrumbs, pageMetadata, shareImage, shareImageAlt, brandImage, trackerMetadata, ORIGIN } from '../src/seo/catalogue.js';
import { appStoreVerification, storeCheckedAt, storeCheckedLabel, amazonDeviceSource } from '../src/pages/apps-store-verification.js';

const readGraphs = html => [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
  .flatMap(match => JSON.parse(match[1])['@graph']);
const headValue = (html, name) => html.match(new RegExp(`<meta[^>]*(?:name|property)="${name}"[^>]*content="([^"]+)"`))?.[1];
const decode = value => value?.replace(/&amp;/g, '&').replace(/&#x27;/g, "'");

test('generic links advertise one opaque, full-size green share card in initial HTML', async () => {
  assert.equal(shareImage, '/images/santa-radio-share-green-v2.jpg', 'use a new URL rather than cached old artwork');
  const bytes = await readFile(`public${shareImage}`);
  assert.equal(bytes.readUInt16BE(0), 0xffd8, 'the share image is a JPEG');
  assert.ok(bytes.length < 250000, 'link-preview image remains lightweight');
  let dimensions;
  for (let offset = 2; offset < bytes.length;) {
    assert.equal(bytes[offset], 0xff);
    const marker = bytes[offset + 1];
    offset += 2;
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      dimensions = [bytes.readUInt16BE(offset + 5), bytes.readUInt16BE(offset + 3)];
      break;
    }
    if ([0xda, 0xd9].includes(marker)) break;
    offset += bytes.readUInt16BE(offset);
  }
  assert.deepEqual(dimensions, [1200, 630]);
  for (const path of ['', '/apps', '/free-santa-message', '/privacy-policy', '/christmas-music', '/mugshots/all']) {
    const html = await readFile(`dist${path}/index.html`, 'utf8');
    const head = html.split('</head>')[0];
    for (const name of ['og:image', 'twitter:image']) assert.equal(headValue(head, name), ORIGIN + shareImage);
    assert.equal((head.match(/property="og:image"/g) || []).length, 1);
    assert.equal((head.match(/name="twitter:image"/g) || []).length, 1);
    assert.equal(headValue(head, 'og:image:width'), '1200');
    assert.equal(headValue(head, 'og:image:height'), '630');
    assert.equal(headValue(head, 'og:image:type'), 'image/jpeg');
    assert.equal(headValue(head, 'og:image:alt'), shareImageAlt);
     assert.equal(headValue(head, 'twitter:image:alt'), shareImageAlt);
     assert.ok(!head.includes('/images/santa-radio-share-green.jpg'));
    assert.ok(!head.includes('/assets/img/santa-radio-logo.jpg'));
    const primary = readGraphs(html).find(node => node['@type'] === 'ImageObject');
    assert.equal(primary.contentUrl, ORIGIN + shareImage);
    assert.equal(primary.width, 1200);
    assert.equal(primary.height, 630);
  }
});

test('fallback document tags match the refreshed generic sharing metadata', async () => {
  const html = await readFile('index.html', 'utf8');
  for (const name of ['og:image', 'twitter:image']) assert.equal(headValue(html, name), ORIGIN + shareImage);
  for (const name of ['og:image:alt', 'twitter:image:alt']) assert.equal(headValue(html, name), shareImageAlt);
  assert.equal(headValue(html, 'og:image:width'), '1200');
  assert.equal(headValue(html, 'og:image:height'), '630');
  assert.equal(headValue(html, 'og:image:type'), 'image/jpeg');
});

test('sharing artwork is separate from the organisation logo and page-specific pictures', () => {
  assert.equal(homeMetadata().graph.find(node => node['@type'] === 'Organization').logo.url, ORIGIN + brandImage);
  const custom = pageMetadata({ path: '/test', title: 'Test', description: 'Test', image: '/portrait.webp', imageAlt: 'Artist portrait' });
  assert.equal(custom.image, ORIGIN + '/portrait.webp');
  assert.equal(custom.imageAlt, 'Artist portrait');
  assert.equal(custom.imageWidth, undefined);
  assert.equal(custom.imageType, undefined);
  assert.equal(trackerMetadata().image, ORIGIN + '/images/santa-tracker-share.png');
  assert.equal(trackerMetadata().imageWidth, 1200);
  assert.equal(trackerMetadata().imageType, 'image/png');
});

test('Santa message initial HTML targets audio searches with consistent metadata and breadcrumbs', async () => {
  const html = await readFile('dist/free-santa-message/index.html', 'utf8');
  const m = messageMetadata();
  assert.equal(decode(html.match(/<title[^>]*>(.*?)<\/title>/s)?.[1]), m.title);
  assert.match(m.title, /Santa Message.*MP3 Audio/);
  for (const name of ['description', 'og:description', 'twitter:description'])
    assert.equal(decode(headValue(html, name)), m.description);
  for (const name of ['og:title', 'twitter:title'])
    assert.equal(decode(headValue(html, name)), m.title);
  assert.match(html, /Create a free message from Santa/);
  assert.ok(html.includes('personalised Santa audio greeting'));
  assert.ok(html.includes(`rel="canonical" href="${ORIGIN}/free-santa-message"`));
  const graphs = readGraphs(html);
  assert.equal(graphs.filter(node => node['@type'] === 'WebPage').length, 1);
  assert.equal(graphs.find(node => node['@type'] === 'WebPage').description, m.description);
  assert.deepEqual(graphs.find(node => node['@type'] === 'BreadcrumbList').itemListElement.map(item => [item.name, item.item]),
    messageBreadcrumbs.map(([name, path]) => [name, ORIGIN + path]));
  assert.ok(!JSON.stringify(graphs).match(/SoftwareApplication|aggregateRating|AudioObject|VideoObject/));
});

test('homepage uses consistent search targeting in initial content, metadata and schema', async () => {
  const html = await readFile('dist/index.html', 'utf8');
  const m = homeMetadata();
  assert.match(m.title, /Christmas Radio.*Online Christmas Music/);
  assert.equal(decode(html.match(/<title[^>]*>(.*?)<\/title>/s)?.[1]), m.title);
  for (const name of ['description', 'og:description', 'twitter:description']) {
    assert.equal(decode(headValue(html, name)), m.description);
  }
  for (const name of ['og:title', 'twitter:title']) assert.equal(decode(headValue(html, name)), m.title);
  assert.ok(!html.includes('UK\\u2019s'), 'literal escaped apostrophe must not return');
  assert.ok(m.description.includes('UK’s'));
  assert.match(html, /<p class="hero-description">Enjoy online Christmas music 24\/7.*Christmas radio station/);
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  const graphs = readGraphs(html);
  assert.equal(graphs.filter(node => node['@type'] === 'WebPage').length, 1);
  assert.equal(graphs.find(node => node['@type'] === 'WebPage').description, m.description);
  assert.ok(html.includes(`rel="canonical" href="${ORIGIN}/"`));
});

test('Apps schema matches the visible catalogue, breadcrumbs and real screenshots', async () => {
  const html = await readFile('dist/apps/index.html', 'utf8');
  const graphs = readGraphs(html);
  const list = graphs.find(node => node['@type'] === 'ItemList');
  const sections = [...html.matchAll(/<section id="([^"]+)" class="app-section"/g)].map(match => match[1]);
  assert.equal(list.numberOfItems, 6);
  assert.equal(list.numberOfItems, sections.length);
  assert.deepEqual(list.itemListElement.map(item => new URL(item.url).hash.slice(1)), sections);
  for (const [index, item] of list.itemListElement.entries()) {
    assert.equal(item.position, index + 1);
    assert.ok(html.includes(`>${item.name}</h2>`));
    assert.ok(html.includes(`src="${new URL(item.image).pathname}"`));
  }
  const crumbs = graphs.find(node => node['@type'] === 'BreadcrumbList').itemListElement;
  assert.deepEqual(crumbs.map(item => item.position), [1, 2]);
  assert.ok(crumbs.every(item => item['@type'] === 'ListItem'));
  assert.deepEqual(crumbs.map(item => [item.name, item.item]), appsBreadcrumbs.map(([name, path]) => [name, `${ORIGIN}${path}`]));
  assert.ok(html.includes('aria-label="Breadcrumb"'));
  assert.ok(html.includes('aria-current="page">Apps</span>'));
  assert.equal(graphs.filter(node => node['@type'] === 'CollectionPage').length, 1);
  assert.ok(!JSON.stringify(graphs).match(/aggregateRating|SoftwareApplication|MobileApplication|InStock|Sleeps til Santa/i));
});

test('generated Apps HTML visibly attributes every store snapshot without importing ratings into schema', async () => {
  // React SSR inserts hydration separators between text nodes; these are not
  // visible content and must not affect checks of what readers actually see.
  const html = (await readFile('dist/apps/index.html', 'utf8')).replace(/<!--[\s\S]*?-->/g, '');
  assert.match(html, /<h1[^>]*>Christmas Apps<\/h1>/);
  assert.ok(!html.includes('Free Christmas Apps'));
  assert.ok(!html.includes('100% FREE'));
  assert.ok(html.includes(`href="${amazonDeviceSource}"`));
  assert.ok(html.includes('installation and playback on your device have not been tested'));
  assert.ok(html.includes('not reviews collected by Santa Radio'));
  assert.ok(html.includes('Screenshots and feature descriptions are from the legacy catalogue'));
  assert.equal(Object.values(appStoreVerification).flat().length, 10);
  for (const [id, stores] of Object.entries(appStoreVerification)) {
    const section = html.match(new RegExp(`<section id="${id}"[\\s\\S]*?<\\/section>`))?.[0];
    assert.ok(section, `missing section ${id}`);
    for (const store of stores) {
      assert.ok(section.includes(`href="${store.source}"`), `${id} source not visible`);
      assert.ok(section.includes(`>${store.name}</strong>`), `${id} store identity not visible`);
      assert.ok(section.includes(`Developer: ${store.developer}`));
      assert.ok(section.includes(`>${store.price}</strong>`));
      assert.ok(section.includes(`>${store.rating} out of 5</strong>`));
      assert.ok(section.includes(`${store.ratingCount} ratings`));
      assert.ok(section.includes(`(${store.region})</a>`));
      assert.ok(section.includes(`<time dateTime="${storeCheckedAt}">${storeCheckedLabel}</time>`));
      if (store.minimumIOS) assert.ok(section.includes(`Requires iOS ${store.minimumIOS} or later`));
      if (store.inAppPurchases) assert.ok(section.includes('In-app purchases'));
    }
  }
  const originalDestinations = [
    'https://apps.apple.com/us/app/santa-radio/id1021183593',
    'https://www.amazon.com/App-Style-Ltd-Santa-Radio/dp/B0158MYRBM',
    'https://itunes.apple.com/us/app/santa-voicemail/id586387813',
    'http://www.amazon.com/App-Style-Ltd-Santa-Voicemail/dp/B00QFP4B18',
    'https://itunes.apple.com/gb/app/santa-messages/id1062532143',
    'http://www.amazon.co.uk/Santa-Messages-Free-Festive-Fun/dp/B019MRFDDK',
    'https://itunes.apple.com/gb/app/christmas-radio-uk/id1157967613',
    'https://www.amazon.co.uk/VoiceoverGuy-Ltd-Christmas-Radio/dp/B01M18XUXV',
    'https://itunes.apple.com/gb/app/santa-text/id1024535991',
    'https://itunes.apple.com/gb/app/santa-dash-from-santa-guy/id1057048397',
  ];
  for (const href of originalDestinations) assert.ok(html.includes(`href="${href}"`), `legacy destination changed: ${href}`);
  // The shared WebSite/WebPage publisher is legitimate; only app-specific
  // offers/ratings are excluded, not the site's existing identity graph.
  assert.ok(!JSON.stringify(readGraphs(html)).match(/aggregateRating|SoftwareApplication|MobileApplication|"offers"/));
});

test('store snapshots do not turn verified or unverified apps into ineligible rich-result candidates', () => {
  const entries = [
    { id: 'santaradio', title: 'Santa Radio', alt: 'Radio', image: '/radio.jpg', store: appStoreVerification.santaradio },
    { id: 'unverified', title: 'Unverified', alt: 'Unknown', image: '/unknown.jpg' },
  ];
  const graph = appsMetadata(entries).graph;
  assert.equal(graph.find(node => node['@type'] === 'ItemList').numberOfItems, 2);
  assert.ok(!JSON.stringify(graph).match(/aggregateRating|SoftwareApplication|MobileApplication|"offers"/));
});

test('app catalogue markup follows supplied entries instead of a separate hardcoded list', () => {
  const one = { id: 'example', title: 'Example', subtitle: 'An example app', image: '/images/example.png' };
  const metadata = appsMetadata([one]);
  const list = metadata.graph.find(node => node['@type'] === 'ItemList');
  assert.equal(list.numberOfItems, 1);
  assert.equal(list.itemListElement[0].url, `${ORIGIN}/apps#example`);
  assert.equal(list.itemListElement[0].image, `${ORIGIN}/images/example.png`);
  assert.equal(list.itemListElement[0].description, one.subtitle);
});
