import { test, expect } from '@playwright/test';

test('consecutive artist navigation replaces artwork rather than accumulating images', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('santa-radio-black-friday-2026-seen', '1'));
  await page.goto('/christmas-artist/415-john-legend-what-a-wonderful-world');
  for (let step = 0; step < 8; step++) {
    const artwork = page.locator('.song-detail-artwork');
    await expect(artwork.locator(':scope > .song-artwork-enlarge')).toHaveCount(1);
    await expect(artwork.locator(':scope > dialog')).toHaveCount(1);
    await expect(artwork.locator('.song-lyrics-section[open]')).toHaveCount(0);
    const lyrics = artwork.locator('summary');
    if (await lyrics.count()) await lyrics.click();
    const next = page.locator(step < 5 ? '.song-navigation-next[href]' : '.song-navigation-previous[href]');
    const href = await next.getAttribute('href');
    await next.click();
    await expect(page).toHaveURL(new RegExp(href + '$'));
  }
  await expect(page.locator('.song-detail-artwork > .song-artwork-enlarge')).toHaveCount(1);
});
