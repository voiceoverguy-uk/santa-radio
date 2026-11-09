import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { QUICK_CHECKER_REACTIONS, selectQuickCheckerReaction } from '../src/naughty-or-nice/quickCheckerReactions.js';

const path = '/naughty-or-nice-list-checker';
const widget = page => page.locator('.nn-widget');
const reactions = page => page.evaluate(() => window.clips.filter(clip => clip.source.includes('/reaction-')).map(clip => clip.source));

test('all eight equally sized random intervals select unchanged supplied MP3s', () => {
  expect(QUICK_CHECKER_REACTIONS).toHaveLength(8);
  expect(new Set(QUICK_CHECKER_REACTIONS).size).toBe(8);
  QUICK_CHECKER_REACTIONS.forEach((src, index) => {
    for (const fraction of [.001, .5, .999]) {
      expect(selectQuickCheckerReaction(() => (index + fraction) / 8)).toBe(src);
    }
    const original = readdirSync('attached_assets').find(name =>
      name.startsWith(`naughty-or-nice-reaction-${String(index + 1).padStart(2, '0')}_`));
    expect(readFileSync(`public${src}`).equals(readFileSync(`attached_assets/${original}`))).toBe(true);
  });
});

async function open(page, url = path) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    sessionStorage.setItem('santa-message-offer-shown', 'shown');
    localStorage.setItem('santaradio-cookie-consent-v2', JSON.stringify({
      version: 2, analytics: false, marketing: false, media: false, savedAt: Date.now(),
    }));
    const NativeAudio = window.Audio;
    window.NativeCheckerAudio = NativeAudio;
    window.clips = [];
    window.position = 0;
    window.mediaMode = 'normal';
    window.Audio = function (src) {
      if (!src?.includes('/naughty-or-nice/')) return new NativeAudio(src);
      const clip = new NativeAudio();
      clip.source = src;
      clip.active = false;
      Object.defineProperty(clip, 'duration', { get: () => 6.06 });
      Object.defineProperty(clip, 'currentTime', { get: () => window.position });
      clip.pause = () => { clip.active = false; };
      clip.load = () => {};
      clip.play = () => {
        window.clips.push(clip);
        clip.savedEnd = clip.onended;
        clip.savedError = clip.onerror;
        clip.savedPlaying = clip.onplaying;
        clip.active = true;
        if (src.includes('/checking-home') && window.mediaMode === 'blocked')
          return Promise.reject(new DOMException('Blocked', 'NotAllowedError'));
        if (src.includes('/checking-home') && window.mediaMode === 'missing') {
          queueMicrotask(() => clip.onerror?.());
          return Promise.resolve();
        }
        if (window.mediaMode === 'pending' || (src.includes('/reaction-') && window.mediaMode === 'reaction-pending'))
          return new Promise(resolve => { clip.resolvePlay = resolve; });
        if (src.includes('/reaction-') && window.mediaMode === 'reaction-blocked') return Promise.reject(new Error('Blocked'));
        if (src.includes('/reaction-') && window.mediaMode === 'reaction-missing')
          queueMicrotask(() => clip.onerror?.());
        return Promise.resolve();
      };
      return clip;
    };
    window.checking = () => window.clips.findLast(clip => clip.source.includes('/checking-home'));
  });
  await page.route(/youtube\.com|googlevideo\.com|global\.citrus3\.com/, route => route.abort());
  await page.route('**/names-data/*.json', route => route.fulfill({ json: ['Erin'] }));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await expect(widget(page).getByRole('combobox')).toBeVisible();
  await page.clock.install();
}

async function begin(page) {
  await widget(page).getByRole('combobox').fill('Erin');
  await widget(page).getByRole('button', { name: 'Lets check', exact: true }).click();
  await page.clock.runFor(550);
}

async function reveal(page, index = 0) {
  await page.evaluate(value => {
    window.draws = 0;
    Math.random = () => { window.draws++; return (value + .5) / 8; };
    window.position = 5.78;
  }, index);
  await page.clock.runFor(60);
  await expect(widget(page).locator('.nn-score')).toBeVisible();
}

async function end(page) {
  await page.evaluate(() => {
    const clip = window.checking();
    clip.active = false;
    clip.savedEnd();
  });
}

