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
      const pause = demo.getByRole('button', { name: 'Pause Charlotte’s paid Studio example' });
      await pause.focus();
      await page.keyboard.press('Enter');
      const resume = demo.getByRole('button', { name: 'Resume Charlotte’s paid Studio example' });
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
      await expect(demo.getByRole('button', { name: `Resume ${example.name}’s paid Studio example` })).toBeVisible();
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
      await expect(cue).toHaveText('');
    } else {
      await audio.evaluate(element => {
        element.currentTime = element.duration;
        element.dispatchEvent(new Event('ended'));
      });
      await expect(cue).toHaveText('');
      await expectHiddenExampleName(demo);
    }
  }

  await expect(freeExample).toBeVisible();
  await freeExample.click();
  await expect(page.getByRole('button', { name: 'Stop example message', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Stop example message', exact: true }).click();
  await expect(freeExample).toBeVisible();
});

function playFor(demo) {
  return demo.getByRole('button', { name: 'Play paid Studio example', exact: true });
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
  await expect(demo.getByRole('button', { name: `Pause ${example.name}’s paid Studio example` })).toBeVisible();
  await expect(demo.getByRole('heading', { name: `Paid Studio message example — ${example.name}` })).toBeVisible();
}

async function expectHiddenExampleName(demo) {
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
    await promotion.page().keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
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
    await expect(demo.getByRole('button', { name: `Resume ${example.name}’s paid Studio example` })).toBeVisible();
    await expectStudioGifts(promotion, example.name);
    if (index < EXAMPLES.length - 1) {
      await stopFor(demo).click();
      await expectHiddenExampleName(demo);
    } else {
      await audio.evaluate(element => {
        element.currentTime = element.duration;
        element.dispatchEvent(new Event('ended'));
      });
      await expectHiddenExampleName(demo);
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
    await demo.getByRole('button', { name: 'Pause Charlotte’s paid Studio example' }).click();
    await seekTo(audio, 18.5);
    await expect(demo.locator('.santa-studio-audio-example__cue')).toHaveText('Personalised moment');
    await expect(demo.getByRole('slider')).toHaveCount(0);
    await expect(demo.locator('.santa-studio-audio-example__time')).toBeHidden();
    await page.setViewportSize({ width: 768, height: 900 });
    await expect(content).toBeVisible();
    await expect(demo.getByRole('slider')).toBeVisible();
    await expect(demo.locator('.santa-studio-audio-example__time')).toHaveText(/0:18 \/ 1:/);
    await expect(demo.getByRole('button', { name: 'Resume Charlotte’s paid Studio example' })).toBeVisible();
    await page.setViewportSize({ width: 320, height: 900 });
    await expect(content).toBeHidden();
    await demo.getByRole('button', { name: 'Resume Charlotte’s paid Studio example' }).click();
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
  await expect(demo.getByRole('button', { name: 'Resume Harry’s paid Studio example' })).toBeVisible();
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
