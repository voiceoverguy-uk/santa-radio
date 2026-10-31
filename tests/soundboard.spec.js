import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('santa-message-offer-shown', 'shown');
    localStorage.setItem('santa-message-offer-last-shown', String(Date.now()));
  });
});

for (const width of [390, 1440]) {
  test(`soundboard keeps concise copy and same-tab app navigation at ${width}px`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 1100 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
    if (await decline.isVisible()) await decline.click();
    await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });
    const board = page.getByRole('region', { name: 'Santa’s Soundboard', exact: true });
    await expect(board.getByRole('heading', { name: 'Santa’s Soundboard', exact: true })).toBeVisible();
    await expect(board.locator('.soundboard-subtitle')).toHaveText('A little Christmas magic. In Santa’s own voice.');
    await expect(board.getByText('Choose a phrase and let Santa do the talking.', { exact: true })).toHaveCount(0);
    await expect(board.getByText('Tap a phrase to play. Tap again to stop.', { exact: true })).toHaveCount(0);
    await expect(board.locator('.soundboard-btn-label')).toHaveText([
      'Are you asleep', 'Been Naughty', 'Cookies', "It's Christmas", 'Jingle Bells',
      'Making a List', 'Tis the Season', 'Very Quiet', 'Happy Holidays', 'Merry Christmas',
      'Naughty or Nice', 'What Would You Like?', 'Is Christmas Dinner Ready Yet?', 'Merry Kiss-Mas',
      'No', 'Yes', 'Are You Ready for Christmas?', 'Proper Chrimbo', 'Goodbye', 'Ho Ho Ho',
    ]);
    const spacing = await board.evaluate(el => {
      const subtitle = el.querySelector('.soundboard-subtitle').getBoundingClientRect();
      const panel = el.querySelector('.soundboard-panel').getBoundingClientRect();
      const prompt = el.querySelector('.soundboard-app-prompt').getBoundingClientRect();
      return {
        above: panel.top - subtitle.bottom,
        below: prompt.top - panel.bottom,
        emptyParagraphs: [...el.querySelectorAll('p')].filter(p => !p.textContent.trim()).length,
      };
    });
    expect(spacing.emptyParagraphs).toBe(0);
    expect(spacing.above).toBeGreaterThan(0);
    expect(spacing.above).toBeLessThanOrEqual(33);
    expect(spacing.below).toBeGreaterThan(0);
    expect(spacing.below).toBeLessThanOrEqual(28);
    const link = board.getByRole('link', { name: 'More Christmas magic in the Santa Radio app', exact: true });
    await expect(link).toHaveAttribute('href', '/apps');
    await expect(link).not.toHaveAttribute('target', '_blank');
    await expect(link.locator('[aria-hidden="true"]')).toHaveText('→');
    const pagesBefore = context.pages().length;
    await link.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await link.click();
    await expect(page).toHaveURL(/\/apps$/);
    await expect(page.getByRole('heading', { name: 'Christmas Apps', exact: true })).toBeVisible();
    expect(context.pages()).toHaveLength(pagesBefore);
  });
}

test('all soundboard buttons share the gold glow without changing size', async ({ page }) => {
  await page.goto('/');
  const rejectCookies = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await rejectCookies.isVisible()) await rejectCookies.click();
  // Keep automation's scrolling from moving the target out from under the
  // pointer mid-hover; this test checks the glow, not smooth scrolling.
  await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });
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
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(first).toBeFocused();
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
    await page.addInitScript(() => sessionStorage.setItem('santa-message-offer-shown', 'shown'));
    await page.goto(`${test.info().project.use.baseURL}/`);
    const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
    if (await decline.isVisible()) await decline.click();
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
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
  await expect(page.locator('.soundboard-btn')).toHaveCount(20);
  const files = ['asleep', 'been-naughty', 'cookies', 'its-christmas', 'jingle-bells', 'making-a-list', 'tis-the-season', 'very-quiet', 'happy-holidays', 'merry-christmas', 'naughty-or-nice', 'what-would-you-like', 'christmas-dinner-ready', 'merry-kiss-mas', 'no', 'yes', 'ready-for-christmas', 'proper-chrimbo', 'goodbye', 'ho-ho-ho'];
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