for (const url of ['/', path]) {
  test(`quick result sequences one reaction and stops at Head Elf on ${url}`, async ({ page }) => {
    await open(page, url);
    await begin(page);
    await reveal(page, 7);
    expect(await reactions(page)).toEqual([]);
    expect(await page.evaluate(() => window.checking().active)).toBe(true);
    await end(page);
    expect(await reactions(page)).toEqual([QUICK_CHECKER_REACTIONS[7]]);
    expect(await page.evaluate(() => window.checking().active)).toBe(false);
    await page.evaluate(() => {
      window.checking().savedEnd();
      window.checking().savedPlaying();
      window.dispatchEvent(new Event('resize'));
    });
    await page.clock.runFor(100);
    expect(await page.evaluate(() => window.draws)).toBe(2); // percentage + one reaction
    expect(await reactions(page)).toHaveLength(1);
    await widget(page).getByRole(url === '/' ? 'link' : 'button', { name: 'Lets check with Head Elf', exact: true }).click();
    await expect(page.locator('.nn-office').getByRole('combobox')).toHaveValue('Erin');
    expect(await page.evaluate(() => window.clips.every(clip => !clip.active))).toBe(true);
    await end(page);
    expect(await reactions(page)).toHaveLength(1);
  });

  test(`Head Elf cancels the queued reaction on ${url}`, async ({ page }) => {
    await open(page, url);
    await begin(page);
    await reveal(page);
    await widget(page).getByRole(url === '/' ? 'link' : 'button', { name: 'Lets check with Head Elf', exact: true }).click();
    await end(page);
    await page.clock.runFor(8000);
    expect(await reactions(page)).toEqual([]);
  });
}

test('successive completed checks can select each of the eight reactions, including repeats', async ({ page }) => {
  await open(page);
  for (const index of [0, 1, 2, 3, 4, 5, 6, 7, 7]) {
    await page.evaluate(() => { window.position = 0; });
    await begin(page);
    await reveal(page, index);
    await end(page);
    expect((await reactions(page)).at(-1)).toBe(QUICK_CHECKER_REACTIONS[index]);
    await widget(page).getByRole('button', { name: 'Start a new name check' }).click();
  }
  expect(await reactions(page)).toHaveLength(9);
});

for (const active of [false, true]) {
  for (const action of ['mute', 'restart', 'pagehide', 'navigate', 'coordinate', 'hidden']) {
    test(`${action} cancels ${active ? 'active' : 'queued'} reaction and stale callbacks`, async ({ page }) => {
      await open(page);
      await begin(page);
      await reveal(page);
      if (active) await end(page);
      if (action === 'mute') {
        await widget(page).getByRole('button', { name: 'Sound: on' }).click();
        await widget(page).getByRole('button', { name: 'Sound: off' }).click();
      } else if (action === 'restart') {
        await widget(page).getByRole('button', { name: 'Start a new name check' }).click();
      } else if (action === 'navigate') {
        await page.locator('.navbar').getByRole('link', { name: 'Home', exact: true }).click();
        await expect(page).toHaveURL(/\/$/);
        await expect(widget(page).getByRole('combobox')).toBeVisible();
      } else await page.evaluate(value => {
        if (value === 'pagehide') window.dispatchEvent(new Event('pagehide'));
        if (value === 'coordinate') document.dispatchEvent(new Event('santa-radio:soundboard-start'));
        if (value === 'hidden') {
          Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
          document.dispatchEvent(new Event('visibilitychange'));
        }
      }, action);
      await page.evaluate(() => {
        for (const clip of [...window.clips]) {
          clip.savedEnd?.();
          clip.savedError?.();
          clip.savedPlaying?.();
          clip.resolvePlay?.();
        }
      });
      await page.clock.runFor(9000);
      expect(await reactions(page)).toHaveLength(active ? 1 : 0);
      expect(await page.evaluate(() => window.clips.every(clip => !clip.active))).toBe(true);
    });
  }
}

for (const mode of ['blocked', 'missing', 'pending', 'stalled']) {
  test(`${mode} checking audio never blocks the result or starts a late reaction`, async ({ page }) => {
    await open(page);
    await page.evaluate(value => { window.mediaMode = value; }, mode);
    await begin(page);
    if (mode === 'stalled') await page.evaluate(() => window.checking().onstalled());
    await page.clock.runFor(40000);
    await expect(widget(page).locator('.nn-score')).toBeVisible();
    await expect(widget(page).getByRole('button', { name: 'Lets check with Head Elf' })).toBeEnabled();
    await page.evaluate(() => {
      window.checking().resolvePlay?.();
      window.checking().savedPlaying();
      window.checking().savedEnd();
    });
    expect(await reactions(page)).toEqual([]);
    expect(await page.evaluate(() => window.checking().active)).toBe(false);
  });
}

test('sound off suppresses the completed reaction and re-enabling does not replay it', async ({ page }) => {
  await open(page);
  await widget(page).getByRole('button', { name: 'Sound: on' }).click();
  await begin(page);
  await page.clock.runFor(7000);
  await expect(widget(page).locator('.nn-score')).toBeVisible();
  await widget(page).getByRole('button', { name: 'Sound: off' }).click();
  await page.clock.runFor(10000);
  expect(await reactions(page)).toEqual([]);
});

test('repeated buffering events cannot postpone the quick result indefinitely', async ({ page }) => {
  await open(page);
  await begin(page);
  for (let second = 0; second < 30; second++) {
    await page.evaluate(() => window.checking().onwaiting?.());
    await page.clock.runFor(1000);
  }
  await expect(widget(page).locator('.nn-score')).toBeVisible();
  await end(page);
  expect(await reactions(page)).toEqual([]);
  expect(await page.evaluate(() => window.checking().active)).toBe(false);
});

