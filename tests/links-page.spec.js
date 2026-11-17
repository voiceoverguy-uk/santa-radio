import { test, expect } from '@playwright/test';

const partners = [
  { name: 'Live Online Radio', url: 'https://liveonlineradio.net/santa-radio', image: '/images/links/live-online-radio.png', description: 'Hear Santa Radio on Live Online Radio. Open our station page and press play.' },
  { name: 'Radioguide.fm', url: 'https://www.radioguide.fm/internet-radio-england/santa-radio', image: '/images/links/radioguide-fm.svg', description: 'Find Santa Radio on Radioguide.fm and enjoy Christmas music wherever you listen.' },
  { name: 'radio.net', url: 'https://uk.radio.net/s/santa', image: '/images/links/radio-net.svg', description: 'Listen to Santa Radio through our radio.net station page.' },
  { name: 'Internet Radio', url: 'https://www.internet-radio.com', image: '/images/links/internet-radio.png', description: 'Explore the Internet Radio directory and search for Santa Radio.' },
  { name: 'Santa Guy', url: 'https://www.santaguy.co.uk', image: '/images/links/santa-guy.png', description: 'Meet the voice behind Santa Radio — Guy Harris, the voice of Santa.' },
  { name: 'Stag Communications', url: 'https://www.stagcommunications.co.uk/', image: '/images/links/stag-communications.jpg', description: 'Behind the sound: creative production and radio imaging from Stag Communications.' },
];

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
  test(`partner content, accessible links and uncropped artwork at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/platforms');
    const cards = page.locator('.partner-card');
    await expect(cards).toHaveCount(6);
    for (const [i, partner] of partners.entries()) {
      const card = cards.nth(i);
      await expect(card.getByRole('heading', { level: 2 })).toHaveText(partner.name);
      if (partner.description) {
        await expect(card.locator('.partner-description')).toHaveText(partner.description);
      } else {
        await expect(card.locator('.partner-description')).toHaveCount(0);
      }
      await expect(card.getByRole('link', { name: `${partner.name} website (opens in a new tab)`, exact: true })).toHaveAttribute('href', partner.url);
      await expect(card.getByRole('link', { name: `Visit ${partner.name} (opens in a new tab)`, exact: true })).toHaveAttribute('href', partner.url);
      for (const link of await card.getByRole('link').all()) {
        await expect(link).toHaveAttribute('target', '_blank');
        await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      }
      if (partner.image) {
      const image = card.getByRole('img', { name: `${partner.name} banner`, exact: true });
      await expect(image).toHaveAttribute('src', partner.image);
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
      await expect(image).toHaveCSS('object-fit', 'contain');
      const bounds = await image.boundingBox();
      const banner = await card.locator('.partner-banner').boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(banner.x - 1);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(banner.x + banner.width + 1);
      }

    }
    await expect(page.locator('.links-page')).not.toContainText('Xmas Radio');
    await expect(page.locator('.links-page a[href*="xmasradio.mobi"]')).toHaveCount(0);
    await expect(page.locator('.links-page img[src*="xmas-radio"]')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('TuneIn remains consent-controlled and requires activation after saved permission', async ({ page }) => {
  let playerRequests = 0;
  await page.route('https://tunein.com/embed/**', route => {
    playerRequests++;
    return route.fulfill({ contentType: 'text/html', body: '<p>TuneIn test player</p>' });
  });
  await page.goto('/platforms');
  await page.locator('.marketing-consent').getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
  const section = page.locator('.links-tunein');
  const frame = section.locator('iframe');
  await expect(section.getByRole('heading', { name: 'Santa Radio on TuneIn', exact: true })).toBeVisible();
  await expect(section.getByRole('link', { name: 'Open Santa Radio on TuneIn (opens in a new tab)', exact: true })).toHaveAttribute('href', 'https://tunein.com/radio/Santa-Radio-s252505/');
  await expect(frame).toHaveCount(0);
  await expect(section.getByRole('button', { name: 'Load TuneIn player', exact: true })).toHaveCount(0);
  expect(playerRequests).toBe(0);
  await section.getByRole('button', { name: 'Enable external media', exact: true }).click();
  await expect(frame).toHaveAttribute('src', 'https://tunein.com/embed/player/s252505/');
  await expect.poll(() => playerRequests).toBe(1);
  await section.getByRole('button', { name: 'Unload TuneIn player', exact: true }).click();
  await expect(frame).toHaveCount(0);
  await page.reload();
  const load = section.getByRole('button', { name: 'Load TuneIn player', exact: true });
  await expect(load).toBeVisible();
  await expect(frame).toHaveCount(0);
  expect(playerRequests).toBe(1);
  await load.click();
  await expect(frame).toHaveAttribute('title', 'Santa Radio TuneIn player');
  await expect.poll(() => playerRequests).toBe(2);
  await page.locator('footer').getByRole('button', { name: 'Cookie settings', exact: true }).click();
  await page.locator('.marketing-consent').getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
  await expect(frame).toHaveCount(0);
});
