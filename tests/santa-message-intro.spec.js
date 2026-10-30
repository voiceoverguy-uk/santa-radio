import { test, expect } from '@playwright/test';

const introduction = 'No Artificial Intelligence here. A real Human recorded message from Santa, aka Father Christmas to your little Human. Click to enter Studio B, add your contact details, choose the name from 12,295 names available currently, create and instantly download your short FREE personalised message from Santa.';

for (const path of ['/', '/free-santa-message']) {
for (const width of [320, 390, 768, 1440]) {
  test(`recorded voice introduction is clear and contained at ${width}px on ${path}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route('**/api/santa-names?*', route => route.fulfill({ json: {
      records: [], hostedCount: 12345, warning: null,
    } }));
    await page.goto(path);
    const heroDescription = page.locator('.fsm-desc');
    if (path !== '/') {
    await expect(heroDescription).toHaveText('Create a free message from Santa with your child’s name. Choose a name, ask Santa to record it, then enjoy your personalised Santa audio greeting to download and keep.');
    }
    const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
    if (await decline.isVisible()) await decline.click();
    const intro = page.locator('.message-intro');
    const heading = intro.locator('h2');
    await expect(heading).toHaveText('FREE Personalised message from Santa');
    const subheading = intro.locator('h2 + .santa-voice-tagline h3.santa-message-subheading');
    await expect(subheading).toHaveText('Their name. Santa’s REAL VOICE.');
    await expect(intro.locator('.eyebrow')).toHaveText('A little North Pole experiment');
    const paragraph = intro.locator(':scope > p').nth(1);
    await expect(paragraph).toHaveText(introduction);
    await expect(intro.locator('.santa-certificate-examples')).toHaveCount(0);
    await expect(paragraph).not.toContainText(/certificate|\(names available\)|thousands/i);
    await expect(intro.locator('.message-studio-intro')).toHaveText("Or, why not enter Studio - A and have a bespoke message from Santa?** You'll also receive some festive goodies. See below.");
    await expect(intro.locator('.message-studio-availability')).toHaveText('** Coming early November');
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
        lines: sub.innerText.trim(),
      };
    });
    expect(hierarchy.subSize).toBeLessThan(hierarchy.mainSize * .75);
    expect(hierarchy.subTop).toBeGreaterThan(hierarchy.mainBottom);
    expect(hierarchy.lines).toBe('Their name. Santa’s REAL VOICE.');
    const example = intro.getByRole('button', { name: 'Hear an example audio message', exact: true });
    await expect(example).toBeVisible();
    await expect(example).toBeEnabled();
    await expect(intro.locator('.santa-voice-tagline + .santa-message-example + p')).toHaveText(introduction);
    for (const element of [heading, subheading, paragraph, example, ...(path === '/' ? [] : [heroDescription])]) {
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
    await expect(page.locator('.message-name-label')).toHaveCount(0);
  });
}
}
