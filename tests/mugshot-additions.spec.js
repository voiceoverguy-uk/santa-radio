import { test, expect } from '@playwright/test';
import raw from '../src/data/mugshots.json' with { type: 'json' };

const names = [
  'Debbie Arnold', 'John Altman', 'Jim Davidson', 'DJ Spoony', 'Mel C',
  'James Bye', 'Kim Medcalf', 'Danny Posthill', 'Lorraine Kelly',
  'Nicky Campbell', 'Paddington Bear', 'Maddi Fearn', 'Amelle Berrabah', 'Brian Blessed',
];
const approved = new Set(['Jim Davidson', 'DJ Spoony', 'Mel C', 'Lorraine Kelly', 'Nicky Campbell', 'Brian Blessed']);

for (const name of names) {
  test(`${name} is searchable with the new portrait and supplied biography`, async ({ page, request }) => {
    const matches = raw.filter(profile => profile.artist === name);
    expect(matches).toHaveLength(1);
    const profile = matches[0];
    expect(profile.homepage).toBe(approved.has(name));
    expect(profile.image).toMatch(/\.webp$/);
    expect(profile.info).not.toMatch(/\bYES\b|A LIST/);
    const imageResponse = await request.get(profile.image);
    expect(imageResponse.status()).toBe(200);
    expect(imageResponse.headers()['content-type']).toMatch(/image\/webp/);
    await page.goto('/mugshots/all');
    await page.getByPlaceholder('Search for a Celebrity or Talent').fill(name);
    const card = page.locator(`.mugshot-card[href="/mugshots/${profile.song}"]`);
    await expect(card).toHaveCount(1);
    await expect(card).toBeVisible();
    const image = card.locator('img');
    await expect(image).toHaveAttribute('src', profile.image);
    await expect.poll(() => image.evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true);
    await card.click();
    await expect(page.locator('h1')).toHaveText(name);
    await expect(page.locator('.mugshot-detail-desc')).toHaveText(profile.info);
    const portrait = page.locator('.mugshot-detail-photo');
    await expect.poll(() => portrait.evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true);
    expect(await portrait.evaluate(node => node.currentSrc)).toMatch(/\.webp$/);
  });
}

test('Amelle keeps her original address and Paddington is not described as a real person', async ({ page }) => {
  await page.goto('/mugshots/sugarbabes-band-member-amelle-berrabah');
  await expect(page.locator('h1')).toHaveText('Amelle Berrabah');
  await page.goto('/mugshots/paddington-bear');
  await expect(page.locator('.mugshot-detail-role')).toHaveText("Beloved Children's Character");
  const schema = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(schema.some(text => /"@type"\s*:\s*"Person"[^}]*"name"\s*:\s*"Paddington Bear"/.test(text))).toBe(false);
});
