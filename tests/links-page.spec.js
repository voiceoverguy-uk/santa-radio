import { test, expect } from '@playwright/test';

test('partner banners load, destinations match, and TuneIn requires activation', async ({ page }) => {
  await page.route('https://tunein.com/embed/**', route => route.fulfill({ contentType: 'text/html', body: '<p>TuneIn test player</p>' }));
  await page.goto('/links');
  const cards = page.locator('.partner-card');
  await expect(cards).toHaveCount(4);
  const destinations = ['https://xmasradio.mobi', 'https://www.voiceoverguy.co.uk', 'https://www.stagcommunications.co.uk/', 'https://www.internet-radio.com'];
  for (let i = 0; i < 4; i++) {
    const card = cards.nth(i);
    await expect(card.locator('a').first()).toHaveAttribute('href', destinations[i]);
    const image = card.locator('img');
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate(el => el.naturalWidth)).toBeGreaterThan(0);
  }
  await expect(page.locator('iframe')).toHaveCount(0);
  await page.getByRole('button', { name: 'Load TuneIn player' }).click();
  await expect(page.locator('iframe')).toHaveAttribute('src', 'https://tunein.com/embed/player/s252505/');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
