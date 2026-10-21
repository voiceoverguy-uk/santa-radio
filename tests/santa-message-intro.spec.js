import { test, expect } from '@playwright/test';

const introduction = 'A real recorded greeting from Santa, not an AI voice, with your child’s name in it. Open the message desk with your adult contact details, then choose a recorded name, listen together and download your free MP3.';

for (const width of [320, 390, 768, 1440]) {
  test(`recorded voice introduction is clear and contained at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/free-santa-message');
    const intro = page.locator('.message-intro');
    const heading = intro.locator('h2');
    await expect(heading).toHaveText('FREE Personalised message from Santa');
    const subheading = intro.locator('h2 + h3.santa-message-subheading');
    await expect(subheading).toHaveText('Their name.Santa’s voice.');
    await expect(subheading.locator('br')).toHaveCount(1);
    await expect(intro.locator('.eyebrow')).toHaveText('A little North Pole experiment');
    const paragraph = intro.locator(':scope > p').nth(1);
    await expect(paragraph).toHaveText(introduction);
    await expect(paragraph).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const hierarchy = await intro.evaluate(node => {
      const main = node.querySelector('h2');
      const sub = node.querySelector('h3');
      return {
        mainSize: parseFloat(getComputedStyle(main).fontSize),
        subSize: parseFloat(getComputedStyle(sub).fontSize),
        mainBottom: main.getBoundingClientRect().bottom,
        subTop: sub.getBoundingClientRect().top,
        lines: sub.innerText,
      };
    });
    expect(hierarchy.subSize).toBeLessThan(hierarchy.mainSize * .75);
    expect(hierarchy.subTop).toBeGreaterThan(hierarchy.mainBottom);
    expect(hierarchy.lines).toBe('Their name.\nSanta’s voice.');
    const example = intro.getByRole('button', { name: 'Hear an example message', exact: true });
    await expect(example).toBeVisible();
    await expect(example).toBeEnabled();
    for (const element of [heading, subheading, paragraph, example]) {
      const bounds = await element.evaluate(node => {
        const rect = node.getBoundingClientRect();
        return { left: rect.left, right: rect.right, viewport: innerWidth,
          scrollWidth: node.scrollWidth, clientWidth: node.clientWidth };
      });
      expect(bounds.left).toBeGreaterThanOrEqual(0);
      expect(bounds.right).toBeLessThanOrEqual(bounds.viewport);
      expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.clientWidth + 1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await expect(page.getByRole('button', { name: 'Get my free Santa message' })).toBeVisible();
    await expect(page.getByLabel('Child’s first name')).toHaveCount(0);
  });
}
