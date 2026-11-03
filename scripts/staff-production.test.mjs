import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import express from 'express';
import { once } from 'node:events';
import { canonicalPaths, staffEntryPaths, resolvePublicRequest } from '../src/seo/routes.js';
import publicPage from '../api/public-page.js';
import nameRequests, { approvedAdmin, createNameRequestHandler } from '../server/name-requests.js';

test('staff documents and callbacks are packaged, private, noindex and routed before the filesystem', async () => {
  const config = JSON.parse(await readFile('vercel.json', 'utf8'));
  const filesystem = config.routes.findIndex(route => route.handle === 'filesystem');
  const sitemap = await readFile('dist/sitemap.xml', 'utf8');
  for (const entry of staffEntryPaths) {
    assert.ok(!canonicalPaths.includes(entry));
    assert.ok(!sitemap.includes(entry));
    const html = await readFile(`dist/server/pages${entry}/index.html`, 'utf8');
    assert.equal(html, await readFile(`dist${entry}/index.html`, 'utf8'));
    for (const path of [entry, `${entry}/`, ...(entry !== '/request-names'
      ? [`${entry}/sso-callback`, `${entry}/factor-one`, `${entry}/verify-email-address`] : [])]) {
      const edgeRoute = config.routes.slice(0, filesystem).find(route =>
        route.dest && new RegExp(`^${route.src}$`).test(path));
      assert.ok(edgeRoute, path);
      const rewritten = path.replace(new RegExp(`^${edgeRoute.src}$`), edgeRoute.dest);
      for (const method of ['GET', 'HEAD']) {
        const response = { headers: {}, setHeader(k, v) { this.headers[k] = v; },
          status(code) { this.code = code; return this; }, end(body) { this.body = body; } };
        await publicPage({ method, url: rewritten }, response);
        assert.equal(response.code, 200, `${method} ${path}`);
        assert.equal(response.headers['X-Robots-Tag'], 'noindex, nofollow');
        assert.equal(response.headers['Cache-Control'], 'private, no-store');
        assert.equal(response.headers['CDN-Cache-Control'], 'no-store');
        assert.equal(response.headers['Vercel-CDN-Cache-Control'], 'no-store');
        assert.equal(response.body, method === 'HEAD' ? undefined : html);
      }
    }
  }
  for (const path of ['/request-names/unknown', '/free-santa-message/request-names', '/sign-injected', '/sign-upgrade'])
    assert.equal(resolvePublicRequest(path).status, 404, path);
  assert.equal(resolvePublicRequest('/sign-in/%ZZ').status, 400);
});

const owner = (address = 'admin@santaradio.co.uk', status = 'verified') => ({
  primaryEmailAddressId: 'primary',
  emailAddresses: [{ id: 'primary', emailAddress: address, verification: { status } }],
});
const row = { name: 'Émile', count: 2, firstRequestedAt: '2026-01-01T00:00:00Z',
  lastRequestedAt: '2026-01-02T00:00:00Z', recordedAt: null };

test('HTTP fixtures enforce owner approval for reads, exports and completion without a database', async t => {
  let reads = 0, writes = 0, completed = false;
  const users = {
    other: owner('other@example.test'), unverified: owner(undefined, 'unverified'),
    secondary: { ...owner('other@example.test'), emailAddresses: [
      ...owner('other@example.test').emailAddresses, { ...owner().emailAddresses[0], id: 'secondary' }] },
    owner: owner(),
  };
  const app = express();
  app.use(express.json());
  // Session selection is only an injected test fixture, never an application bypass.
  app.use(createNameRequestHandler({
    checkAdmin: async req => !users[req.headers['x-fixture-user']] ? 401
      : approvedAdmin(users[req.headers['x-fixture-user']]) ? 200 : 403,
    list: async (page, q, status, all) => {
      reads++;
      assert.equal(page, 1);
      assert.equal(q, '');
      assert.equal(typeof all, 'boolean');
      return { requests: (status === 'completed') === completed ? [{ ...row,
        recordedAt: completed ? '2026-01-03T00:00:00Z' : null }] : [], total: 1, page, status };
    },
    record: async key => { assert.equal(key, 'émile'); writes++; completed = true; return { recorded: true }; },
  }));
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (user, path = '', method = 'GET') => fetch(base + '/api/name-requests' + path, {
    method, headers: { ...(user ? { 'x-fixture-user': user } : {}), 'Content-Type': 'application/json' },
    ...(method === 'PATCH' ? { body: JSON.stringify({ name: 'Émile', action: 'recorded' }) } : {}),
  });
  for (const user of [null, 'other', 'unverified', 'secondary']) {
    for (const [path, method] of [['', 'GET'], ['?status=completed', 'GET'],
      ['?download=txt', 'GET'], ['?download=txt&status=completed', 'GET'], ['', 'PATCH']]) {
      const res = await call(user, path, method);
      assert.equal(res.status, user ? 403 : 401);
      assert.equal(res.headers.get('cache-control'), 'private, no-store');
      assert.equal(res.headers.get('x-robots-tag'), 'noindex, nofollow');
      assert.ok(!(await res.text()).includes('Émile'));
    }
  }
  assert.equal(reads, 0); assert.equal(writes, 0);
  assert.equal((await (await call('owner')).json()).requests[0].name, 'Émile');
  let download = await call('owner', '?download=txt');
  assert.match(download.headers.get('content-disposition'), /outstanding\.txt/);
  assert.match(await download.text(), /Émile\t2\t2026-01-01/);
  assert.equal((await (await call('owner', '', 'PATCH')).json()).recorded, true);
  assert.equal((await (await call('owner')).json()).requests.length, 0);
  assert.equal((await (await call('owner', '?status=completed')).json()).requests[0].name, 'Émile');
  download = await call('owner', '?download=txt&status=completed');
  assert.match(download.headers.get('content-disposition'), /completed\.txt/);
  assert.match(await download.text(), /2026-01-03/);
  assert.equal(writes, 1);
});

test('actual API middleware denies anonymous private operations before Clerk or database access', async t => {
  const server = nameRequests.listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  await once(server, 'listening');
  for (const [path, method] of [['', 'GET'], ['?download=txt&status=completed', 'GET'], ['', 'PATCH']]) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/name-requests${path}`, { method });
    assert.equal(response.status, 401);
    assert.match(response.headers.get('cache-control'), /^private, no-store(?:, max-age=0)?$/);
    assert.ok(!(await response.text()).includes('requests":'));
  }
});
