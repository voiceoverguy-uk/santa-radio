import assert from 'node:assert/strict';
import { absolute, mugPath, mugPhotoLicense, mugPhotoTermsPath } from '../src/seo/catalogue.js';

export const readGraph = html => [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
  .flatMap(match => JSON.parse(match[1])['@graph']);

export function assertMugPhotoGraph(graph, mug) {
  const url = absolute(mugPath(mug));
  const photos = graph.filter(node => node['@type'] === 'ImageObject' && node.contentUrl === absolute(mug.image));
  assert.equal(photos.length, 2, `${mug.song}: both photograph representations`);
  assert.deepEqual(new Set(photos.map(node => node['@id'])), new Set([`${url}#image`, `${url}#photograph`]));
  for (const photo of photos) {
    assert.equal(photo.license, mugPhotoLicense, photo['@id']);
    assert.equal(photo.copyrightHolder, undefined, 'no invented ownership attribution');
    assert.equal(photo.acquireLicensePage, undefined);
  }
  const photo = photos.find(node => node['@id'] === `${url}#photograph`);
  assert.equal(photo.creditText, mug.credit ? `Photo credit: ${mug.credit}` : undefined, mug.song);
  const page = graph.find(node => node['@type'] === 'WebPage');
  assert.equal(page.primaryImageOfPage['@id'], `${url}#image`);
  assert.equal(page.mainEntity['@id'], `${url}#photograph`);
  assert.ok(graph.filter(node => node['@type'] === 'ImageObject' && !photos.includes(node)).every(node => !node.license),
    'unrelated logo must not inherit photograph terms');
}

export function assertMugPhotoHtml(html, mug) {
  assertMugPhotoGraph(readGraph(html), mug);
  assert.ok(html.includes(`href="${mugPhotoTermsPath}"`), `${mug.song}: visible terms link`);
  assert.match(html, /<figcaption[^>]*>[\s\S]*?Photo usage and licensing[\s\S]*?<\/figcaption>/);
}
