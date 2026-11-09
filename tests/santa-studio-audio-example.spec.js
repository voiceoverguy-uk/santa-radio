import { test, expect } from '@playwright/test';
import { mockBrevo } from './helpers/message-access.js';

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
  await seekTo(audio, 9.4);
  await expect(cue).toHaveText('Personalised moment');
  await expect(charlottePause).toHaveClass(/santa-studio-audio-example__play--personalised/);
  expect(await charlottePause.evaluate(element => getComputedStyle(element).transitionDuration)).toBe('0s');

  await audio.evaluate(element => element.pause());
  const charlotteResume = demo.getByRole('button', { name: 'Resume Charlotte’s paid Studio example' });
  await expect(charlotteResume).toBeVisible();
  await expect(cue).toHaveText('Personalised moment');
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
    await audio.evaluate(element => element.pause());
    await expect(demo.getByRole('button', { name: `Resume ${example.name}’s paid Studio example` })).toBeVisible();
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
  await expect.poll(() => audio.evaluate(element => element.currentTime)).toBeLessThan(0.5);
  await expect(demo.getByRole('button', { name: `Pause ${name}’s paid Studio example` })).toBeVisible();
}

async function expectExample(demo, audio, name) {
  await expect(demo.getByRole('heading', { name: `Paid Studio message example — ${name}` })).toBeVisible();
  await expect(audio).toHaveAttribute('src', `/audio/examples/santa-studio-${name.toLowerCase()}.mp3`);
  await expect.poll(() => audio.evaluate(element => element.readyState)).toBeGreaterThanOrEqual(1);
  expect(await audio.evaluate(element => element.duration)).toBeGreaterThan(80);
  await expect(demo.getByRole('slider', { name: `${name}’s message position` })).toBeEnabled();
}

async function checkCues(audio, cue, cueTimes) {
  for (const cueTime of cueTimes) {
    await seekTo(audio, cueTime + 0.4);
    await expect(cue).toHaveText('Personalised moment');
    await seekTo(audio, cueTime + 2.1);
    await expect(cue).toHaveText('');
  }
}

async function visit(page) {
  await page.goto('/free-santa-message');
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
}

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
