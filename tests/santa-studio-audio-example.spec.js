import { test, expect } from '@playwright/test';
import { mockBrevo } from './helpers/message-access.js';
import { GIFT_EXAMPLE_INTERVAL_MS } from '../src/lib/santaStudioLetter.js';
import { expandStudioGifts } from './helpers/studio-promotion.js';

const EXAMPLES = [
  { name: 'Charlotte', cues: [9, 18, 29, 38, 44, 54, 64, 80] },
  { name: 'Harry', cues: [9, 18, 29, 38, 45, 54, 64, 79] },
  { name: 'Edward', cues: [9, 18, 29, 38, 45, 54, 64, 79] },
  { name: 'Arabella', cues: [9, 18, 29, 38, 45, 54, 64, 79] },
];

const SAMPLE_LETTER_DETAILS = {
  Charlotte: ['10 years old', 'athletics', 'arts and crafts', 'reading your first book',
    'hot mulled cider', 'alcohol-free', 'left the destination blank'],
  Harry: ['10 years old', 'golf', 'helping around the house', 'doing well at sports day',
    'carrots for the reindeer', 'the Isle of Anglesey'],
  Edward: ['10 years old', 'running', 'keeping active and healthy', 'patience with siblings',
    'carrot cake', 'left the destination blank'],
  Arabella: ['10 years old', 'singing', 'baking and cooking', 'helping cook dinner',
    'a glass of wine', 'adults-only', 'not for children or reindeer', 'not drink it while I am flying',
    'left the destination blank'],
};

test.beforeEach(async ({ page }) => {
  await mockBrevo(page, { success: false });
  await page.route('**/api/radio-metadata*', route => route.fulfill({
    json: { available: false, current: null, upcoming: [] },
  }));
});

