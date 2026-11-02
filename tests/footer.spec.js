import { test, expect } from '@playwright/test';

for (const width of [1280, 390, 320]) {
  test(`footer is compact and links to the correct social profiles at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/christmas-artist/not-found', { waitUntil: 'domcontentloaded' });
    const footer = page.locator('footer');
    await footer.scrollIntoViewIfNeeded();
    await expect(footer.locator('img')).toHaveCount(0);
    await expect(footer.getByRole('link', { name: 'Facebook', exact: true })).toHaveAttribute('href', 'https://www.facebook.com/santaradiouk');
    await expect(footer.getByRole('link', { name: 'Instagram', exact: true })).toHaveAttribute('href', 'https://www.instagram.com/santaradiouk/');
    await expect(footer.getByRole('link', { name: 'Twitter', exact: true })).toHaveCount(0);
    await expect(footer.getByRole('link', { name: 'Privacy Policy', exact: true })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Personalised Santa Video Message', exact: true })).toHaveCount(0);
    await expect(footer.locator('a[href*="festivestudio.co.uk"]')).toHaveCount(0);
    const snow = footer.getByRole('switch', { name: 'Snow', exact: true });
    const instagram = footer.getByRole('link', { name: 'Instagram', exact: true });
    const facebook = footer.getByRole('link', { name: 'Facebook', exact: true });
    const boxes = await Promise.all([snow, instagram, facebook].map(control => control.boundingBox()));
    for (const box of boxes) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.y + box.height / 2).toBeCloseTo(boxes[0].y + boxes[0].height / 2, 0);
    }
    expect(boxes[0].x + boxes[0].width).toBeLessThan(boxes[1].x);
    expect(boxes[1].x + boxes[1].width).toBeLessThan(boxes[2].x);
    expect((boxes[0].x + boxes[2].x + boxes[2].width) / 2).toBeCloseTo(width / 2, 0);
    const copy = await footer.locator('.footer-copy').boundingBox();
    expect(copy.y).toBeGreaterThan(boxes[0].y + boxes[0].height);
    expect(copy.x + copy.width / 2).toBeCloseTo(width / 2, 0);
    const nav = await footer.locator('.footer-links').boundingBox();
    expect(nav.y + nav.height).toBeLessThan(boxes[0].y);
    // Exclude the intentional radio-player clearance from the compactness check.
    const contentHeight = await footer.evaluate(el => el.getBoundingClientRect().height - parseFloat(getComputedStyle(el).paddingBottom));
    expect(contentHeight).toBeLessThan(width === 1280 ? 180 : 250);
    expect(await footer.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('footer controls support keyboard use and keep the snow preference', async ({ page }) => {
  await page.goto('/christmas-artist/not-found');
  await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });
  const footer = page.locator('footer');
  const snow = footer.getByRole('switch', { name: 'Snow', exact: true });
  await footer.getByRole('button', { name: 'Cookie settings', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(snow).toBeFocused();
  await expect(snow).toHaveCSS('outline-style', 'solid');
  const before = await snow.getAttribute('aria-checked');
  await page.keyboard.press('Space');
  const after = before === 'true' ? 'false' : 'true';
  await expect(snow).toHaveAttribute('aria-checked', after);
  await expect(snow.locator('.effects-toggle-state')).toHaveText(after === 'true' ? 'On' : 'Off');
  for (const name of ['Instagram', 'Facebook']) {
    await page.keyboard.press('Tab');
    const link = footer.getByRole('link', { name, exact: true });
    await expect(link).toBeFocused();
    await expect(link).toHaveCSS('outline-style', 'solid');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  }
  await page.reload();
  await expect(snow).toHaveAttribute('aria-checked', after);
  await expect(page.locator('html')).toHaveAttribute('data-effects', after === 'true' ? 'on' : 'off');
});

for (const width of [320, 240]) {
  test(`footer wraps safely with enlarged text at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/christmas-artist/not-found');
    await page.addStyleTag({ content: 'html { font-size: 200% !important; scroll-behavior: auto !important; }' });
    const footer = page.locator('footer');
    await footer.scrollIntoViewIfNeeded();
    expect(await footer.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    // The existing header is wider than 240px with 200% text; keep this check
    // focused on the footer, without hiding overflow elsewhere on the page.
    if (width >= 320) {
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    for (const control of await footer.locator('.footer-controls button, .footer-controls a').all()) {
      const box = await control.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    const row = await footer.locator('.footer-controls').boundingBox();
    const copy = await footer.locator('.footer-copy').boundingBox();
    expect(copy.y).toBeGreaterThan(row.y + row.height);
  });
}
