import { test, expect } from '@playwright/test';

const introduction = 'A real recorded greeting from Santa, not an AI voice, with your child’s name in it. Open the message desk with your adult contact details, then choose a recorded name, listen together and download your free MP3.';

for (const width of [390, 1440]) {
  test(`recorded voice introduction is clear and contained at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/free-santa-message');
    const intro = page.locator('.message-intro');
    const heading = intro.locator('h2');
    await expect(heading).toHaveText('Their name.Santa’s voice.');
    await expect(heading.locator('br')).toHaveCount(1);
    const paragraph = intro.locator(':scope > p').nth(1);
    await expect(paragraph).toHaveText(introduction);
    await expect(paragraph).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    for (const element of [heading, paragraph]) {
      const bounds = await element.evaluate(node => {
        const rect = node.getBoundingClientRect();
        return { left: rect.left, right: rect.right, viewport: innerWidth,
          scrollWidth: node.scrollWidth, clientWidth: node.clientWidth };
      });
      expect(bounds.left).toBeGreaterThanOrEqual(0);
      expect(bounds.right).toBeLessThanOrEqual(bounds.viewport);
      expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.clientWidth + 1);
    }
    await expect(page.getByRole('button', { name: 'Get my free Santa message' })).toBeVisible();
    await expect(page.getByLabel('Child’s first name')).toHaveCount(0);
  });
}