test('each fresh play randomly selects a paid Studio example with its own timed cues', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 900 });
  await visit(page);

  const promotion = page.locator('#santa-studio-promotion');
  const demo = promotion.locator('.santa-studio-audio-example');
  const audio = demo.locator('audio');
  const cue = demo.locator('.santa-studio-audio-example__cue');
  await expect(demo.locator('.santa-studio-audio-example__description')).toHaveCount(0);
  await expect(demo).not.toContainText(/Hear .+ personalised Message Maker Studio recording\./);
  await expect(demo.locator('.santa-studio-audio-example__seek-label')).toHaveCount(0);
  await expectHiddenExampleName(demo);

  const placement = await promotion.locator('.santa-studio-promotion__details').evaluate(details => {
    const children = [...details.children];
    return children.indexOf(details.querySelector('.santa-studio-audio-example')) >
      children.indexOf(details.querySelector('.santa-studio-promotion__checkout-note'));
  });
  expect(placement).toBe(true);
  const freeExample = page.getByRole('button', { name: 'Hear an example audio message', exact: true });
  await expect(freeExample).toHaveCount(1);

  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const bounds = await demo.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(await demo.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  }

  for (const [index, example] of EXAMPLES.entries()) {
    await startSample(demo, audio, example, index);
    await expectExample(demo, audio, example.name);
    await expect(promotion.locator('.studio-gifts')).toHaveAttribute('data-demo-name', example.name);
    if (index === 0) {
      const pause = demo.getByRole('button', { name: 'Pause Bespoke message example — Charlotte' });
      await pause.focus();
      await page.keyboard.press('Enter');
      const resume = demo.getByRole('button', { name: 'Resume Bespoke message example — Charlotte' });
      await expect(resume).toBeFocused();
      await expect.poll(() => audio.evaluate(element => element.paused)).toBe(true);
      await expectStudioGifts(promotion, 'Charlotte');
      await seekTo(audio, 9.4);
      await expect(cue).toHaveText('Personalised moment');
      await expect(resume).toBeVisible();
      await page.waitForTimeout(2200);
      await expect(cue).toHaveText('Personalised moment');
      await resume.click();
      await expect.poll(() => audio.evaluate(element => element.paused)).toBe(false);
      await expect(demo.getByRole('heading', { name: 'Paid Studio message example — Charlotte' })).toBeVisible();
      await expect(cue).toHaveText('Personalised moment');
      await audio.evaluate(element => element.pause());
    } else {
      await audio.evaluate(element => element.pause());
      await expect(demo.getByRole('button', { name: `Resume Bespoke message example — ${example.name}` })).toBeVisible();
    }
    await expectStudioGifts(promotion, example.name);
    await checkCues(audio, cue, example.cues);

    if (index === 0) {
      await seekTo(audio, 18.5);
      await expect(cue).toHaveText('Personalised moment');
    }
    if (index < EXAMPLES.length - 1) {
      await stopFor(demo).click();
      await expectHiddenExampleName(demo);
      await expect(promotion.locator('.studio-gifts')).not.toHaveAttribute('data-sample-profile');
      await expect(cue).toHaveText('');
    } else {
      await audio.evaluate(element => {
        element.currentTime = element.duration;
        element.dispatchEvent(new Event('ended'));
      });
      await expect(cue).toHaveText('');
      await expectHiddenExampleName(demo);
      await expect(promotion.locator('.studio-gifts')).not.toHaveAttribute('data-sample-profile');
    }
  }

  await expect(freeExample).toBeVisible();
  await freeExample.click();
  await expect(page.getByRole('button', { name: 'Stop example message', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Stop example message', exact: true }).click();
  await expect(freeExample).toBeVisible();
});

function playFor(demo) {
  return demo.getByRole('button', { name: 'Play Bespoke message example', exact: true });
}

function stopFor(demo) {
  return demo.getByRole('button', { name: 'Stop and rewind paid Studio example', exact: true });
}

async function startSample(demo, audio, example, index) {
  await demo.evaluate((_, value) => {
    window.__previousRandom = Math.random;
    Math.random = () => value;
  }, (index + 0.1) / EXAMPLES.length);
  await playFor(demo).click();
  await demo.evaluate(() => {
    Math.random = window.__previousRandom;
    delete window.__previousRandom;
  });
  await expect.poll(() => audio.evaluate(element => element.paused)).toBe(false);
  await expect(demo.getByRole('button', { name: `Pause Bespoke message example — ${example.name}` })).toBeVisible();
  await expect(demo.locator('.santa-studio-audio-example__label')).toHaveText('Bespoke message example');
  await expect(demo.getByRole('heading', { name: `Paid Studio message example — ${example.name}` })).toBeVisible();
}

async function expectHiddenExampleName(demo) {
  await expect(demo.locator('.santa-studio-audio-example__label')).toHaveText('Bespoke message example');
  await expect(demo.getByRole('heading', { name: 'Paid Studio message example', exact: true })).toBeVisible();
  await expect(stopFor(demo)).toBeVisible();
  await expect(demo.locator('.santa-studio-audio-example__seek')).toHaveCount(1);
  const playerText = await demo.innerText();
  const accessibleLabels = await demo.locator('[aria-label]').evaluateAll(nodes =>
    nodes.map(node => node.getAttribute('aria-label')).join(' '));
  for (const { name } of EXAMPLES) {
    expect(playerText).not.toContain(name);
    expect(accessibleLabels).not.toContain(name);
  }
}

async function expectExample(demo, audio, name) {
  await expect(demo.getByRole('heading', { name: `Paid Studio message example — ${name}` })).toBeVisible();
  await expect(audio).toHaveAttribute('src', `/audio/examples/santa-studio-${name.toLowerCase()}.mp3`);
  await expect.poll(() => audio.evaluate(element => element.readyState)).toBeGreaterThanOrEqual(1);
  expect(await audio.evaluate(element => element.duration)).toBeGreaterThan(80);
  await expect(demo.locator('.santa-studio-audio-example__seek')).toBeEnabled();
}

async function expectStudioGifts(promotion, name) {
  await expandStudioGifts(promotion);
  const gifts = promotion.locator('.studio-gifts');
  await expect(gifts).toHaveAttribute('data-demo-name', name);
  const sampleDetails = SAMPLE_LETTER_DETAILS[name];
  if (sampleDetails) {
    await expect(gifts).toHaveAttribute('data-sample-profile', name);
    const accessibleLetter = gifts.locator('.studio-gifts__preview-stack .studio-gifts__sr');
    for (const detail of sampleDetails) {
      await expect(accessibleLetter).toContainText(new RegExp(detail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
    }
    if (name !== 'Harry') await expect(accessibleLetter).not.toContainText('Isle of Anglesey');
    await expectPromotionalLetterFits(gifts.locator('.studio-gifts__preview-stack .studio-letter__paper'));
  } else {
    await expect(gifts).not.toHaveAttribute('data-sample-profile');
  }
  await expect(gifts.locator('.studio-gifts__thumbnail')).toHaveCount(3);
  await expect(gifts.locator('.studio-certificate').first()).toHaveAttribute(
    'aria-label', `Official Nice List certificate example for ${name}`,
  );
  await expect(gifts.locator('.studio-letter__paper').first()).toHaveAttribute(
    'aria-label', `Santa’s letter example for ${name}`,
  );
  await expect(gifts.locator('.studio-santa-picture').first()).toHaveAttribute(
    'aria-label', `Santa’s Nice List picture example for ${name}`,
  );

  for (const [kind, label] of [
    ['picture', 'Enlarge Santa’s Nice List picture'],
    ['letter', 'Enlarge letter to read'],
    ['certificate', 'Enlarge certificate'],
  ]) {
    await gifts.getByRole('button', { name: label, exact: true }).click();
    const dialog = promotion.getByRole('dialog');
    await expect(dialog).toHaveAttribute('aria-label', `${name}’s ${kind} example`);
    await expect(dialog.locator({
      picture: '.studio-santa-picture',
      letter: '.studio-letter__paper',
      certificate: '.studio-certificate',
    }[kind])).toHaveAttribute('aria-label', {
      picture: `Santa’s Nice List picture example for ${name}`,
      letter: `Santa’s letter example for ${name}`,
      certificate: `Official Nice List certificate example for ${name}`,
    }[kind]);
    if (kind === 'letter' && sampleDetails) {
      const accessibleLetter = dialog.locator('.studio-letter-dialog__document .studio-gifts__sr');
      for (const detail of sampleDetails) {
        await expect(accessibleLetter).toContainText(new RegExp(detail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
      }
      await expectPromotionalLetterFits(dialog.locator('.studio-letter-dialog__document .studio-letter__paper'));
    }
    await promotion.page().keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  }
}

async function expectPromotionalLetterFits(paper) {
  const geometry = await paper.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    const text = element.querySelector('.studio-letter__text');
    const nodes = [...text.querySelectorAll(':scope > p, .studio-letter__signature, .studio-letter__closing p')];
    const lines = nodes.flatMap(node => {
      const range = document.createRange();
      range.selectNodeContents(node);
      return [...range.getClientRects()].map(rect => ({
        left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
      }));
    });
    return { paper: { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom }, lines };
  });
  expect(geometry.lines.length).toBeGreaterThan(0);
  for (const line of geometry.lines) {
    expect(line.left).toBeGreaterThanOrEqual(geometry.paper.left + (geometry.paper.right - geometry.paper.left) * .055 - 1);
    expect(line.right).toBeLessThanOrEqual(geometry.paper.right - (geometry.paper.right - geometry.paper.left) * .055 + 1);
    expect(line.top).toBeGreaterThanOrEqual(geometry.paper.top + (geometry.paper.bottom - geometry.paper.top) * .21 - 1);
    expect(line.bottom).toBeLessThanOrEqual(geometry.paper.top + (geometry.paper.bottom - geometry.paper.top) * .89 + 1);
  }
}

async function checkCues(audio, cue, cueTimes) {
  for (const cueTime of cueTimes) {
    await seekTo(audio, cueTime + 0.4);
    await expect(cue).toHaveText('Personalised moment');
    await seekTo(audio, cueTime + 2.1);
    await expect(cue).toHaveText('');
  }
}

async function visit(page, path = '/free-santa-message') {
  await page.goto(path);
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
}

test('homepage paid Studio gifts follow each paused example without overriding a selected recipient', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 900 });
  await visit(page, '/');

  const promotion = page.locator('#santa-studio-promotion');
  const demo = promotion.locator('.santa-studio-audio-example');
  const audio = demo.locator('audio');
  for (const [index, example] of EXAMPLES.entries()) {
    await startSample(demo, audio, example, index);
    await expectExample(demo, audio, example.name);
    await expect(promotion.locator('.studio-gifts')).toHaveAttribute('data-demo-name', example.name);
    await audio.evaluate(element => element.pause());
    await expect(demo.getByRole('button', { name: `Resume Bespoke message example — ${example.name}` })).toBeVisible();
    await expectStudioGifts(promotion, example.name);
    if (index < EXAMPLES.length - 1) {
      await stopFor(demo).click();
      await expectHiddenExampleName(demo);
      await expect(promotion.locator('.studio-gifts')).not.toHaveAttribute('data-sample-profile');
    } else {
      await audio.evaluate(element => {
        element.currentTime = element.duration;
        element.dispatchEvent(new Event('ended'));
      });
      await expectHiddenExampleName(demo);
      await expect(promotion.locator('.studio-gifts')).not.toHaveAttribute('data-sample-profile');
    }
  }

  await page.evaluate(async () => {
    const { selectSantaRecipient } = await import('/src/components/useSantaRecipient.js');
    selectSantaRecipient('Oliver');
  });
  await startSample(demo, audio, EXAMPLES[0], 0);
  await expect(promotion.locator('.studio-gifts')).toHaveAttribute('data-demo-name', 'Oliver');
  await audio.evaluate(element => element.pause());
  await expectStudioGifts(promotion, 'Oliver');
});

