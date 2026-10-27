import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMessageAllowance, MESSAGE_ALLOWANCE_KEY, MESSAGE_COOLDOWN_MS, SANTA_LAST_OUTRO_KEY } from '../src/lib/santaMessageAllowance.js';

function environment() {
  const values = new Map();
  let locked = false;
  const browser = Object.assign(new EventTarget(), {
    document: new EventTarget(),
    setInterval, clearInterval,
    localStorage: {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
    navigator: { locks: { async request(name, options, action) {
      if (locked) return action(null);
      locked = true;
      try { return await action({ name }); }
      finally { locked = false; }
    } } },
  });
  return browser;
}
const signal = () => new AbortController().signal;
const success = () => Promise.resolve('recording');

test('one success starts a full 30-minute wait and blocks further creation', async () => {
  const browser = environment();
  let now = 100000;
  const store = createMessageAllowance(browser, () => now);
  assert.equal(store.getSnapshot().remaining, 1);
  assert.equal(await store.create(success, signal()), 'recording');
  assert.equal(store.getSnapshot().remaining, 0);
  assert.equal(MESSAGE_COOLDOWN_MS, 1800000);
  assert.equal(store.getSnapshot().secondsLeft, 1800);
  assert.deepEqual(JSON.parse(browser.localStorage.getItem(MESSAGE_ALLOWANCE_KEY)), { used: 1, availableAt: now + MESSAGE_COOLDOWN_MS, cooldownMs: MESSAGE_COOLDOWN_MS });
  let calls = 0;
  await assert.rejects(store.create(() => { calls++; return success(); }, signal()), /countdown/);
  assert.equal(calls, 0);
});

test('each creation randomly selects either outro, allowing repeats across cooldowns and refreshes', async () => {
  const browser = environment();
  let now = 100000;
  const store = createMessageAllowance(browser, () => now, () => 0);
  const picked = [];
  const make = outro => { picked.push(outro); return Promise.resolve('recording'); };
  await store.create(make, signal());
  now += MESSAGE_COOLDOWN_MS + 1;
  await assert.rejects(store.create(() => Promise.reject(new Error('failed')), signal()), /failed/);
  assert.equal(browser.localStorage.getItem(SANTA_LAST_OUTRO_KEY), String(picked[0]));
  const reopened = createMessageAllowance(browser, () => now, () => 0);
  await reopened.create(make, signal());
  assert.deepEqual(picked, [1, 1]);
  now += MESSAGE_COOLDOWN_MS + 1;
  const next = createMessageAllowance(browser, () => now, () => 0.99);
  await next.create(make, signal());
  assert.deepEqual(picked, [1, 1, 2]);
});

test('reopening uses the saved absolute deadline; expiry restores one message', async () => {
  const browser = environment();
  let now = 100000;
  const first = createMessageAllowance(browser, () => now);
  await first.create(success, signal());
  const reopened = createMessageAllowance(browser, () => now);
  assert.equal(reopened.getSnapshot().remaining, 0);
  now += 60000;
  const returned = createMessageAllowance(browser, () => now);
  assert.equal(returned.getSnapshot().secondsLeft, 1740);
  now += MESSAGE_COOLDOWN_MS;
  returned.refresh();
  assert.equal(returned.getSnapshot().remaining, 1);
  assert.equal(returned.getSnapshot().secondsLeft, 0);
  await returned.create(success, signal());
  assert.equal(returned.getSnapshot().remaining, 0);
});

test('errors, already cancelled and cancelled in-flight requests do not count', async () => {
  const store = createMessageAllowance(environment());
  await assert.rejects(store.create(() => Promise.reject(new Error('failed')), signal()), /failed/);
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  await assert.rejects(store.create(() => { calls++; return success(); }, controller.signal), /abort/i);
  assert.equal(calls, 0);
  const inFlight = new AbortController();
  await assert.rejects(store.create(() => { inFlight.abort(); return success(); }, inFlight.signal), /abort/i);
  assert.equal(store.getSnapshot().remaining, 1);
  assert.equal(store.getSnapshot().pending, false);
});

test('simultaneous form instances and tabs cannot consume the last allowance twice', async () => {
  const browser = environment();
  const one = createMessageAllowance(browser), two = createMessageAllowance(browser);
  let release;
  const held = one.create(() => new Promise(resolve => { release = resolve; }), signal());
  await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(one.create(success, signal()), /Another message/);
  await assert.rejects(two.create(success, signal()), /Another message/);
  release('recording');
  await held;
  await assert.rejects(two.create(success, signal()), /countdown/);
  two.refresh();
  assert.equal(two.getSnapshot().remaining, 0);
});

test('blocked reads and writes explicitly use shared in-page memory', async () => {
  const browser = environment();
  Object.defineProperty(browser, 'localStorage', { get() { throw new Error('blocked'); } });
  const store = createMessageAllowance(browser);
  assert.equal(store.getSnapshot().remembered, false);
  await store.create(success, signal());
  assert.equal(store.getSnapshot().secondsLeft, 1800);
  await assert.rejects(store.create(success, signal()), /countdown/);
});

test('storage becoming unwritable after a success preserves the existing usage', async () => {
  const browser = environment();
  const store = createMessageAllowance(browser);
  await store.create(() => {
    browser.localStorage.setItem = () => { throw new Error('full'); };
    return success();
  }, signal());
  assert.equal(store.getSnapshot().remembered, false);
  assert.equal(store.getSnapshot().remaining, 0);
});

test('malformed saved state cannot crash or leave an impossible allowance', () => {
  for (const raw of ['not JSON', 'null', '{"used":3,"availableAt":0}', '{"used":2,"availableAt":0}', '{"used":1,"availableAt":999999}']) {
    const browser = environment();
    browser.localStorage.setItem(MESSAGE_ALLOWANCE_KEY, raw);
    const store = createMessageAllowance(browser);
    assert.equal(store.getSnapshot().remaining, 1);
  }
});

test('storage and focus events refresh subscribers, without leaking listeners on unmount', async () => {
  const browser = environment();
  let now = 100000, notifications = 0;
  const store = createMessageAllowance(browser, () => now);
  const unsubscribe = store.subscribe(() => { notifications++; });
  browser.localStorage.setItem(MESSAGE_ALLOWANCE_KEY, JSON.stringify({ used: 2, availableAt: now + MESSAGE_COOLDOWN_MS, cooldownMs: MESSAGE_COOLDOWN_MS }));
  const event = new Event('storage');
  Object.defineProperty(event, 'key', { value: MESSAGE_ALLOWANCE_KEY });
  browser.dispatchEvent(event);
  assert.equal(store.getSnapshot().secondsLeft, 1800);
  now += MESSAGE_COOLDOWN_MS;
  browser.dispatchEvent(new Event('focus'));
  assert.equal(store.getSnapshot().remaining, 1);
  unsubscribe();
  const count = notifications;
  browser.dispatchEvent(new Event('focus'));
  assert.equal(notifications, count);
});

test('previous ten-minute deadlines migrate once to thirty minutes from their original start', async () => {
  const browser = environment();
  const createdAt = 1000000;
  let now = createdAt + 2 * 60000;
  browser.localStorage.setItem(MESSAGE_ALLOWANCE_KEY, JSON.stringify({ used: 2, availableAt: createdAt + 10 * 60000, cooldownMs: 10 * 60000 }));
  const store = createMessageAllowance(browser, () => now);
  assert.equal(store.getSnapshot().secondsLeft, 1680);
  store.refresh();
  assert.equal(store.getSnapshot().secondsLeft, 1680, 'refresh must not move the deadline again');
  assert.equal(createMessageAllowance(browser, () => now).getSnapshot().secondsLeft, 1680);
  now = createdAt + 30 * 60000;
  store.refresh();
  assert.equal(store.getSnapshot().remaining, 1);
  await store.create(success, signal());
  assert.equal(store.getSnapshot().secondsLeft, 1800);
  assert.equal(createMessageAllowance(browser, () => now).getSnapshot().secondsLeft, 1800);
});

test('unmarked legacy thirty-minute waits keep their original deadline', () => {
  const browser = environment();
  const now = 10000000;
  browser.localStorage.setItem(MESSAGE_ALLOWANCE_KEY, JSON.stringify({ used: 2, availableAt: now + 19 * 60000 }));
  assert.equal(createMessageAllowance(browser, () => now).getSnapshot().secondsLeft, 19 * 60);
});

test('an old single success without a timestamp starts one persisted wait, not a rolling wait', async () => {
  const browser = environment();
  let now = 100000;
  browser.localStorage.setItem(MESSAGE_ALLOWANCE_KEY, JSON.stringify({ used: 1, availableAt: 0, cooldownMs: 600000 }));
  const store = createMessageAllowance(browser, () => now);
  assert.equal(store.getSnapshot().secondsLeft, 1800);
  now += 60000;
  store.refresh();
  assert.equal(store.getSnapshot().secondsLeft, 1740);
  assert.equal(createMessageAllowance(browser, () => now).getSnapshot().secondsLeft, 1740);
  now += 29 * 60000;
  store.refresh();
  assert.equal(store.getSnapshot().remaining, 1);
  await store.create(success, signal());
  assert.equal(store.getSnapshot().secondsLeft, 1800);
});
