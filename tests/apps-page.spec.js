import { test, expect } from '@playwright/test';

test('Apps has seven complete sections, real local images and app-specific downloads', async ({ page }) => {
  await page.goto('/apps');
  const titles = ['Santa Radio App', 'Santa Voicemail', 'Santa Messages', 'Christmas Radio', 'Sleeps til Santa', 'Santa Text', 'Santa Dash'];
  const ids = ['1021183593', '586387813', '1062532143', '1157967613', '949843943', '1024535991', '1057048397'];
  const amazon = ['B0158MYRBM', 'B00QFP4B18', 'B019MRFDDK', 'B01M18XUXV', 'B00R2PU0BA'];
  for (let i = 0; i < titles.length; i++) {
    const section = page.locator('section').filter({ has: page.getByRole('heading', { name: titles[i], exact: true }) });
    await expect(section).toHaveCount(1);
    const image = section.locator('img').first();
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate(el => el.naturalWidth)).toBeGreaterThan(0);
    expect(await image.getAttribute('src')).toMatch(/^\//);
    await expect(section.locator('.feature-item')).toHaveCount(6);
    await expect(section.getByRole('link', { name: /on iOS/i })).toHaveAttribute('href', new RegExp(ids[i]));
    if (amazon[i]) await expect(section.getByRole('link', { name: /on Amazon/i })).toHaveAttribute('href', new RegExp(amazon[i]));
    else await expect(section.getByRole('link', { name: /on Amazon/i })).toHaveCount(0);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('shared menus omit Stories and Video and Apps navigation preserves audio', async ({ page }) => {
  await page.goto('/mugshots/a1-singers');
  const menu = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(menu.getByRole('link', { name: 'Santa Stories' })).toHaveCount(0);
  await expect(menu.getByRole('link', { name: 'Santa Video' })).toHaveCount(0);
  await page.evaluate(() => window.savedAudio = document.querySelector('audio'));
  await menu.getByRole('link', { name: 'Apps', exact: true }).click();
  expect(await page.evaluate(() => window.savedAudio === document.querySelector('audio'))).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await menu.getByRole('button', { name: 'Open menu' }).click();
  await expect(menu.getByRole('link', { name: 'Santa Stories' })).toHaveCount(0);
  await expect(menu.getByRole('link', { name: 'Santa Video' })).toHaveCount(0);
  await expect(menu.getByRole('link', { name: 'Music', exact: true })).toBeVisible();
});
