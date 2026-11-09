import { test, expect } from '@playwright/test';
import { mockBrevo } from './helpers/message-access.js';
import { GIFT_EXAMPLE_INTERVAL_MS } from '../src/lib/santaStudioLetter.js';

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

test('the four paid Studio examples rotate with their own timed cues', async ({ page }) => {
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

  const placement = await promotion.locator('.santa-studio-promotion__details').evaluate(details => {
    const children = [...details.children];
    return children.indexOf(details.querySelector('.santa-studio-audio-example')) >
      children.indexOf(details.querySelector('.santa-studio-promotion__checkout-note'));
  });
  expect(placement).toBe(true);
  await expectExample(demo, audio, 'Charlotte');
  expect(await audio.evaluate(element => element.duration)).toBeGreaterThan(80);
  const freeExample = page.getByRole('button', { name: 'Hear an example audio message', exact: true });
  await expect(freeExample).toHaveCount(1);

  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const bounds = await demo.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(await demo.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  }

  const charlottePlay = playFor(demo, 'Charlotte');
  await charlottePlay.focus();
  await page.keyboard.press('Enter');
  const charlottePause = demo.getByRole('button', { name: 'Pause Charlotte’s paid Studio example' });
  await expect(charlottePause).toBeFocused();
  await expect.poll(() => audio.evaluate(element => element.paused)).toBe(false);
  await expectStudioGifts(promotion, 'Charlotte');
  await seekTo(audio, 9.4);
  await expect(cue).toHaveText('Personalised moment');
  await expect(charlottePause).toHaveClass(/santa-studio-audio-example__play--personalised/);
  expect(await charlottePause.evaluate(element => getComputedStyle(element).transitionDuration)).toBe('0s');

  await audio.evaluate(element => element.pause());
  const charlotteResume = demo.getByRole('button', { name: 'Resume Charlotte’s paid Studio example' });
  await expect(charlotteResume).toBeVisible();
  await expect(cue).toHaveText('Personalised moment');
  await expectStudioGifts(promotion, 'Charlotte');
  await page.waitForTimeout(2200);
  await expect(cue).toHaveText('Personalised moment');
  await charlotteResume.click();
  await expect.poll(() => audio.evaluate(element => element.paused)).toBe(false);
  await expect(cue).toHaveText('Personalised moment');
  await audio.evaluate(element => element.pause());
  await expect(charlotteResume).toBeVisible();

  await checkCues(audio, cue, EXAMPLES[0].cues);
  await seekTo(audio, 18.5);
  await expect(cue).toHaveText('Personalised moment');
  await stopFor(demo, 'Charlotte').click();
  await expect(cue).toHaveText('');

  for (const [index, example] of EXAMPLES.entries()) {
    if (index === 0) continue;
    await expectExample(demo, audio, example.name);
    await start(demo, audio, example.name);
    await expect(promotion.locator('.studio-gifts')).toHaveAttribute('data-demo-name', example.name);
    await audio.evaluate(element => element.pause());
    await expect(demo.getByRole('button', { name: `Resume ${example.name}’s paid Studio example` })).toBeVisible();
    await expectStudioGifts(promotion, example.name);
    await checkCues(audio, cue, example.cues);

    if (index < EXAMPLES.length - 1) {
      await stopFor(demo, example.name).click();
      await expectExample(demo, audio, EXAMPLES[index + 1].name);
    } else {
      await audio.evaluate(element => {
        element.currentTime = element.duration;
        element.dispatchEvent(new Event('ended'));
      });
      await expect(cue).toHaveText('');
      await expectExample(demo, audio, 'Charlotte');
    }
  }

  await expect(freeExample).toBeVisible();
  await freeExample.click();
  await expect(page.getByRole('button', { name: 'Stop example message', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Stop example message', exact: true }).click();
  await expect(freeExample).toBeVisible();
});

function playFor(demo, name) {
  return demo.getByRole('button', { name: `Play ${name}’s paid Studio example` });
}

function stopFor(demo, name) {
  return demo.getByRole('button', { name: `Stop and rewind ${name}’s paid Studio example` });
}

async function start(demo, audio, name) {
  await playFor(demo, name).click();
  await expect.poll(() => audio.evaluate(element => element.paused)).toBe(false);
  await expect(demo.getByRole('button', { name: `Pause ${name}’s paid Studio example` })).toBeVisible();
}

async function expectExample(demo, audio, name) {
  await expect(demo.getByRole('heading', { name: `Paid Studio message example — ${name}` })).toBeVisible();
  await expect(audio).toHaveAttribute('src', `/audio/examples/santa-studio-${name.toLowerCase()}.mp3`);
  await expect.poll(() => audio.evaluate(element => element.readyState)).toBeGreaterThanOrEqual(1);
  expect(await audio.evaluate(element => element.duration)).toBeGreaterThan(80);
  await expect(demo.getByRole('slider', { name: `${name}’s paid Studio message position` })).toBeEnabled();
}

async function expectStudioGifts(promotion, name) {
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
    await expectExample(demo, audio, example.name);
    await start(demo, audio, example.name);
    await expect(promotion.locator('.studio-gifts')).toHaveAttribute('data-demo-name', example.name);
    await audio.evaluate(element => element.pause());
    await expect(demo.getByRole('button', { name: `Resume ${example.name}’s paid Studio example` })).toBeVisible();
    await expectStudioGifts(promotion, example.name);
    if (index < EXAMPLES.length - 1) {
      await stopFor(demo, example.name).click();
      await expectExample(demo, audio, EXAMPLES[index + 1].name);
    } else {
      await audio.evaluate(element => {
        element.currentTime = element.duration;
        element.dispatchEvent(new Event('ended'));
      });
      await expectExample(demo, audio, 'Charlotte');
    }
  }

  await page.evaluate(async () => {
    const { selectSantaRecipient } = await import('/src/components/useSantaRecipient.js');
    selectSantaRecipient('Oliver');
  });
  await start(demo, audio, 'Charlotte');
  await expect(promotion.locator('.studio-gifts')).toHaveAttribute('data-demo-name', 'Oliver');
  await audio.evaluate(element => element.pause());
  await expectStudioGifts(promotion, 'Oliver');
});

test('promotional gift rotation resumes after the paid example stops', async ({ page }) => {
  test.setTimeout(30000);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 390, height: 900 });
  await visit(page, '/');

  const promotion = page.locator('#santa-studio-promotion');
  const gifts = promotion.locator('.studio-gifts');
  await gifts.scrollIntoViewIfNeeded();
  const demo = promotion.locator('.santa-studio-audio-example');
  const audio = demo.locator('audio');
  await expect(gifts).toHaveAttribute('data-demo-name', 'Edward');

  await start(demo, audio, 'Charlotte');
  await audio.evaluate(element => element.pause());
  await expect(gifts).toHaveAttribute('data-demo-name', 'Charlotte');
  await stopFor(demo, 'Charlotte').click();
  await expectExample(demo, audio, 'Harry');
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.activeElement?.blur());
  await expect(gifts).toHaveAttribute('data-demo-name', 'Charlotte');
  await page.waitForTimeout(GIFT_EXAMPLE_INTERVAL_MS + 300);
  await expect(gifts).toHaveAttribute('data-demo-name', 'Freya');
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
