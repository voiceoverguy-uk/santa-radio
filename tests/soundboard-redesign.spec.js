import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const labels = [
  'Are you asleep', 'Been Naughty', 'Cookies', "It's Christmas", 'Jingle Bells',
  'Making a List', 'Tis the Season', 'Very Quiet', 'Happy Holidays', 'Merry Christmas',
  'Naughty or Nice', 'What Would You Like?', 'Is Christmas Dinner Ready Yet?', 'Merry Kiss-Mas',
  'No', 'Yes', 'Are You Ready for Christmas?', 'Proper Chrimbo', 'Goodbye', 'Ho Ho Ho',
];

async function open(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    sessionStorage.setItem('santa-message-offer-shown', 'shown');
    window.__clips = [];
    HTMLMediaElement.prototype.load = function () {};
    HTMLMediaElement.prototype.pause = function () { this.__pauseCount = (this.__pauseCount || 0) + 1; };
    HTMLMediaElement.prototype.play = function () {
      return new Promise((resolve, reject) => window.__clips.push({ audio: this, resolve, reject }));
    };
  });
  await page.route(/youtube\.com|googlevideo\.com/, route => route.abort());
  await page.goto('/');
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
  await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });
  const board = page.getByRole('region', { name: 'Santa’s Soundboard', exact: true });
  await board.scrollIntoViewIfNeeded();
  return board;
}

for (const width of [320, 390, 768, 1440]) {
  test(`soundboard preserves phrase order, readable controls and honest states at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1100 });
    const board = await open(page);
    const buttons = board.locator('.soundboard-btn');
    await expect(buttons.locator('.soundboard-btn-label')).toHaveText(labels);
    await expect(board.locator('.soundboard-now-title')).toHaveText('Choose a phrase');
    await expect(board.getByRole('button', { name: 'Stop recording' })).toBeDisabled();
    await expect(board.locator('.soundboard-waveform')).toHaveCount(0);
    const columns = await board.locator('.soundboard-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(columns).toBe(width > 760 ? 4 : width <= 360 ? 1 : 2);
    const bounds = await buttons.evaluateAll(nodes => nodes.map(node => {
      const r = node.getBoundingClientRect(), label = node.querySelector('.soundboard-btn-label');
      const text = label.getBoundingClientRect();
      return { x: r.x, right: r.right, y: r.y, width: r.width, height: r.height,
        labelRight: text.right, labelWidth: label.clientWidth, labelScroll: label.scrollWidth };
    }));
    for (const r of bounds) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.right).toBeLessThanOrEqual(width + 1);
      expect(r.height).toBeGreaterThanOrEqual(48);
      expect(r.labelRight).toBeLessThanOrEqual(r.right + 1);
      expect(r.labelScroll).toBeLessThanOrEqual(r.labelWidth + 1);
    }
    if (width === 1440) expect(new Set(bounds.map(r => Math.round(r.y))).size).toBe(5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const before = await buttons.nth(9).boundingBox();
    await buttons.nth(9).click();
    await expect(buttons.nth(9)).toHaveAttribute('aria-pressed', 'true');
    await expect(buttons.nth(9)).toHaveAttribute('aria-busy', 'true');
    await expect(board.locator('.soundboard-now-title')).toHaveText('Loading recording…');
    await expect(board.locator('.soundboard-waveform')).toHaveCount(0);
    await page.evaluate(() => window.__clips.at(-1).resolve());
    await expect(board.locator('.soundboard-now-title')).toHaveText('Merry Christmas');
    await expect(board.locator('.soundboard-waveform')).toHaveCount(1);
    await expect(buttons.nth(9).locator('.soundboard-wave-icon')).toHaveCount(1);
    const after = await buttons.nth(9).boundingBox();
    expect(after.width).toBeCloseTo(before.width, 1);
    expect(after.height).toBeCloseTo(before.height, 1);
    await expect(board.locator('.soundboard-link')).toHaveAttribute('href', 'https://apps.apple.com/gb/app/santa-radio/id1021183593');
    await expect(buttons.nth(9)).toHaveCSS('transition-duration', '0s');
    mkdirSync('generated-artifacts', { recursive: true });
    await board.screenshot({ path: `generated-artifacts/soundboard-redesign-${width}.jpg`, animations: 'disabled' });
    await board.getByRole('button', { name: 'Stop recording' }).click();
    await expect(board.locator('.soundboard-waveform')).toHaveCount(0);
    await expect(buttons.nth(9)).toHaveAttribute('aria-pressed', 'false');
  });
}

test('soundboard cancels stale loads, handles media events and supports keyboard playback', async ({ page }) => {
  const board = await open(page);
  const buttons = board.locator('.soundboard-btn');
  const stop = board.getByRole('button', { name: 'Stop recording' });
  await buttons.first().click();
  await buttons.nth(1).click();
  await page.evaluate(() => window.__clips[0].reject(new Error('Cancelled old load')));
  await expect(board.locator('.soundboard-error')).toHaveCount(0);
  await page.evaluate(() => window.__clips[1].resolve());
  await expect(buttons.nth(1)).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.__clips[0].audio.getAttribute('src'))).toBeNull();
  await buttons.nth(1).click();
  await expect(stop).toBeDisabled();
  await buttons.first().focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(buttons.first()).toBeFocused();
  expect(await buttons.first().evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
  await page.keyboard.press('Space');
  await page.evaluate(() => window.__clips.at(-1).resolve());
  await expect(board.locator('.soundboard-now-title')).toHaveText('Are you asleep');
  await page.evaluate(() => window.__clips.at(-1).audio.dispatchEvent(new Event('waiting')));
  await expect(board.locator('.soundboard-waveform')).toHaveCount(0);
  await page.evaluate(() => window.__clips.at(-1).audio.dispatchEvent(new Event('playing')));
  await expect(board.locator('.soundboard-waveform')).toHaveCount(1);
  await page.evaluate(() => window.__clips.at(-1).audio.dispatchEvent(new Event('ended')));
  await expect(stop).toBeDisabled();
  await buttons.nth(2).click();
  await page.evaluate(() => window.__clips.at(-1).reject(new Error('Unavailable')));
  await expect(board.locator('.soundboard-error')).toContainText('Could not play “Cookies”');
  await expect(stop).toBeDisabled();
  await buttons.nth(2).click();
  await page.evaluate(() => window.__clips.at(-1).resolve());
  await expect(board.locator('.soundboard-error')).toHaveCount(0);
  await page.evaluate(() => document.dispatchEvent(new Event('santa-radio:example-start')));
  await expect(stop).toBeDisabled();
  await buttons.first().click();
  await page.evaluate(() => window.__clips.at(-1).resolve());
  await page.locator('.navbar a[href="/apps"]').click();
  expect(await page.evaluate(() => window.__clips.every(clip => !clip.audio.getAttribute('src')))).toBe(true);
});
