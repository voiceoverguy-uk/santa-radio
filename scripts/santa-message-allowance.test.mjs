import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMessageAllowance, MESSAGE_ALLOWANCE_KEY, MESSAGE_COOLDOWN_MS } from '../src/lib/santaMessageAllowance.js';

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

test('two successes start a full 30-minute wait, not a window from the first message', async () => {
  const browser = environment();
  let now = 100000;
  const store = createMessageAllowance(browser, () => now);
  assert.equal(store.getSnapshot().remaining, 2);
  assert.equal(await store.create(success, signal()), 'recording');
  assert.equal(store.getSnapshot().remaining, 1);
  now += 3600000;
  await store.create(success, signal());
  assert.equal(store.getSnapshot().secondsLeft, 1800);
  assert.deepEqual(JSON.parse(browser.localStorage.getItem(MESSAGE_ALLOWANCE_KEY)), { used: 2, availableAt: now + MESSAGE_COOLDOWN_MS });
  let calls = 0;
  await assert.rejects(store.create(() => { calls++; return success(); }, signal()), /countdown/);
  assert.equal(calls, 0);
});

test('reopening uses the saved allowance and absolute deadline; expiry restores two', async () => {
  const browser = environment();
  let now = 100000;
  const first = createMessageAllowance(browser, () => now);
  await first.create(success, signal());
  const reopened = createMessageAllowance(browser, () => now);
  assert.equal(reopened.getSnapshot().remaining, 1);
  await reopened.create(success, signal());
  now += 60000;
  const returned = createMessageAllowance(browser, () => now);
  assert.equal(returned.getSnapshot().secondsLeft, 1740);
  now += MESSAGE_COOLDOWN_MS;
  returned.refresh();
  assert.equal(returned.getSnapshot().remaining, 2);
  assert.equal(returned.getSnapshot().secondsLeft, 0);
  await returned.create(success, signal());
  assert.equal(returned.getSnapshot().remaining, 1);
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
  assert.equal(store.getSnapshot().remaining, 2);
  assert.equal(store.getSnapshot().pending, false);
});

test('simultaneous form instances and tabs cannot consume the last allowance twice', async () => {
  const browser = environment();
  const one = createMessageAllowance(browser), two = createMessageAllowance(browser);
  await one.create(success, signal());
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
  await store.create(success, signal());
  assert.equal(store.getSnapshot().secondsLeft, 1800);
  await assert.rejects(store.create(success, signal()), /countdown/);
});

test('storage becoming unwritable after a success preserves the existing usage', async () => {
  const browser = environment();
  const store = createMessageAllowance(browser);
  await store.create(success, signal());
  browser.localStorage.setItem = () => { throw new Error('full'); };
  await store.create(success, signal());
  assert.equal(store.getSnapshot().remembered, false);
  assert.equal(store.getSnapshot().remaining, 0);
});

test('malformed saved state cannot crash or leave an impossible allowance', () => {
  for (const raw of ['not JSON', 'null', '{"used":3,"availableAt":0}', '{"used":2,"availableAt":0}', '{"used":1,"availableAt":999999}']) {
    const browser = environment();
    browser.localStorage.setItem(MESSAGE_ALLOWANCE_KEY, raw);
    const store = createMessageAllowance(browser);
    assert.equal(store.getSnapshot().remaining, 2);
  }
});

test('storage and focus events refresh subscribers, without leaking listeners on unmount', async () => {
  const browser = environment();
  let now = 100000, notifications = 0;
  const store = createMessageAllowance(browser, () => now);
  const unsubscribe = store.subscribe(() => { notifications++; });
  browser.localStorage.setItem(MESSAGE_ALLOWANCE_KEY, JSON.stringify({ used: 2, availableAt: now + MESSAGE_COOLDOWN_MS }));
  const event = new Event('storage');
  Object.defineProperty(event, 'key', { value: MESSAGE_ALLOWANCE_KEY });
  browser.dispatchEvent(event);
  assert.equal(store.getSnapshot().secondsLeft, 1800);
  now += MESSAGE_COOLDOWN_MS;
  browser.dispatchEvent(new Event('focus'));
  assert.equal(store.getSnapshot().remaining, 2);
  unsubscribe();
  const count = notifications;
  browser.dispatchEvent(new Event('focus'));
  assert.equal(notifications, count);
});
