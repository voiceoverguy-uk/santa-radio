import { test, expect } from '@playwright/test';
import fs from 'node:fs';

async function visit(page, path = '/') {
  // Keep samples real; only replace the external live-radio stream for deterministic tests.
  await page.addInitScript(() => {
    sessionStorage.setItem('santa-radio-example-last', 'charlotte');
    const play = HTMLMediaElement.prototype.play;
    const load = HTMLMediaElement.prototype.load;
    HTMLMediaElement.prototype.load = function () {
      if (!this.src.includes('citrus3')) return load.call(this);
    };
    HTMLMediaElement.prototype.play = function () {
      if (!this.src.includes('citrus3')) return play.call(this);
      this.dispatchEvent(new Event('play'));
      this.dispatchEvent(new Event('playing'));
      return Promise.resolve();
    };
  });
  await page.route(/youtube\.com|googlevideo\.com|global\.citrus3\.com/, route => route.abort());
  await page.route('**/api/radio-metadata*', route => route.fulfill({
    json: { current: { artist: 'John Legend', title: 'Bring Me Love' },
      currentStatus: 'ready', upcoming: [], upcomingStatus: 'ready' },
  }));
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  const reject = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await reject.isVisible()) await reject.click();
}

const start = page => page.getByRole('button', { name: 'Hear an example audio message', exact: true });
const stop = page => page.getByRole('button', { name: 'Stop example message', exact: true });
const sample = page => page.locator('audio[src*="/audio/examples/"]');
const dock = page => page.getByRole('complementary', { name: 'Santa Radio player' });

