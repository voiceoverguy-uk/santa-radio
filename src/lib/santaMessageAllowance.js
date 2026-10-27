import { withMessageCreationLock } from './santaMessageCreationLock.js';

export const MESSAGE_ALLOWANCE_KEY = 'santa-message-allowance';
export const SANTA_LAST_OUTRO_KEY = 'santa-message-last-outro';
export const MESSAGE_ALLOWANCE = 1;
export const MESSAGE_COOLDOWN_MS = 30 * 60 * 1000;
const LEGACY_COOLDOWN_MS = 30 * 60 * 1000;
const empty = () => ({ used: 0, availableAt: 0 });

function normalise(value, now) {
  if (!value || !Number.isInteger(value.used) || value.used < 0 || value.used > MESSAGE_ALLOWANCE ||
      !Number.isSafeInteger(value.availableAt) || value.availableAt < 0 ||
      (value.used === MESSAGE_ALLOWANCE ? !value.availableAt : value.availableAt !== 0)) return empty();
  return value.availableAt && value.availableAt <= now ? empty() : { used: value.used, availableAt: value.availableAt };
}

// One store per open page, shared by all form instances. Browser storage contains
// only usage and timing, never adult contact details, selected names or audio.
export function createMessageAllowance(browser, now = () => Date.now(), random = Math.random) {
  let memory = empty(), remembered = true, pending = false, snapshot;
  const listeners = new Set();
  let interval;
  try {
    const storage = browser.localStorage;
    const saved = storage.getItem(MESSAGE_ALLOWANCE_KEY);
    // Check writes too: some privacy modes expose readable but unwritable storage.
    storage.setItem(MESSAGE_ALLOWANCE_KEY, saved || JSON.stringify(empty()));
  } catch { remembered = false; }

  const read = () => {
    if (remembered) {
      try {
        const raw = browser.localStorage.getItem(MESSAGE_ALLOWANCE_KEY);
        let saved;
        try { saved = JSON.parse(raw); } catch { saved = null; }
        let restored = saved;
        // Old two-message records with a deadline retain their original start.
        // A single old success had no timestamp: start one wait and persist it
        // immediately so returning to the page never restarts that wait.
        if (saved?.used === 1 && saved.availableAt === 0) {
          restored = { used: 1, availableAt: now() + MESSAGE_COOLDOWN_MS };
        } else if ((saved?.used === 1 || saved?.used === 2) &&
                   Number.isSafeInteger(saved.availableAt) && saved.availableAt > 0) {
          const duration = Number.isSafeInteger(saved.cooldownMs) && saved.cooldownMs > 0
            ? saved.cooldownMs : LEGACY_COOLDOWN_MS;
          restored = { used: 1, availableAt: saved.availableAt - duration + MESSAGE_COOLDOWN_MS };
        }
        memory = normalise(restored, now());
        const canonical = JSON.stringify({ ...memory, cooldownMs: MESSAGE_COOLDOWN_MS });
        if (raw !== canonical) browser.localStorage.setItem(MESSAGE_ALLOWANCE_KEY, canonical);
      } catch { remembered = false; }
    }
    return memory = normalise(memory, now());
  };
  const refresh = () => {
    const state = read();
    const next = {
      ...state, remembered, pending,
      remaining: MESSAGE_ALLOWANCE - state.used,
      secondsLeft: Math.max(0, Math.ceil((state.availableAt - now()) / 1000)),
    };
    if (!snapshot || Object.keys(next).some(key => next[key] !== snapshot[key])) {
      snapshot = next;
      listeners.forEach(listener => listener());
    }
  };
  const onStorage = event => {
    if (event.key === MESSAGE_ALLOWANCE_KEY || event.key === null) refresh();
  };
  refresh();

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1) {
        browser.addEventListener('storage', onStorage);
        browser.addEventListener('focus', refresh);
        browser.addEventListener('pageshow', refresh);
        browser.document.addEventListener('visibilitychange', refresh);
        interval = browser.setInterval(refresh, 1000);
        refresh();
      }
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          browser.clearInterval(interval);
          browser.removeEventListener('storage', onStorage);
          browser.removeEventListener('focus', refresh);
          browser.removeEventListener('pageshow', refresh);
          browser.document.removeEventListener('visibilitychange', refresh);
        }
      };
    },
    refresh,
    async create(generate, signal) {
      if (pending) throw new Error('Another message is being created in this browser. Please wait for it to finish.');
      pending = true;
      refresh();
      try {
        return await withMessageCreationLock(browser, remembered, async commit => {
          signal.throwIfAborted();
          if (read().used >= MESSAGE_ALLOWANCE) throw new Error('To generate more, please wait for the countdown to finish.');
          const outro = random() < 0.5 ? 1 : 2;
          const result = await generate(outro);
          signal.throwIfAborted();
          await commit(() => {
            signal.throwIfAborted();
            const state = read();
            if (state.used >= MESSAGE_ALLOWANCE) throw new Error('To generate more, please wait for the countdown to finish.');
            memory = {
              used: state.used + 1,
              availableAt: state.used + 1 === MESSAGE_ALLOWANCE ? now() + MESSAGE_COOLDOWN_MS : 0,
            };
            if (remembered) {
              try {
                browser.localStorage.setItem(MESSAGE_ALLOWANCE_KEY, JSON.stringify({ ...memory, cooldownMs: MESSAGE_COOLDOWN_MS }));
                browser.localStorage.setItem(SANTA_LAST_OUTRO_KEY, String(outro));
              }
              catch { remembered = false; }
            }
            refresh();
          });
          return result;
        });
      } finally {
        pending = false;
        refresh();
      }
    },
  };
}
