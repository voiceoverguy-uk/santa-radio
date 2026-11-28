import { test, expect } from '@playwright/test';
for (const width of [1280, 390]) {
  test(`gallery navigation and dismissal at ${width}px`, async ({ page }) => {
    const galleryRequests = new Set();
    page.on('request', request => { if (/\/(artist-gallery|artist-artwork)\//.test(request.url())) galleryRequests.add(request.url()); });
    await page.setViewportSize({ width, height: 850 });
    await page.addLocatorHandler(page.getByRole('button', { name: 'Close Black Friday offer' }), async button => button.click());
    await page.goto('/christmas-music');
    const button = page.getByRole('button', { name: 'Artist image gallery', exact: true });
    await button.click();
    const dialog = page.getByRole('dialog', { name: 'Artist image gallery' });
    await expect(dialog).toBeVisible();
    await expect.poll(() => galleryRequests.size).toBeGreaterThanOrEqual(3);
    const picture = dialog.locator('img');
    await expect.poll(() => picture.evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
    await expect(dialog.locator('.artist-gallery__count')).toHaveCount(0);
    const nextBounds = await dialog.getByRole('button', { name: 'Next artist image' }).boundingBox();
    const imageBounds = await picture.boundingBox();
    expect(Math.abs(nextBounds.width - imageBounds.width / 2)).toBeLessThan(2);
    expect(Math.abs(nextBounds.height - imageBounds.height)).toBeLessThan(2);
    const first = await picture.getAttribute('src');
    await dialog.getByRole('button', { name: 'Next artist image' }).click();
    await expect(picture).not.toHaveAttribute('src', first);
    await page.keyboard.press('ArrowLeft');
    await expect(picture).toHaveAttribute('src', first);
    const bounds = await dialog.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `/tmp/artist-gallery-${width}.png` });
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(button).toBeFocused();
    await button.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Close artist gallery' }).click();
    await expect(dialog).not.toBeVisible();
  });
}
