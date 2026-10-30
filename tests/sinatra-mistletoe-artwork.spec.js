import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const artwork = '/artist-artwork/frank-sinatra-mistletoe-and-holly.webp';
const detail = '/christmas-artist/236-frank-sinatra-mistletoe-and-holly';

async function squareImage(image, path) {
  await expect.poll(() => image.evaluate(el => new URL(el.src).pathname)).toBe(path);
  await expect.poll(() => image.evaluate(el => el.complete &&
    el.naturalWidth === 512 && el.naturalHeight === 512)).toBe(true);
  await image.scrollIntoViewIfNeeded();
  const box = await image.boundingBox();
  expect(Math.abs(box.width - box.height)).toBeLessThanOrEqual(1);
}

for (const width of [1280, 390]) {
  test(`Sinatra Mistletoe card, detail and enlarged composition at ${width}px`, async ({ page }) => {
    await mkdir('generated-artifacts/sinatra-mistletoe', { recursive: true });
    await page.setViewportSize({ width, height: 900 });
    await page.route(/youtube\.com|googlevideo\.com|global\.citrus3\.com/, route => route.abort());
    await page.goto('/christmas-music', { waitUntil: 'domcontentloaded' });
    const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
    if (await decline.isVisible()) await decline.click();
    await page.getByRole('textbox', { name: 'Search for a song or artist' }).fill('Mistletoe And Holly');
    const card = page.locator(`.song-card[href="${detail}"]`);
    await squareImage(card.locator('img'), artwork);
    await expect(page.locator('.song-card[href*="/237-"] img')).not.toHaveAttribute('src', artwork);
    await card.screenshot({ path: `generated-artifacts/sinatra-mistletoe/card-${width}.png` });
    await card.click();
    await squareImage(page.locator('.song-detail-artwork img'), artwork);
    await page.locator('.song-detail-artwork').screenshot({
      path: `generated-artifacts/sinatra-mistletoe/detail-${width}.png`,
    });
    await page.getByRole('button', { name: 'Enlarge artwork for Mistletoe And Holly by Frank Sinatra' }).click();
    const dialog = page.getByRole('dialog', { name: 'Artwork for Mistletoe And Holly by Frank Sinatra' });
    await expect(dialog).toBeVisible();
    await squareImage(dialog.locator('img'), artwork);
    const bounds = await dialog.locator('img').boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `generated-artifacts/sinatra-mistletoe/enlarged-${width}.png` });
    await dialog.getByRole('button', { name: 'Close enlarged artwork' }).click();
    await expect(dialog).not.toBeVisible();
  });
}