for (const [path, width] of [['/', 1280], ['/free-santa-message', 390]]) {
  test(`real samples rotate with playback-only controls on ${path}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    let sampleRequests = 0;
    let downloads = 0;
    page.on('request', request => { if (request.url().includes('/audio/examples/')) sampleRequests++; });
    page.on('download', () => downloads++);
    await visit(page, path);
    await expect(start(page)).toBeVisible();
    const appearance = await start(page).evaluate(button => {
      const style = getComputedStyle(button);
      const bounds = button.getBoundingClientRect();
      return {
        height: bounds.height, left: bounds.left, right: bounds.right,
        fontSize: parseFloat(style.fontSize), shadow: style.boxShadow,
      };
    });
    expect(appearance.height).toBeGreaterThanOrEqual(56);
    expect(appearance.fontSize).toBeGreaterThanOrEqual(15);
    expect(appearance.shadow).not.toBe('none');
    expect(appearance.left).toBeGreaterThanOrEqual(0);
    expect(appearance.right).toBeLessThanOrEqual(width);
    expect(sampleRequests).toBe(0);
    for (const [variant, name] of [
      ['boy', 'Harry'], ['girl', 'Arabella'], ['ayla', 'Ayla'],
      ['mohani', 'Mohani'], ['charlotte', 'Charlotte'], ['boy', 'Harry'],
    ]) {
      await start(page).focus();
      await page.keyboard.press('Enter');
      await expect(stop(page)).toBeVisible();
      await expect(sample(page)).toHaveAttribute('src', `/audio/examples/santa-message-${variant}.mp3`);
      await expect.poll(() => sample(page).evaluate(audio => audio.currentTime)).toBeGreaterThan(0);
      const certificate = page.locator('.santa-certificate-examples__image');
      await expect(certificate).toHaveAttribute('src', `/certificates/examples/${name.toLowerCase()}.webp`);
      await expect(certificate).toHaveJSProperty('naturalWidth', 1800);
      await expect(sample(page)).not.toHaveAttribute('controls', /.*/);
      await expect(sample(page)).toHaveAttribute('controlslist', /nodownload/);
      await expect(sample(page)).toHaveJSProperty('disableRemotePlayback', true);
      await expect(page.locator('a[href*="/audio/examples/"]')).toHaveCount(0);
      if (variant === 'girl') {
        await stop(page).evaluate(el => el.scrollIntoView({ block: 'center' }));
        fs.mkdirSync('generated-artifacts', { recursive: true });
        await page.screenshot({ path: `generated-artifacts/santa-message-example-${width}.jpg` });
        await sample(page).dispatchEvent('ended');
      } else {
        await stop(page).click();
      }
      await expect(start(page)).toBeVisible();
    }
    expect(downloads).toBe(0);
  });
}

test('rotation persists between pages and navigation stops the old recording', async ({ page }) => {
  await visit(page);
  await start(page).click();
  await expect(sample(page)).toHaveAttribute('src', '/audio/examples/santa-message-boy.mp3');
  await expect.poll(() => sample(page).evaluate(audio => audio.currentTime)).toBeGreaterThan(0);
  const oldAudio = await sample(page).elementHandle();
  await page.getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'FREE Santa Message', exact: true }).click();
  await expect(page).toHaveURL(/\/free-santa-message$/);
  expect(await oldAudio.evaluate(audio => audio.paused)).toBe(true);
  await start(page).click();
  await expect(sample(page)).toHaveAttribute('src', '/audio/examples/santa-message-girl.mp3');
  await expect.poll(() => sample(page).evaluate(audio => audio.currentTime)).toBeGreaterThan(0);
  await stop(page).click();
  await start(page).click();
  await expect(sample(page)).toHaveAttribute('src', '/audio/examples/santa-message-ayla.mp3');
  await expect.poll(() => sample(page).evaluate(audio => audio.currentTime)).toBeGreaterThan(0);
  await stop(page).click();
});

test('radio pauses for the example and resumes on stop or completion', async ({ page }) => {
  await visit(page);
  await page.locator('.hero-actions').getByRole('button', { name: 'Listen Live', exact: true }).click();
  await expect(dock(page).getByRole('button', { name: 'Pause Radio', exact: true })).toBeVisible();
  await start(page).click();
  await expect.poll(() => sample(page).evaluate(audio => audio.currentTime)).toBeGreaterThan(0);
  await expect(dock(page).getByRole('button', { name: 'Listen Live', exact: true })).toBeVisible();
  await stop(page).click();
  await expect(dock(page).getByRole('button', { name: 'Pause Radio', exact: true })).toBeVisible();
  await start(page).click();
  await expect.poll(() => sample(page).evaluate(audio => audio.currentTime)).toBeGreaterThan(0);
  await sample(page).dispatchEvent('ended');
  await expect(start(page)).toBeVisible();
  await expect(dock(page).getByRole('button', { name: 'Pause Radio', exact: true })).toBeVisible();
});

test('manual radio choices stop the example and cannot be undone by a late ended event', async ({ page }) => {
  await visit(page);
  await page.locator('.hero-actions').getByRole('button', { name: 'Listen Live', exact: true }).click();
  await start(page).click();
  await expect.poll(() => sample(page).evaluate(audio => audio.currentTime)).toBeGreaterThan(0);
  const oldAudio = await sample(page).elementHandle();
  await dock(page).getByRole('button', { name: 'Listen Live', exact: true }).click();
  await expect(start(page)).toBeVisible();
  expect(await oldAudio.evaluate(audio => audio.paused)).toBe(true);
  await dock(page).getByRole('button', { name: 'Pause Radio', exact: true }).click();
  await oldAudio.dispatchEvent('ended');
  await expect(dock(page).getByRole('button', { name: 'Listen Live', exact: true })).toBeVisible();
});

test('failed playback offers retry without advancing rotation and restores the radio', async ({ page }) => {
  await visit(page);
  await page.locator('.hero-actions').getByRole('button', { name: 'Listen Live', exact: true }).click();
  await page.route('**/audio/examples/*.mp3', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  let attempted = '';
  page.on('request', request => {
    if (request.url().includes('/audio/examples/')) attempted = new URL(request.url()).pathname;
  });
  await start(page).click();
  await expect(page.getByRole('alert').filter({ hasText: /example|recording|try/i })).toBeVisible();
  expect(attempted).toBe('/audio/examples/santa-message-boy.mp3');
  await expect(start(page)).toBeEnabled();
  await expect(dock(page).getByRole('button', { name: 'Pause Radio', exact: true })).toBeVisible();
  await page.unroute('**/audio/examples/*.mp3');
  await start(page).click();
  await expect(sample(page)).toHaveAttribute('src', attempted);
  await expect.poll(() => sample(page).evaluate(audio => audio.currentTime)).toBeGreaterThan(0);
  await stop(page).click();
});

test('detached soundboard audio and examples stop each other without overlap', async ({ page }) => {
  await page.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (!this.src.includes('/audio/soundboard/')) return play.call(this);
      window.soundboardAudio = this;
      Object.defineProperty(this, 'paused', { value: false, configurable: true });
      this.pause = function () {
        Object.defineProperty(this, 'paused', { value: true, configurable: true });
      };
      return Promise.resolve();
    };
  });
  await visit(page);
  const sound = page.locator('.soundboard-btn').first();
  await sound.click();
  expect(await page.evaluate(() => window.soundboardAudio.paused)).toBe(false);
  await start(page).click();
  await expect.poll(() => sample(page).evaluate(audio => audio.currentTime)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.soundboardAudio.paused)).toBe(true);
  await expect(sound).toHaveAttribute('aria-pressed', 'false');
  const oldAudio = await sample(page).elementHandle();
  await sound.click();
  await expect(start(page)).toBeVisible();
  expect(await oldAudio.evaluate(audio => audio.paused)).toBe(true);
});
