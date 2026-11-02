import { test, expect } from '@playwright/test';
import findSong from '../src/data/findSong.js';

// Ordinary title, artist ampersand, title punctuation, and a historical alias.
const slugs = [
  '551-cher-dj-play-a-christmas-song',
  '5-tom-jones-c-matthews-baby-its-cold-outside',
  '51-dean-martin-baby-its-cold-outside',
  '233-the-carpenters-merry-christmas-darling',
];

for (const slug of slugs) {
  test(`song share link opens X with canonical song details: ${slug}`, async ({ page }) => {
    await page.route('**/*youtube.com/**', route => route.abort());
    await page.goto(`/christmas-artist/${slug}`, { waitUntil: 'domcontentloaded' });

    const song = findSong(slug);
    const canonical = `https://www.santaradio.co.uk/christmas-artist/${song.id}-${song.link}`;
    const message = `Listening to ${song.song} by ${song.artist} on Santa Radio!`;
    const share = page.getByRole('link', { name: 'Share on X', exact: true });

    await expect(share).toHaveCount(1);
    await expect(share).toBeVisible();
    await expect(page.getByRole('link', { name: 'Share on Twitter', exact: true })).toHaveCount(0);
    await expect(share).toHaveClass('twitter-share-link');
    await expect(share).toHaveAttribute('target', '_blank');
    await expect(share).toHaveAttribute('rel', 'noopener noreferrer');

    const href = await share.getAttribute('href');
    const composer = new URL(href);
    expect(composer.origin + composer.pathname).toBe('https://x.com/intent/tweet');
    expect([...composer.searchParams.keys()].sort()).toEqual(['text', 'url']);
    expect(composer.searchParams.get('text')).toBe(message);
    expect(composer.searchParams.get('url')).toBe(canonical);
    expect(href).toBe(`https://x.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(canonical)}`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
    // Inspect the rendered link only: never contact X or submit a post.
  });
}
