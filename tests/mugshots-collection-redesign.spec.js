import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { buildCatalogue } from '../src/data/mugshot-catalogue.js';

const { catalogue } = buildCatalogue(JSON.parse(fs.readFileSync('src/data/mugshots.json', 'utf8')));

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => sessionStorage.setItem('santa-message-offer-shown', 'shown'));
  await page.goto('/mugshots/all');
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
  await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });
});

for (const width of [320, 390, 768, 1440]) {
  test(`collection header and functional gallery fit ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1100 });
    const main = page.locator('main');
    await expect(main.getByRole('heading', { level: 1 })).toHaveText('Celebrity Mugshots');
    await expect(main).toContainText('THE SANTA RADIO HALL OF FAME');
    await expect(main).toContainText('Famous faces. One festive mug.');
    await expect(main).toContainText('Ecurb the Elf has been out meeting famous faces with our Santa Radio mug. Explore the collection from TV, radio, music, comedy and sport.');
    await expect(main.locator('.mugshots-count .count-num')).toHaveText(String(catalogue.length));
    await expect(main.locator('.mugshots-count')).toContainText('mugshots and counting');
    await expect(page.locator('.mugshots-page-logo, .mugshots-page-logo-wrap')).toHaveCount(0);
    await expect(page.locator('.navbar .navbar-logo-image')).toBeVisible();
    const search = main.getByRole('textbox', { name: 'Find a famous face', exact: true });
    await expect(search).toHaveAttribute('placeholder', 'Search by name or talent…');
    const shuffle = main.getByRole('button', { name: 'Shuffle', exact: true });
    const az = main.getByRole('button', { name: 'A–Z', exact: true });
    await expect(shuffle).toHaveAttribute('aria-pressed', 'true');
    await expect(az).toHaveAttribute('aria-pressed', 'false');
    for (const control of [search, shuffle, az]) {
      const box = await control.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
    }
    await search.focus();
    await page.keyboard.press('Tab');
    await expect(shuffle).toBeFocused();
    expect(await shuffle.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
    await page.keyboard.press('Tab');
    await expect(az).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(az).toHaveAttribute('aria-pressed', 'true');
    const cards = page.locator('.mugshots-grid .mugshot-card');
    await expect(cards).toHaveCount(100);
    if (width === 1440) expect((await cards.first().boundingBox()).y).toBeLessThan(660);
    const first = catalogue.find(person => person.artist === 'Jeremy Kyle');
    await search.fill('Jeremy Kyle');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toHaveAttribute('href', `/mugshots/${first.song}`);
    await expect(cards.locator('img')).toHaveAttribute('src', first.image);
    await expect(cards.locator('.mugshot-info strong')).toHaveText(first.artist);
    await expect(cards.locator('.mugshot-info span')).toHaveText(first.link);
    await search.fill('no-such-famous-face-1099');
    await expect(cards).toHaveCount(0);
    await expect(main.locator('.no-results')).toContainText('No celebrities found');
    await expect(main.getByRole('button', { name: /Load More/ })).toHaveCount(0);
    await search.fill('');
    await expect(cards).toHaveCount(100);
    await shuffle.click();
    await expect(shuffle).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.evaluate(() => window.scrollTo(0, 0));
    fs.mkdirSync('generated-artifacts', { recursive: true });
    await page.screenshot({
      path: `generated-artifacts/mugshots-collection-${width}.jpg`, animations: 'disabled',
      style: '.radio-dock { visibility: hidden !important; }',
    });
    if (width === 390) {
      await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.addStyleTag({ content: 'html { font-size: 100% !important; }' });
    }
    const before = await cards.evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
    await main.getByRole('button', { name: /Load More/ }).click();
    await expect(cards).toHaveCount(200);
    const after = await cards.evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
    expect(after.slice(0, 100)).toEqual(before);
    expect(new Set(after).size).toBe(200);
    await search.fill('Jeremy Kyle');
    await cards.first().click();
    await expect(page).toHaveURL(new RegExp(`/mugshots/${first.song}$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Jeremy Kyle');
  });
}
