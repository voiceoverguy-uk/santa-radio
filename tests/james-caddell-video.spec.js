import { test, expect } from '@playwright/test';
import findSong from '../src/data/findSong.js';

const slug = '462-james-m-caddell-have-yourself-a-merry-little-christmas';

for (const section of ['christmas-artist', 'christmas-karaoke-lyrics']) {
  test(`James Caddell offers his approved non-embeddable video on ${section}`, async ({ page }) => {
    const song = findSong(slug);
    expect(song.artist).toBe('James M Caddell');
    expect(song.song).toBe('Have Yourself A Merry Little Christmas');
    await page.goto(`/${section}/${slug}`);
    await expect(page.locator('h1')).toContainText(song.song);
    await expect(page.getByRole('link', { name: 'Watch on YouTube', exact: true }))
      .toHaveAttribute('href', 'https://www.youtube.com/watch?v=hFF9T4BiCSU');
    await expect(page.locator('iframe[src*="youtube"]')).toHaveCount(0);
    await expect(page.getByText('Linked performance:', { exact: false }))
      .toContainText("You're a Mean One Mr. Grinch");
    const lyrics = page.locator(section === 'christmas-artist'
      ? '#song-lyrics pre' : '.karaoke-lyrics-text');
    if (section === 'christmas-artist') await page.locator('details summary').click();
    await expect(lyrics).toHaveText(song.lyrics);
  });
}
