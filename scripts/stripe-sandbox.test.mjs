import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSandboxObject, assertFamilyPrice, createSandboxApi, prepareFamilyOffer } from '../server/stripe-sandbox.js';

const price = { id: 'price_test', product: 'prod_test', livemode: false, active: true, currency: 'gbp', unit_amount: 650, type: 'one_time' };
const product = { id: 'prod_test', livemode: false };

test('only explicit test-mode objects and £6.50 one-off GBP prices are accepted', () => {
  assert.equal(assertFamilyPrice(price), price);
  for (const changes of [{ livemode: true }, { livemode: undefined }, { active: false }, { unit_amount: 6500 },
    { currency: 'usd' }, { type: 'recurring' }, { recurring: { interval: 'month' } }]) {
    assert.throws(() => assertFamilyPrice({ ...price, ...changes }));
  }
  for (const value of [undefined, {}, { livemode: true }]) assert.throws(() => assertSandboxObject(value));
});

test('deployment and non-workspace execution cannot reach Stripe', async () => {
  const connectors = { proxy() { throw new Error('Must not be called'); } };
  for (const env of [{}, { REPL_IDENTITY: 'test', VERCEL: '1' }, { REPL_IDENTITY: 'test', REPLIT_DEPLOYMENT: '1' }]) {
    await assert.rejects(createSandboxApi({ connectors, env }), /STRIPE_SANDBOX_WORKSPACE_ONLY/);
  }
});

test('live or missing mode is rejected before any write', async () => {
  for (const balance of [{ livemode: true }, {}]) {
    let calls = 0;
    const connectors = { async proxy(path, url, options) {
      calls++;
      assert.equal(url, '/v1/balance');
      assert.equal(options.method, 'GET');
      return Response.json(balance);
    } };
    await assert.rejects(createSandboxApi({ connectors, env: { REPL_IDENTITY: 'test' } }), /STRIPE_SANDBOX_REQUIRED/);
    assert.equal(calls, 1);
  }
});

test('mode is rechecked before writes after the connector changes', async () => {
  let calls = 0;
  const connectors = { async proxy() { return Response.json({ livemode: calls++ > 0 }); } };
  const api = await createSandboxApi({ connectors, env: { REPL_IDENTITY: 'test' } });
  await assert.rejects(api('/v1/products', { method: 'POST', fields: { name: 'test' } }), /STRIPE_SANDBOX_REQUIRED/);
  assert.equal(calls, 2);
});

test('preparation reuses the existing tagged sandbox offer without writes', async () => {
  const paths = [];
  const api = async (path, options) => {
    assert.equal(options, undefined);
    paths.push(path);
    return { data: path.includes('/products/search') ? [product] : [price] };
  };
  assert.deepEqual(await prepareFamilyOffer(api), { productId: 'prod_test', priceId: 'price_test', amount: 650, currency: 'gbp', livemode: false });
  assert.equal(paths.length, 2);
});

test('first preparation uses idempotency keys and never creates a subscription', async () => {
  const writes = [];
  const api = async (path, options) => {
    if (!options) return { data: [] };
    writes.push(options);
    assert.equal(options.method, 'POST');
    assert.ok(options.idempotencyKey);
    return path === '/v1/products' ? product : price;
  };
  await prepareFamilyOffer(api);
  assert.equal(writes.length, 2);
  assert.equal(writes[1].fields.unit_amount, '650');
  assert.equal(writes[1].fields.currency, 'gbp');
  assert.equal(writes[1].fields.recurring, undefined);
});

test('ambiguous products and prices fail instead of choosing silently', async () => {
  await assert.rejects(prepareFamilyOffer(async () => ({ data: [product, product] })), /AMBIGUOUS/);
  await assert.rejects(prepareFamilyOffer(async path => ({ data: path.includes('/products/search') ? [product] : [price, price] })), /AMBIGUOUS/);
});
