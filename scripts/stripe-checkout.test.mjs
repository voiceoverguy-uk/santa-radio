import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { createStudioCheckoutHandler, signedClaim, CHECKOUT_COOKIE } from '../server/santa-studio-checkout.js';

const secret = randomBytes(32).toString('hex');
const claim = randomBytes(32).toString('base64url');
const origin = 'https://sandbox.example.test';
const cookie = `${CHECKOUT_COOKIE}=${signedClaim(claim, secret)}`;
async function serve(t, overrides = {}) {
  const calls = [];
  const app = createStudioCheckoutHandler({
    getConfig: () => ({ secret, origin }),
    consume: async () => true, getStripe: async () => ({}),
    start: async args => { calls.push(args); return { sessionId: 'cs_test_fixture', url: 'https://checkout.stripe.com/c/pay/test' }; },
    ...overrides,
  });
  const server = createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const url = `http://127.0.0.1:${server.address().port}`;
  const post = (headers = {}, body = '{}') => fetch(url, { method: 'POST',
    headers: { Origin: origin, cookie, 'Content-Type': 'application/json', ...headers }, body });
  return { url, calls, post };
}
test('readiness sets a private signed browser claim without inventing paid-access expiry', async t => {
  const { url } = await serve(t);
  const response = await fetch(url);
  assert.deepEqual(await response.json(), { available: true, sandbox: true });
  const setCookie = response.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/); assert.match(setCookie, /Secure/); assert.match(setCookie, /SameSite=Lax/);
  assert.doesNotMatch(setCookie, /Max-Age|Expires/i);
});
test('cross-origin and cross-site requests never create checkout', async t => {
  const { post, calls } = await serve(t);
  assert.equal((await post({ Origin: 'https://evil.example' })).status, 403);
  assert.equal((await post({ Origin: '' })).status, 403);
  assert.equal((await post({ 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  assert.equal(calls.length, 0);
});
test('missing, forged and duplicate claims cannot start checkout', async t => {
  const { post, calls } = await serve(t);
  for (const value of ['', `${CHECKOUT_COOKIE}=${claim}.forged`, `${cookie}; ${cookie}`]) {
    assert.equal((await post({ cookie: value })).status, 409);
  }
  assert.equal(calls.length, 0);
});
test('server owns the price and redirect; private access cookie is issued before redirect but is not payment proof', async t => {
  const { post, calls } = await serve(t);
  assert.equal((await post({}, '{"price":"free","success_url":"https://evil.example"}')).status, 400);
  const response = await post();
  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].claim, claim);
  assert.equal(calls[0].origin, origin);
  assert.match(response.headers.get('set-cookie'), /santa-studio-sandbox=cs_test_fixture/);
  assert.match(response.headers.get('set-cookie'), /HttpOnly/);
  assert.match(response.headers.get('set-cookie'), /Secure/);
  const data = await response.json();
  assert.equal(data.openStudio, false);
  assert.equal(data.pending, false);
  assert.equal(data.claim, undefined);
});
test('rate limiting and provider errors fail closed without exposing details', async t => {
  const limited = await serve(t, { consume: async () => false });
  assert.equal((await limited.post()).status, 429);
  assert.equal(limited.calls.length, 0);
  const failed = await serve(t, { start: async () => { throw new Error('PRIVATE PROVIDER DETAIL'); } });
  const response = await failed.post();
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /PRIVATE PROVIDER DETAIL/);
  assert.equal(response.headers.get('set-cookie'), null);
});
test('unavailable sandbox does not create claims or invoke Stripe', async t => {
  const { url, post, calls } = await serve(t, { getConfig: () => { throw new Error('Deployment'); } });
  const response = await fetch(url);
  assert.equal(response.status, 503); assert.equal(response.headers.get('set-cookie'), null);
  assert.equal((await post()).status, 503); assert.equal(calls.length, 0);
});