test('pending reaction playback is bounded and a late play resolution cannot restart it', async ({ page }) => {
  await open(page);
  await begin(page);
  await reveal(page);
  await page.evaluate(() => { window.mediaMode = 'reaction-pending'; });
  await end(page);
  await page.clock.runFor(7100);
  await page.evaluate(() => {
    const clip = window.clips.at(-1);
    clip.resolvePlay();
    clip.savedPlaying();
    clip.savedEnd();
  });
  expect(await reactions(page)).toHaveLength(1);
  expect(await page.evaluate(() => window.clips.every(clip => !clip.active))).toBe(true);
  await expect(widget(page).getByRole('button', { name: 'Lets check with Head Elf' })).toBeEnabled();
});

for (const mode of ['reaction-blocked', 'reaction-missing', 'reaction-stalled']) {
  test(`${mode} leaves Head Elf available without retries`, async ({ page }) => {
    await open(page);
    await begin(page);
    await reveal(page);
    await page.evaluate(value => { window.mediaMode = value; }, mode);
    await end(page);
    if (mode === 'reaction-stalled') await page.evaluate(() => window.clips.at(-1).onstalled());
    await page.clock.runFor(8000);
    expect(await reactions(page)).toHaveLength(1);
    expect(await page.evaluate(() => window.clips.every(clip => !clip.active))).toBe(true);
    await widget(page).getByRole('button', { name: 'Lets check with Head Elf' }).click();
    await expect(page.locator('.nn-office')).toBeVisible();
  });
}

test('public reaction bytes match originals and all eight decode in a real browser', async ({ page, request }) => {
  await open(page);
  for (const [index, src] of QUICK_CHECKER_REACTIONS.entries()) {
    const response = await request.get(src);
    expect(response.ok()).toBe(true);
    expect((await response.body()).equals(readFileSync(`public${src}`))).toBe(true);
    const decoded = await page.evaluate(async source => {
      const context = new AudioContext();
      try {
        const bytes = await (await fetch(source)).arrayBuffer();
        const buffer = await context.decodeAudioData(bytes);
        return { duration: buffer.duration, channels: buffer.numberOfChannels,
          audible: buffer.getChannelData(0).some(sample => Math.abs(sample) > .01) };
      } finally { await context.close(); }
    }, src);
    expect(decoded.duration, `reaction ${index + 1}`).toBeGreaterThan(3);
    expect(decoded.duration).toBeLessThan(4.5);
    expect(decoded.channels).toBeGreaterThan(0);
    expect(decoded.audible).toBe(true);
  }
});

test('real checking playback keeps its ending then plays one reaction without overlap', async ({ page }) => {
  test.setTimeout(30000);
  await open(page);
  await page.clock.resume();
  await page.evaluate(() => {
    window.realEvents = [];
    const NativeAudio = window.NativeCheckerAudio;
    window.Audio = function (src) {
      const clip = new NativeAudio(src);
      if (src.includes('/checking-home')) window.realChecking = clip;
      if (src.includes('/checking-home') || src.includes('/reaction-')) {
        clip.addEventListener('playing', () => window.realEvents.push({
          type: src.includes('/reaction-') ? 'reaction-playing' : 'checking-playing',
          checkingStopped: window.realChecking.paused && !window.realChecking.getAttribute('src'),
        }));
        clip.addEventListener('ended', () => window.realEvents.push({
          type: src.includes('/reaction-') ? 'reaction-ended' : 'checking-ended',
        }));
      }
      return clip;
    };
    const observer = new MutationObserver(() => {
      if (!window.realReveal && document.querySelector('.nn-score'))
        window.realReveal = { remaining: window.realChecking.duration - window.realChecking.currentTime,
          paused: window.realChecking.paused };
    });
    observer.observe(document.getElementById('root'), { childList: true, subtree: true });
  });
  await widget(page).getByRole('combobox').fill('Erin');
  await widget(page).getByRole('button', { name: 'Lets check', exact: true }).click();
  await expect(widget(page).locator('.nn-score')).toBeVisible({ timeout: 15000 });
  const revealState = await page.evaluate(() => window.realReveal);
  expect(revealState.paused).toBe(false);
  expect(revealState.remaining).toBeGreaterThan(.15);
  expect(revealState.remaining).toBeLessThan(.36);
  await expect.poll(() => page.evaluate(() => window.realEvents.map(event => event.type)),
    { timeout: 8000 }).toEqual(['checking-playing', 'checking-ended', 'reaction-playing', 'reaction-ended']);
  expect(await page.evaluate(() => window.realEvents.find(event => event.type === 'reaction-playing').checkingStopped)).toBe(true);
  await expect(page.locator('.radio-dock').getByRole('button', { name: 'Listen Live', exact: true })).toBeVisible();
});
