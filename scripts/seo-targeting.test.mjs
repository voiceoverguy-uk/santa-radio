import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { homeMetadata, appsMetadata, appsBreadcrumbs, messageMetadata, messageBreadcrumbs, ORIGIN } from '../src/seo/catalogue.js';

const readGraphs = html => [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
  .flatMap(match => JSON.parse(match[1])['@graph']);
const headValue = (html, name) => html.match(new RegExp(`<meta[^>]*(?:name|property)="${name}"[^>]*content="([^"]+)"`))?.[1];
const decode = value => value?.replace(/&amp;/g, '&').replace(/&#x27;/g, "'");

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
  assert.deepEqual(crumbs.map(item => [item.name, item.item]), appsBreadcrumbs.map(([name, path]) => [name, `${ORIGIN}${path}`]));
  assert.ok(html.includes('aria-label="Breadcrumb"'));
  assert.ok(html.includes('aria-current="page">Apps</span>'));
  assert.equal(graphs.filter(node => node['@type'] === 'CollectionPage').length, 1);
  assert.ok(!JSON.stringify(graphs).match(/aggregateRating|SoftwareApplication|MobileApplication|InStock|Sleeps til Santa/i));
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