test('loading and playback failures keep the selected paid sample name private', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 900 });
  await visit(page);
  const demo = page.locator('#santa-studio-promotion .santa-studio-audio-example');
  const audio = demo.locator('audio');

  await audio.evaluate(element => {
    window.rejectPaidSample = null;
    element.play = () => new Promise((resolve, reject) => {
      window.rejectPaidSample = reject;
    });
  });
  await demo.evaluate(() => { Math.random = () => 0.99; });
  await playFor(demo).click();
  await expect(demo.getByRole('status').filter({ hasText: 'Loading paid Studio example…' })).toBeVisible();
  await expectHiddenExampleName(demo);

  await page.evaluate(() => window.rejectPaidSample(new Error('simulated playback failure')));
  await expect(demo.getByRole('alert')).toHaveText('The paid Studio example could not be played. Please try again.');
  await expectHiddenExampleName(demo);
  await expect(audio).toHaveAttribute('src', '/audio/examples/santa-studio-arabella.mp3');

  await playFor(demo).click();
  await expect(demo.getByRole('status').filter({ hasText: 'Loading paid Studio example…' })).toBeVisible();
  await audio.evaluate(element => element.dispatchEvent(new Event('error')));
  await expect(demo.getByRole('alert')).toHaveText('The paid Studio example could not be loaded. Please try again.');
  await expectHiddenExampleName(demo);
});

