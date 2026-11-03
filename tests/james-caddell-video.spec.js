import { test, expect } from '@playwright/test';
import findSong from '../src/data/findSong.js';

const slug = '462-james-m-caddell-have-yourself-a-merry-little-christmas';

for (const section of ['christmas-artist', 'christmas-karaoke-lyrics']) {
  test(`James Caddell offers the owner-supplied replacement without claiming verified playback on ${section}`, async ({ page }) => {
    const song = findSong(slug);
    expect(song.artist).toBe('James M Caddell');
    expect(song.song).toBe('Have Yourself A Merry Little Christmas');
    expect(song.youtube).toBe('kbQ0p7gDc5E');
    expect(song.youtubeEmbed).toBe(false);
    expect(song.youtubeTitle).toBeUndefined();
    await page.goto(`/${section}/${slug}`);
    await expect(page).toHaveURL(new RegExp(`/${section}/${slug}$`));
    await expect(page.locator('h1')).toContainText(song.song);
    await expect(page.locator('h1')).toContainText(song.artist);
    await expect(page.getByRole('link', { name: 'Watch on YouTube', exact: true }))
      .toHaveAttribute('href', 'https://www.youtube.com/watch?v=kbQ0p7gDc5E');
    await expect(page.getByRole('link', { name: 'Watch on YouTube', exact: true }))
      .toHaveAttribute('target', '_blank');
    await expect(page.locator('iframe[src*="youtube"]')).toHaveCount(0);
    await expect(page.getByText(song.youtubeEmbedNotice, { exact: true })).toBeVisible();
    await expect(page.getByText('Linked performance:', { exact: false })).toHaveCount(0);
    await expect(page.getByText('This video’s owner does not allow playback on other websites.', { exact: true })).toHaveCount(0);
    await expect(page.locator('a[href*="hFF9T4BiCSU"]')).toHaveCount(0);
    await expect(page.getByText('Grinch', { exact: false })).toHaveCount(0);
    if (section === 'christmas-artist') {
      await expect(page.locator('.song-detail-info p')).toHaveText(song.info);
    }
    const lyrics = page.locator(section === 'christmas-artist'
      ? '#song-lyrics pre' : '.karaoke-lyrics-text');
    if (section === 'christmas-artist') await page.locator('details summary').click();
    await expect(lyrics).toHaveText(song.lyrics);
  });
}
