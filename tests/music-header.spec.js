import { test, expect } from '@playwright/test';
import { songs, collectionMetadata, songsByArtistAZ, songPath } from '../src/seo/catalogue.js';

const introduction = `${songs.length} Christmas songs with lyrics, artist info and linked videos. Browse Christmas classics, pop hits and hidden gems.`;

for (const width of [1280, 390, 320]) {
  test(`music header stays compact and keeps the full total at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/christmas-music', { waitUntil: 'domcontentloaded' });
    const hero = page.locator('.music-hero');
    const description = hero.locator('.music-description');
    await expect(hero.getByRole('heading', { level: 1 })).toHaveText('Christmas Song Lyrics & Artists');
    await expect(hero.locator('.music-sub-desc')).toHaveText('Browse Hundreds of Christmas Songs');
    await expect(description).toHaveText(introduction);
    await expect(hero.locator('img, .music-hero-title')).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Breadcrumb', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Suggest a song', exact: true })).toHaveCount(0);
    await expect(page.locator('.navbar-logo-image')).toBeVisible();
    await expect(page.locator('.navbar-logo-image')).toHaveAttribute('src', '/images/santa-radio-gold-nav.webp');
    await expect(page.locator('.song-card')).toHaveCount(songs.length);

    // No empty wrapper or strip is left between the hero and catalogue.
    expect(await hero.evaluate(el => el.nextElementSibling.classList.contains('music-grid-section'))).toBe(true);
    expect(await hero.evaluate(el => el.querySelector('.music-hero-content').firstElementChild.tagName)).toBe('H1');
    const search = page.getByRole('textbox', { name: 'Search for a song or artist' });
    await expect(page.locator('.music-results-count')).toHaveCount(0);
    await expect(hero).not.toContainText('songs to explore');
    const searchBox = await search.boundingBox();
    const orderBox = await page.getByRole('group', { name: 'Song order' }).boundingBox();
    expect(orderBox.x).toBeGreaterThan(searchBox.x + searchBox.width);
    expect(Math.abs(orderBox.y + orderBox.height / 2 - searchBox.y - searchBox.height / 2)).toBeLessThan(1);
    expect(orderBox.x + orderBox.width).toBeLessThanOrEqual(width);
    await search.fill('Sinatra');
    const matches = songs.filter(s => /sinatra/i.test(s.artist) || /sinatra/i.test(s.song));
    await expect(page.locator('.song-card')).toHaveCount(matches.length);
    await expect(description).toHaveText(introduction);
    await page.getByRole('button', { name: 'Artist A–Z', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Artist A–Z', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(description).toHaveText(introduction);
    await search.fill('unfindable-song-xyz');
    await expect(page.locator('.no-results')).toBeVisible();
    await expect(description).toHaveText(introduction);
    await search.fill('');
    await expect(page.locator('.song-card')).toHaveCount(songs.length);
    await expect(page.locator('.song-card').first()).toHaveAttribute('href', songPath(songsByArtistAZ[0]));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    // Removing the visible trail must not remove the structured breadcrumb.
    const graph = await page.locator('script[type="application/ld+json"]').evaluateAll(scripts =>
      scripts.flatMap(script => JSON.parse(script.textContent)['@graph'] || []));
    expect(graph.find(node => node['@type'] === 'BreadcrumbList')).toEqual(
      collectionMetadata('music').graph.find(node => node['@type'] === 'BreadcrumbList'));
  });
}

test('other page branding, breadcrumbs and song submission stay available', async ({ page }) => {
  await page.goto('/mugshots/all', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('navigation', { name: 'Breadcrumb', exact: true })).toHaveCount(0);
  await page.goto('/mugshots/jeremy-kyle-tv-personality', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('navigation', { name: 'Breadcrumb', exact: true })).toHaveCount(0);
  await page.goto('/free-santa-message', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.brand-logo-hero')).toBeVisible();
  await expect(page.locator('.navbar-logo-image')).toBeVisible();
  await page.getByRole('link', { name: 'Submit your song', exact: true }).click();
  await expect(page).toHaveURL(/\/submit-a-song\?mode=song$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