for (const path of ['/', '/free-santa-message']) {
  test(`paid example keeps a compact ordered layout on ${path}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await visit(page, path);
    const demo = page.locator('#santa-studio-promotion .santa-studio-audio-example');
    for (const width of [320, 390, 767, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(demo).toBeVisible();
      const layout = await demo.evaluate(card => {
        const rect = selector => {
          const { x, y, width, height, bottom, right } = card.querySelector(selector).getBoundingClientRect();
          return { x, y, width, height, bottom, right };
        };
        return {
          card: { height: card.getBoundingClientRect().height, x: card.getBoundingClientRect().x,
            right: card.getBoundingClientRect().right, bottom: card.getBoundingClientRect().bottom },
          heading: rect('h4'),
          controls: rect('.santa-studio-audio-example__controls'),
          play: rect('.santa-studio-audio-example__play'),
          stop: rect('.santa-studio-audio-example__stop'),
          timeline: rect('.santa-studio-audio-example__timeline'),
          cue: rect('.santa-studio-audio-example__cue'),
          overflow: card.scrollWidth > card.clientWidth + 1,
        };
      });
      expect(layout.overflow).toBe(false);
      expect(layout.card.x).toBeGreaterThanOrEqual(0);
      expect(layout.card.right).toBeLessThanOrEqual(width);
      expect(layout.controls.y - layout.heading.bottom).toBeCloseTo(4, 0);
      for (const button of [layout.play, layout.stop]) {
        expect(button.height).toBeGreaterThanOrEqual(44);
        expect(button.width).toBeGreaterThanOrEqual(44);
        expect(button.right).toBeLessThanOrEqual(layout.card.right);
      }
      expect(layout.cue.height).toBe(0);
      if (width >= 768) {
        await expect(demo.getByRole('slider')).toBeVisible();
        expect(layout.timeline.y - layout.controls.bottom).toBeCloseTo(4, 0);
        expect(layout.card.bottom - layout.timeline.bottom).toBeCloseTo(11, 0);
        expect(layout.card.height).toBeLessThanOrEqual(140);
      } else {
        await expect(demo.locator('.santa-studio-audio-example__timeline')).toBeHidden();
        expect(layout.card.bottom - layout.controls.bottom).toBeCloseTo(11, 0);
      }
    }
  });

  test(`paid playback and recipient priority survive collapsed gifts and resizing on ${path}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 320, height: 900 });
    await visit(page, path);
    const promotion = page.locator('#santa-studio-promotion');
    const toggle = promotion.getByRole('button', { name: 'Free gifts include', exact: true });
    const content = promotion.locator('.santa-studio-promotion__gift-content');
    const demo = promotion.locator('.santa-studio-audio-example');
    const audio = demo.locator('audio');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await startSample(demo, audio, EXAMPLES[0], 0);
    await expect(content).toBeHidden();
    await expect(promotion.locator('.studio-gifts')).toHaveAttribute('data-demo-name', 'Charlotte');
    await demo.getByRole('button', { name: 'Pause Bespoke message example — Charlotte' }).click();
    await seekTo(audio, 18.5);
    await expect(demo.locator('.santa-studio-audio-example__cue')).toHaveText('Personalised moment');
    await expect(demo.getByRole('slider')).toHaveCount(0);
    await expect(demo.locator('.santa-studio-audio-example__time')).toBeHidden();
    await page.setViewportSize({ width: 768, height: 900 });
    await expect(content).toBeVisible();
    await expect(demo.getByRole('slider')).toBeVisible();
    await expect(demo.locator('.santa-studio-audio-example__time')).toHaveText(/0:18 \/ 1:/);
    await expect(demo.getByRole('button', { name: 'Resume Bespoke message example — Charlotte' })).toBeVisible();
    await page.setViewportSize({ width: 320, height: 900 });
    await expect(content).toBeHidden();
    await demo.getByRole('button', { name: 'Resume Bespoke message example — Charlotte' }).click();
    await expect.poll(() => audio.evaluate(element => element.paused)).toBe(false);
    await toggle.click();
    await expectStudioGifts(promotion, 'Charlotte');
    await toggle.click();
    await page.evaluate(async () => {
      const { selectSantaRecipient } = await import('/src/components/useSantaRecipient.js');
      selectSantaRecipient('Oliver');
    });
    await expect(promotion.locator('.studio-gifts')).toHaveAttribute('data-demo-name', 'Oliver');
    await toggle.click();
    await expectStudioGifts(promotion, 'Oliver');
    await stopFor(demo).click();
    await expectHiddenExampleName(demo);
    await expect(promotion.locator('.studio-gifts')).toHaveAttribute('data-demo-name', 'Oliver');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('promotional gift rotation resumes after the paid example stops', async ({ page }) => {
  test.setTimeout(30000);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 390, height: 900 });
  await visit(page, '/');

  const promotion = page.locator('#santa-studio-promotion');
  const gifts = promotion.locator('.studio-gifts');
  await expandStudioGifts(promotion);
  await gifts.scrollIntoViewIfNeeded();
  const demo = promotion.locator('.santa-studio-audio-example');
  const audio = demo.locator('audio');
  await expect(gifts).toHaveAttribute('data-demo-name', 'Edward');

  await startSample(demo, audio, EXAMPLES[0], 0);
  await audio.evaluate(element => element.pause());
  await expect(gifts).toHaveAttribute('data-demo-name', 'Charlotte');
  await stopFor(demo).click();
  await expectHiddenExampleName(demo);
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.activeElement?.blur());
  await expect(gifts).toHaveAttribute('data-demo-name', 'Charlotte');
  await page.waitForTimeout(GIFT_EXAMPLE_INTERVAL_MS + 300);
  await expect(gifts).toHaveAttribute('data-demo-name', 'Freya');

  await startSample(demo, audio, EXAMPLES[1], 1);
  await expect(gifts).toHaveAttribute('data-demo-name', 'Harry');
  // A synthetic ended event alone leaves the native element playing and can
  // race its queued playing event. Settle it before simulating the end position.
  await audio.evaluate(element => element.pause());
  await expect(demo.getByRole('button', { name: 'Resume Bespoke message example — Harry' })).toBeVisible();
  await audio.evaluate(element => {
    element.currentTime = element.duration;
    element.dispatchEvent(new Event('ended'));
  });
  await expectHiddenExampleName(demo);
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.activeElement?.blur());
  await page.waitForTimeout(GIFT_EXAMPLE_INTERVAL_MS + 300);
  await expect(gifts).not.toHaveAttribute('data-demo-name', 'Harry');
});

