import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { STUDIO_PATH, STUDIO_ALIASES } from '../src/lib/studioRoute.js';
import { canonicalPaths, resolvePublicRequest } from '../src/seo/routes.js';
import publicPage from '../api/public-page.js';

const query = '?checkout=return&source=email&synthetic=a%2Bb&repeat=1&repeat=2';
const addresses = [STUDIO_PATH, ...STUDIO_ALIASES].flatMap(path => [path, `${path}/`]);
const response = () => ({
  headers: {},
  setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
  status(code) { this.code = code; return this; },
  end(body) { this.body = body; },
});

test('all Studio aliases resolve in one hop with query strings intact', () => {
  for (const path of addresses) {
    const result = resolvePublicRequest(path + query);
    assert.deepEqual(result, path === STUDIO_PATH ? { status: 200, noindex: true }
      : { status: 308, location: STUDIO_PATH + query });
    assert.ok(!canonicalPaths.includes(path));
  }
});

test('Vercel document routing covers all Studio addresses before the static filesystem', async () => {
  const config = JSON.parse(await readFile('vercel.json', 'utf8'));
  for (const path of addresses) {
    const rule = config.routes.find(rule => rule.dest && rule.src && new RegExp(`^${rule.src}$`).test(path));
    assert.equal(rule?.dest, '/api/public-page?__sr_route=/$1', path);
  }
});

test('packaged document entry keeps aliases and HEAD private and documents locked', async () => {
  for (const path of addresses) {
    for (const method of ['GET', 'HEAD']) {
      const res = response();
      await publicPage({ method, url: `/api/public-page?__sr_route=${path}&checkout=return&synthetic=a%2Bb` }, res);
      assert.equal(res.headers['cache-control'], 'private, no-store');
      assert.equal(res.headers['cdn-cache-control'], 'no-store');
      assert.equal(res.headers['vercel-cdn-cache-control'], 'no-store');
      assert.equal(res.headers['x-robots-tag'], 'noindex, nofollow');
      assert.equal(res.code, path === STUDIO_PATH ? 200 : 308);
      if (path !== STUDIO_PATH) {
        assert.equal(res.headers.location, `${STUDIO_PATH}?checkout=return&synthetic=a%2Bb`);
      } else if (method === 'GET') {
        assert.match(res.body, /workshop-gate/);
        assert.doesNotMatch(res.body, /smw-builder|synthetic|studio-return=/);
      }
    }
  }
  const sitemap = await readFile('dist/sitemap.xml', 'utf8');
  for (const path of addresses) assert.ok(!sitemap.includes(path));
});
