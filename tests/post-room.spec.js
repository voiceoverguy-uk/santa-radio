import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { santaNotes, formatSantaNote } from '../src/data/santaNotes.js';

async function open(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => sessionStorage.setItem('santa-message-offer-shown', 'shown'));
  await page.route(/youtube\.com|googlevideo\.com/, route => route.abort());
  await page.goto('/');
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
  await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });
  await page.evaluate(() => document.fonts.ready);
  return page.locator('.contact-section');
}

for (const width of [320, 390, 768, 1440]) {
  test(`Post Room links, live handwriting and footer work at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1100 });
    const section = await open(page);
    await section.scrollIntoViewIfNeeded();
    await expect(section.getByRole('heading', { name: 'We’d love to hear from you' })).toBeVisible();
    await expect(section).toContainText('THE NORTH POLE POST ROOM');
    await expect(section).toContainText('Got a question, a festive idea or something to share? Get in touch with the Santa Radio team.');
    await expect(section).toContainText('Press, partnerships, feedback and suggestions welcome.');
    await expect(section).toContainText('A NOTE FROM SANTA');
    const contact = section.getByRole('link', { name: 'Get in touch', exact: true });
    const song = section.getByRole('link', { name: /Submit it for consideration/ });
    await expect(contact).toHaveAttribute('href', '/submit-a-song');
    await expect(song).toHaveAttribute('href', '/submit-a-song?mode=song');
    for (const link of [contact, song]) {
      const box = await link.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    const text = section.locator('.santa-note-text');
    expect(await text.evaluate(el => getComputedStyle(el).fontFamily)).toMatch(/script|hand|vibes/i);
    expect(await text.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(24);
    const initial = await section.boundingBox();
    const longest = [...santaNotes].sort((a, b) => b.length - a.length)[0];
    await text.locator('span').first().evaluate((el, note) => { el.textContent = note; }, `Santa here... ${formatSantaNote(longest, 364)}`);
    const final = await section.boundingBox();
    expect(final.height).toBeCloseTo(initial.height, 0);
    expect(await text.evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    mkdirSync('generated-artifacts', { recursive: true });
    await section.screenshot({
      path: `generated-artifacts/post-room-${width}.jpg`, animations: 'disabled',
      style: '.radio-dock, .navbar { visibility: hidden !important; }',
    });
    const footer = page.locator('footer');
    for (const name of ['News', 'Playlist', 'Voice of Santa', 'Submit your song', 'Christmas Contenders · Preview', 'Personalised Santa Video Message', 'Download the app', 'Links', 'Privacy Policy', 'Photo usage and licensing', 'Instagram', 'Facebook']) {
      await expect(footer.getByRole('link', { name, exact: true })).toHaveCount(1);
    }
    const snow = footer.getByRole('switch', { name: 'Snow', exact: true });
    const checked = await snow.getAttribute('aria-checked');
    await snow.click();
    await expect(snow).toHaveAttribute('aria-checked', checked === 'true' ? 'false' : 'true');
    await snow.click();
    await expect(snow).toHaveAttribute('aria-checked', checked);
    if (width === 390) {
      await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      expect(await text.evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
      await page.addStyleTag({ content: 'html { font-size: 100% !important; }' });
    }
    await footer.getByRole('button', { name: 'Cookie settings', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Decline optional cookies', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
    await contact.click();
    await expect(page.getByRole('radio', { name: 'General enquiry', exact: true })).toBeChecked();
    await page.goBack();
    await song.click();
    await expect(page.getByRole('radio', { name: 'Song submission', exact: true })).toBeChecked();
  });
}