async function seekTo(audio, time) {
  await audio.evaluate((element, target) => {
    if (Math.abs(element.currentTime - target) < 0.05) {
      element.dispatchEvent(new Event('timeupdate'));
      return;
    }
    element.currentTime = target;
  }, time);
  await expect.poll(() => audio.evaluate((element, target) =>
    Math.abs(element.currentTime - target), time)).toBeLessThan(0.15);
}

// A controllable media clock exercises exact boundaries without wall-clock
// delays or native seeking rounding. The existing tests above use real MP3s.
async function controlMediaClock(audio) {
  await audio.evaluate(element => {
    let paused = true;
    let time = 0;
    let src = '';
    Object.defineProperties(element, {
      paused: { get: () => paused },
      ended: { get: () => false },
      duration: { get: () => 90 },
      currentTime: { get: () => time, set: value => { time = value; } },
      src: { get: () => src, set: value => { src = value; } },
    });
    element.play = () => {
      paused = false;
      element.dispatchEvent(new Event('loadedmetadata'));
      element.dispatchEvent(new Event('playing'));
      return Promise.resolve();
    };
    element.pause = () => {
      paused = true;
      element.dispatchEvent(new Event('pause'));
    };
    element.__setPaused = value => { paused = value; };
  });
}

async function expectMagic(demo, active) {
  const play = demo.locator('.santa-studio-audio-example__play');
  await expect(play).toHaveClass(active ? /--personalised/ : /__play$/);
  await expect(play.locator('.santa-studio-audio-example__label')).toHaveText('Bespoke message example');
  await expect(play.locator('.santa-studio-audio-example__sparkles'))
    .toHaveAttribute('aria-hidden', 'true');
  if (!active) {
    await expect(play.locator('.santa-studio-audio-example__sparkles')).toBeHidden();
    expect(await play.evaluate(node => node.getAnimations({ subtree: true }).length)).toBe(0);
  }
}

