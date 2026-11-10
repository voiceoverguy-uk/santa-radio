import { test, expect } from '@playwright/test';

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  for (const shellOnly of [false, true]) {
    test(`staff ${shellOnly ? 'shell' : 'page'} clears navigation at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      if (shellOnly) {
        await page.route('**/src/pages/SantaStaffBrowser.jsx*', route => route.abort());
      }
      await page.goto('/request-names');
      const content = page.locator(shellOnly ? '.santa-staff-loading' : '.staff-wrap').first();
      await expect(content).toBeVisible();
      await expect.poll(async () => {
        const top = await content.evaluate(element => element.getBoundingClientRect().top);
        const bottom = await page.locator('.navbar').evaluate(element => element.getBoundingClientRect().bottom);
        return top - bottom;
      }).toBeGreaterThanOrEqual(16);
    });
  }
}
