import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { buildCatalogue } from '../src/data/mugshot-catalogue.js';

const catalogue = buildCatalogue(JSON.parse(fs.readFileSync('src/data/mugshots.json', 'utf8'))).catalogue;
const sectionSelector = '.mugshots-preview';
const cardsSelector = `${sectionSelector} .mug-card`;

async function prepare(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('https://www.youtube.com/embed/**', route => route.fulfill({ contentType: 'text/html', body: '' }));
  await page.goto('/');
  await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });
}

test('approved copy is live text with no retired icon or wrapper', async ({ page }) => {
  await prepare(page);
  const section = page.locator(sectionSelector);
  for (const copy of [
    'THE SANTA RADIO HALL OF FAME',
    'Famous faces. One festive mug.',
    'Our autograph-hunting elf has been busy. Discover hundreds of familiar faces with the Santa Radio mug.',
    'Hundreds of famous faces. Who will you spot?',
  ]) await expect(section.getByText(copy, { exact: true })).toBeVisible();
  await expect(section.getByRole('heading', { name: 'Celebrity Mugshots', exact: true })).toBeVisible();
  await expect(section.getByRole('link', { name: 'Explore the Celebrity Mugshots', exact: true }))
    .toHaveAttribute('href', '/mugshots/all');
  await expect(section.locator('.mugshots-logo, .mugshots-header-img, img[src*="santa-mugshots-logo"]')).toHaveCount(0);
  const decoration = section.locator('.mugshots-pine-corner');
  await expect(decoration).toHaveCount(2);
  for (const corner of await decoration.all()) {
    await expect(corner).toHaveAttribute('aria-hidden', 'true');
    await expect(corner).toHaveAttribute('focusable', 'false');
    expect(await corner.evaluate(node => getComputedStyle(node).pointerEvents)).toBe('none');
  }
  for (const link of [section.locator('.mug-card').first(), section.locator('.mugshots-gallery-button')]) {
    expect(await link.evaluate(node => getComputedStyle(node).transitionDuration)).toBe('0s');
  }
});

test('four original photographs retain approved record bindings and all five destinations work', async ({ page }) => {
  await prepare(page);
  const cards = page.locator(cardsSelector);
  await expect(cards).toHaveCount(4);
  const records = await cards.evaluateAll(elements => elements.map(card => ({
    href: card.getAttribute('href'),
    src: card.querySelector('img')?.getAttribute('src'),
    alt: card.querySelector('img')?.getAttribute('alt'),
    name: card.querySelector('.mug-info strong')?.textContent,
    role: card.querySelector('.mug-info span')?.textContent,
  })));
  expect(new Set(records.map(record => record.href)).size).toBe(4);
  for (const record of records) {
    const profile = catalogue.find(item => `/mugshots/${item.song}` === record.href);
    expect(profile?.homepage).toBe(true);
    expect(record.src).toBe(profile.image);
    expect(record.name).toBe(profile.artist);
    expect(record.role).toBe(profile.link);
    expect(record.alt).toContain(profile.artist);
    const link = page.locator(cardsSelector).filter({ has: page.locator(`img[src="${profile.image}"]`) });
    // Open real links in new tabs so the original random sample stays mounted.
    const [profilePage] = await Promise.all([
      page.context().waitForEvent('page'),
      link.click({ modifiers: ['Control'] }),
    ]);
    await expect(profilePage).toHaveURL(new RegExp(`${record.href}$`));
    await expect(profilePage.getByRole('heading', { level: 1 })).toHaveText(profile.artist);
    await profilePage.close();
  }
  await page.locator(sectionSelector).getByRole('link', { name: 'Explore the Celebrity Mugshots', exact: true }).click();
  await expect(page).toHaveURL(/\/mugshots\/all$/);
  await expect(page.locator('.mugshots-page-hero')).toBeVisible();
});

test('sampling is stable during interaction and runs again on reload without a history policy', async ({ page }) => {
  // Deterministic randomness makes this about resampling, not the chance of repetition.
  await page.addInitScript(() => {
    const count = Number(sessionStorage.getItem('mugshots-test-loads') || '0');
    sessionStorage.setItem('mugshots-test-loads', String(count + 1));
    Math.random = () => count === 0 ? 0.1 : 0.9;
  });
  await prepare(page);
  const cards = page.locator(cardsSelector);
  const hrefs = () => cards.evaluateAll(items => items.map(item => item.getAttribute('href')));
  const first = await hrefs();
  await cards.first().hover();
  await page.getByRole('switch', { name: 'Snow' }).click();
  expect(await hrefs()).toEqual(first);
  await page.reload();
  await expect(cards).toHaveCount(4);
  const second = await hrefs();
  expect(second).not.toEqual(first);
  await page.reload();
  await expect(cards).toHaveCount(4);
  expect(await hrefs()).toEqual(second);
});

for (const width of [1440, 768, 390, 320]) {
  test(`photo-led layout and keyboard access at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await prepare(page);
    const section = page.locator(sectionSelector);
    const cards = page.locator(cardsSelector);
    await expect(cards).toHaveCount(4);
    await cards.first().scrollIntoViewIfNeeded();
    await expect.poll(() => cards.locator('img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0))).toBe(true);
    const bounds = await cards.evaluateAll(items => items.map(item => {
      const box = item.getBoundingClientRect();
      const image = item.querySelector('img');
      return { x: box.x, y: box.y, right: box.right, width: box.width, fit: getComputedStyle(image).objectFit };
    }));
    expect(bounds.every(box => box.x >= 0 && box.right <= width + 1)).toBe(true);
    expect(bounds.every(box => box.fit === 'contain')).toBe(true);
    expect(await cards.evaluateAll(items => items.every(item => {
      const photo = item.querySelector('img').getBoundingClientRect();
      const name = item.querySelector('strong').getBoundingClientRect();
      const role = item.querySelector('.mug-info > span').getBoundingClientRect();
      const card = item.getBoundingClientRect();
      return name.top >= photo.bottom - 1 && role.bottom <= card.bottom + 1 &&
        name.left >= card.left && name.right <= card.right + 1;
    }))).toBe(true);
    if (width >= 1024) expect(new Set(bounds.map(box => Math.round(box.y))).size).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    // Start immediately before the first card, then use genuine keyboard navigation.
    await page.evaluate(() => {
      const marker = document.createElement('button');
      marker.id = 'focus-test-marker';
      document.querySelector('.mugshots-grid').before(marker);
      marker.focus();
    });
    for (let index = 0; index < 5; index++) {
      await page.keyboard.press('Tab');
      const link = index < 4 ? cards.nth(index) : section.getByRole('link', { name: 'Explore the Celebrity Mugshots', exact: true });
      await expect(link).toBeFocused();
      expect(await link.evaluate(element => {
        const style = getComputedStyle(element);
        return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2;
      })).toBe(true);
    }
    await page.locator('#focus-test-marker').evaluate(element => element.remove());
  });
}

test('failed portraits retain meaningful fallback and working profile links', async ({ page }) => {
  await page.route('**/mugshot-images/**', route => route.abort());
  await page.route('**/mugshot-thumbnails/**', route => route.abort());
  await prepare(page);
  const cards = page.locator(cardsSelector);
  await expect(cards.locator('.portrait-fallback')).toHaveCount(4);
  const first = cards.first();
  const name = await first.locator('.mug-info strong').textContent();
  await expect(first.getByRole('img')).toHaveAccessibleName(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  const href = await first.getAttribute('href');
  await first.click();
  await expect(page).toHaveURL(new RegExp(`${href}$`));
});