for (const [index, example] of EXAMPLES.entries()) {
  test(`${example.name} magic follows only the playing portion of every two-second cue`, async ({ page }) => {
    await visit(page);
    const demo = page.locator('#santa-studio-promotion .santa-studio-audio-example');
    const audio = demo.locator('audio');
    await controlMediaClock(audio);
    await demo.evaluate((_, value) => { Math.random = () => value; }, (index + .1) / 4);
    await playFor(demo).click();
    await expectMagic(demo, false);
    const idleBounds = await demo.locator('.santa-studio-audio-example__play').boundingBox();
    // No timeupdate event: animation-frame sampling must follow the media clock.
    for (const start of example.cues) {
      for (const [time, active] of [[start - .01, false], [start, true], [start + 1.99, true], [start + 2, false]]) {
        await audio.evaluate((element, value) => { element.currentTime = value; }, time);
        await expectMagic(demo, active);
      }
    }
    await audio.evaluate(element => { element.currentTime = 9.5; });
    await expectMagic(demo, true);
    expect(await demo.locator('.santa-studio-audio-example__play').boundingBox()).toEqual(idleBounds);
    const pause = demo.getByRole('button', { name: `Pause Bespoke message example — ${example.name}` });
    await pause.click();
    await expectMagic(demo, false);
    await demo.getByRole('button', { name: `Resume Bespoke message example — ${example.name}` }).click();
    await expectMagic(demo, true);
    await audio.evaluate(element => { element.currentTime = 11; });
    await expectMagic(demo, false);
    await audio.evaluate(element => { element.currentTime = 18.2; element.dispatchEvent(new Event('seeking')); });
    await expectMagic(demo, true);
    await audio.evaluate(element => { element.currentTime = 20; element.dispatchEvent(new Event('seeked')); });
    await expectMagic(demo, false);
    await audio.evaluate(element => { element.currentTime = 29; });
    await expectMagic(demo, true);
    await stopFor(demo).click();
    await expectMagic(demo, false);
    await expectHiddenExampleName(demo);
    for (const event of ['ended', 'error']) {
      await playFor(demo).click();
      await audio.evaluate(element => { element.currentTime = 38; });
      await expectMagic(demo, true);
      await audio.evaluate((element, name) => element.dispatchEvent(new Event(name)), event);
      await expectMagic(demo, false);
      await expectHiddenExampleName(demo);
      await audio.evaluate(element => element.pause());
    }
  });
}

