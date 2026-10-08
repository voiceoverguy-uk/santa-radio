import { test, expect } from '@playwright/test';

test('all soundboard buttons share the gold glow without changing size', async ({ page }) => {
  await page.goto('/');
  const buttons = page.locator('.soundboard-btn');
  await expect(buttons).toHaveCount(20);
  for (const button of await buttons.all()) {
    // Keep the target away from the fixed radio dock while checking hover.
    await button.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    const before = await button.boundingBox();
    await button.hover();
    await expect(button).toHaveCSS('border-top-color', 'rgb(230, 206, 134)');
    await expect.poll(() => button.evaluate(el => getComputedStyle(el).boxShadow)).toContain('16px 3px');
    const after = await button.boundingBox();
    expect(after.width).toBeCloseTo(before.width, 1);
    expect(after.height).toBeCloseTo(before.height, 1);
  }
  await page.mouse.move(0, 0);
  const first = buttons.first();
  await first.focus();
  await expect.poll(() => first.evaluate(el => getComputedStyle(el).boxShadow)).toContain('16px 3px');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(first).toHaveCSS('transition-duration', '0s');
  await first.evaluate(el => el.blur());
  await first.hover();
  await page.locator('.soundboard').screenshot({ path: '/tmp/soundboard-gold-glow.png' });
  // State styling takes precedence over the decorative glow.
  await first.evaluate(el => el.classList.add('active'));
  await expect.poll(() => first.evaluate(el => getComputedStyle(el).boxShadow)).not.toContain('16px 3px');
  await first.evaluate(el => { el.classList.remove('active'); el.disabled = true; });
  await expect.poll(() => first.evaluate(el => getComputedStyle(el).boxShadow)).not.toContain('16px 3px');
});

test('touch soundboard buttons do not acquire a sticky gold hover glow', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    await page.goto(`${test.info().project.use.baseURL}/`);
    await page.evaluate(() => { HTMLMediaElement.prototype.play = () => Promise.resolve(); });
    const button = page.locator('.soundboard-btn').first();
    await button.tap();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await button.tap();
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => button.evaluate(el => getComputedStyle(el).boxShadow)).not.toContain('16px 3px');
  } finally {
    await context.close();
  }
});

test('all 20 sounds are available and new clips decode and toggle', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.soundboard-btn')).toHaveCount(20);
  const files = ['christmas-dinner-ready', 'merry-kiss-mas', 'no', 'yes', 'ready-for-christmas', 'proper-chrimbo', 'goodbye', 'ho-ho-ho'];
  for (const file of files) {
    const duration = await page.evaluate(async file => {
      const context = new AudioContext();
      try {
        const response = await fetch(`/audio/soundboard/${file}.mp3`);
        if (!response.ok) throw new Error('Missing sound');
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        return buffer.duration;
      } finally { await context.close(); }
    }, file);
    expect(duration).toBeGreaterThan(0);
  }
  await page.evaluate(() => {
    window.clips = [];
    HTMLMediaElement.prototype.play = function () { window.clips.push(this); return Promise.resolve(); };
  });
  const first = page.getByRole('button', { name: 'Ho Ho Ho', exact: true });
  await first.click();
  await expect(first).toHaveAttribute('aria-pressed', 'true');
  await first.click();
  await expect(first).toHaveAttribute('aria-pressed', 'false');
  await first.click();
  const next = page.getByRole('button', { name: 'Goodbye', exact: true });
  await next.click();
  await expect(first).toHaveAttribute('aria-pressed', 'false');
  await expect(next).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.clips.slice(0, -1).every(a => !a.getAttribute('src')))).toBe(true);
  await page.evaluate(() => window.clips.at(-1).dispatchEvent(new Event('ended')));
  await expect(next).toHaveAttribute('aria-pressed', 'false');
});
