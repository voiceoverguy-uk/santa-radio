import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    sessionStorage.setItem('santa-message-offer-shown', 'shown');
    localStorage.setItem('santaradio-cookie-consent-v2', JSON.stringify({
      version: 2, analytics: false, marketing: false, media: false, savedAt: Date.now(),
    }));
  });
});

for (const path of ['/', '/free-santa-message']) {
test(`${path} message heading has visible balanced gold rules beside its decorative star`, async ({ page }) => {
  await page.goto(path);
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });
  const divider = page.locator('.message-intro-divider');
  await expect(divider).toHaveAttribute('aria-hidden', 'true');
  await expect(divider).toHaveText('★');
  await expect(page.locator('.message-intro > .eyebrow + .message-intro-divider + h2')).toHaveText('FREE Personalised message from Santa');
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(divider).toBeVisible();
    const geometry = await divider.evaluate(el => {
      const box = el.getBoundingClientRect();
      const rule = pseudo => {
        const style = getComputedStyle(el, pseudo);
        return {
          width: parseFloat(style.width), height: parseFloat(style.height),
          display: style.display, visibility: style.visibility,
          opacity: parseFloat(style.opacity), content: style.content,
          background: style.backgroundImage,
        };
      };
      return {
        fits: box.width <= el.parentElement.clientWidth,
        width: box.width, before: rule('::before'), after: rule('::after'),
      };
    });
    expect(geometry.fits).toBe(true);
    expect(geometry.before.width).toBeCloseTo(geometry.after.width, 1);
    for (const rule of [geometry.before, geometry.after]) {
      expect(rule.width).toBeGreaterThan(40);
      expect(rule.width).toBeLessThan(geometry.width / 2);
      expect(rule.height).toBe(1);
      expect(rule.display).not.toBe('none');
      expect(rule.visibility).toBe('visible');
      expect(rule.opacity).toBe(1);
      expect(rule.content).toBe('""');
      expect(rule.background).toContain('linear-gradient');
    }

    // Check painted pixels too: gradient declarations alone can pass when a
    // pseudo-element has collapsed or is transparent. Each inner rule should
    // contain gold pixels, independently of the star in the centre.
    const image = await divider.screenshot({ animations: 'disabled' });
    const painted = await page.evaluate(async ({ data, before, after }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      const countGold = (start, end) => {
        let count = 0;
        const { data } = context.getImageData(0, 0, image.width, image.height);
        for (let y = 0; y < image.height; y++) {
          for (let x = Math.ceil(start); x < Math.floor(end); x++) {
            const i = (y * image.width + x) * 4;
            if (data[i] > 100 && data[i + 1] > 90 &&
                data[i] > data[i + 2] * 1.25) count++;
          }
        }
        return count;
      };
      return [
        countGold(before / 2, before - 2),
        countGold(image.width - after + 2, image.width - after / 2),
      ];
    }, { data: image.toString('base64'), before: geometry.before.width, after: geometry.after.width });
    expect(painted[0], 'left gold rule is painted').toBeGreaterThan(15);
    expect(painted[1], 'right gold rule is painted').toBeGreaterThan(15);
  }
});
}