test('loading retains keyboard focus and rejects stale completions after stop, end or error', async ({ page }) => {
  await visit(page);
  const demo = page.locator('#santa-studio-promotion .santa-studio-audio-example');
  const audio = demo.locator('audio');
  await controlMediaClock(audio);
  await audio.evaluate(element => {
    window.paidPlayCalls = 0;
    element.play = () => {
      window.paidPlayCalls++;
      return new Promise(resolve => { window.finishPaidPlay = resolve; });
    };
  });
  for (const action of ['stop', 'ended', 'error']) {
    const play = playFor(demo);
    await play.focus();
    await page.keyboard.press('Enter');
    const loading = demo.getByRole('button', { name: 'Loading Bespoke message example', exact: true });
    await expect(loading).toBeFocused();
    await expect(loading).toHaveAttribute('aria-busy', 'true');
    await expect(loading).toBeEnabled();
    const calls = await page.evaluate(() => window.paidPlayCalls);
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => window.paidPlayCalls)).toBe(calls);
    await expectHiddenExampleName(demo);
    if (action === 'stop') await stopFor(demo).click();
    else await audio.evaluate((element, name) => element.dispatchEvent(new Event(name)), action);
    // Even a late native completion reporting unpaused media cannot reactivate
    // the old request or reveal its recipient.
    await audio.evaluate(element => element.__setPaused(false));
    await page.evaluate(() => window.finishPaidPlay());
    await expect(playFor(demo)).toBeVisible();
    await expectMagic(demo, false);
    await expectHiddenExampleName(demo);
    await audio.evaluate(element => element.__setPaused(true));
  }
});

test('button magic is contained, readable and static with reduced motion at phone text sizes', async ({ page }) => {
  await visit(page);
  const demo = page.locator('#santa-studio-promotion .santa-studio-audio-example');
  const audio = demo.locator('audio');
  const play = demo.locator('.santa-studio-audio-example__play');
  await controlMediaClock(audio);
  await playFor(demo).click();
  await audio.evaluate(element => { element.currentTime = 9.5; });
  await expectMagic(demo, true);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  expect(await play.evaluate(node => node.getAnimations({ subtree: true }).length)).toBeGreaterThan(0);
  await page.mouse.move(0, 0);
  for (const reduced of [false, true]) {
    await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
    if (reduced) {
      expect(await play.evaluate(node => node.getAnimations({ subtree: true }).length)).toBe(0);
      await expect(play).toHaveCSS('background-color', 'rgb(195, 33, 45)');
    }
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const size of [100, 200]) {
        await page.addStyleTag({ content: `html { font-size: ${size}% !important; }` });
        await play.scrollIntoViewIfNeeded();
        const geometry = await play.evaluate(node => {
          const rect = node.getBoundingClientRect();
          const stop = node.nextElementSibling.getBoundingClientRect();
          const label = node.querySelector('.santa-studio-audio-example__label');
          const range = document.createRange();
          range.selectNodeContents(label);
          return {
            // Unrelated full-page decorations can overflow at enlarged root
            // sizes; measure the shared control and its own card here.
            fits: rect.left >= 0 && rect.right <= innerWidth + .5 &&
              node.closest('.santa-studio-audio-example').scrollWidth <=
              node.closest('.santa-studio-audio-example').clientWidth + 1,
            separate: rect.right <= stop.left || rect.bottom <= stop.top,
            textFits: [...range.getClientRects()].every(line =>
              line.left >= rect.left && line.right <= rect.right + .5 &&
              line.top >= rect.top && line.bottom <= rect.bottom + .5),
          };
        });
        expect(geometry, `${width}px, ${size}% text, reduced=${reduced}`)
          .toEqual({ fits: true, separate: true, textFits: true });
        await play.focus();
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Tab');
        await expect(play).toBeFocused();
        await expect(play).toHaveCSS('outline-style', 'solid');
      }
    }
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = '100%'; });
  await page.addStyleTag({ content: 'html { font-size: 100% !important; }' });
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await demo.screenshot({ path: 'generated-artifacts/studio-button-magic-mobile.png' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await demo.screenshot({ path: 'generated-artifacts/studio-button-magic-desktop.png' });
});
