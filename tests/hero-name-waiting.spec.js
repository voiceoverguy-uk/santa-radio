import { test, expect } from '@playwright/test';

for (const path of ['/', '/preview/hero-name-checker']) {
  test(`pending submission keeps suggestions usable on ${path}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route(/youtube\.com|googlevideo\.com|global\.citrus3\.com/, route => route.abort());
    let releaseLookup;
    const lookupGate = new Promise(resolve => { releaseLookup = resolve; });
    await page.route('**/api/santa-names', async route => {
      await lookupGate;
      await route.fulfill({ json: {
        warning: null,
        records: ['Erin', 'Erica'].map(name => ({
          id: name.toLowerCase(), name,
          selectionToken: 'controlled-fixture-token',
          previewUrl: '/api/santa-name-preview?token=controlled-fixture-token',
        })),
      } });
    });
    await page.goto(path);
    const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
    if (await decline.isVisible()) await decline.click();
    const checker = page.locator('.hero-name-checker');
    const input = checker.getByRole('combobox');
    const status = checker.getByRole('status');
    try {
      const request = page.waitForRequest('**/api/santa-names');
      await input.fill('Er');
      await request;
      await expect(status).toHaveText('Checking Santa’s recorded names…');
      await input.press('Enter');
      await expect(status).toHaveText('Hang on! Just asking Head Elf.');
      await expect(input).toBeFocused();
      await expect(input).toHaveAttribute('aria-invalid', 'true');
      await expect(status).toHaveAttribute('aria-live', 'polite');
      releaseLookup();
      await expect(checker.getByRole('option')).toHaveCount(2);
      await input.press('ArrowDown');
      await input.press('Enter');
      await expect(input).toHaveValue('Erin');
      await expect(status).toHaveText('Yes! Santa can record for Erin.');
      await expect(input).toHaveAttribute('aria-invalid', 'false');
      await expect(input).toHaveAttribute('aria-expanded', 'false');
    } finally {
      releaseLookup();
    }
  });
}
