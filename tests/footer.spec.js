import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

async function checkBottomSpacing(page) {
  // Measure at the real document bottom, not scrollIntoView's chosen position.
  await expect.poll(() => page.evaluate(() => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
    const footer = document.querySelector('footer');
    const copy = footer.querySelector('.footer-copy');
    const dock = document.querySelector('.radio-dock').getBoundingClientRect();
    const footerBox = footer.getBoundingClientRect();
    const gap = footerBox.bottom - copy.getBoundingClientRect().bottom;
    const range = document.createRange();
    range.selectNodeContents(copy);
    const boxes = [
      ...[...footer.querySelectorAll('a, button')].map(el => el.getBoundingClientRect()),
      ...range.getClientRects(),
    ];
    const sharedColumn = boxes.filter(box => box.right > dock.left && box.left < dock.right);
    const nearest = Math.min(...sharedColumn.map(box => dock.top - box.bottom));
    return {
      atBottom: Math.abs(footerBox.bottom - innerHeight) < 1,
      // Include ALL bottom padding. A larger gap is justified only if moving
      // the content down would reduce actual dock clearance below 12px.
      compact: gap >= 19 && gap <= Math.max(20, innerHeight - dock.top + 12) + 1 &&
        (gap <= 21 || Math.abs(nearest - 12) <= 2),
      clear: sharedColumn.every(box => box.bottom <= dock.top - 11),
      finalLine: footer.lastElementChild === copy,
    };
  })).toEqual({ atBottom: true, compact: true, clear: true, finalLine: true });
}

for (const path of ['/christmas-artist/not-found', '/']) {
for (const width of [1280, 390, 320]) {
  test(`footer is compact and links to the correct social profiles at ${width}px on ${path}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });
    const footer = page.locator('footer');
    await footer.scrollIntoViewIfNeeded();
    await expect(footer.locator('img')).toHaveCount(0);
    await expect(footer.getByRole('link', { name: 'Facebook', exact: true })).toHaveAttribute('href', 'https://www.facebook.com/santaradiouk');
    await expect(footer.getByRole('link', { name: 'Instagram', exact: true })).toHaveAttribute('href', 'https://www.instagram.com/santaradiouk/');
    await expect(footer.getByRole('link', { name: 'Twitter', exact: true })).toHaveCount(0);
    await expect(footer.getByRole('link', { name: 'Privacy Policy', exact: true })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Personalised Santa Video Message', exact: true })).toHaveCount(0);
    await expect(footer.locator('a[href*="festivestudio.co.uk"]')).toHaveCount(0);
    const snow = footer.getByRole('switch', { name: 'Snow', exact: true });
    const instagram = footer.getByRole('link', { name: 'Instagram', exact: true });
    const facebook = footer.getByRole('link', { name: 'Facebook', exact: true });
    const boxes = await Promise.all([snow, instagram, facebook].map(control => control.boundingBox()));
    for (const box of boxes) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.y + box.height / 2).toBeCloseTo(boxes[0].y + boxes[0].height / 2, 0);
    }
    expect(boxes[0].x + boxes[0].width).toBeLessThan(boxes[1].x);
    expect(boxes[1].x + boxes[1].width).toBeLessThan(boxes[2].x);
    expect((boxes[0].x + boxes[2].x + boxes[2].width) / 2).toBeCloseTo(width / 2, 0);
    const copy = await footer.locator('.footer-copy').boundingBox();
    expect(copy.y).toBeGreaterThan(boxes[0].y + boxes[0].height);
    expect(copy.x + copy.width / 2).toBeCloseTo(width / 2, 0);
    const nav = await footer.locator('.footer-links').boundingBox();
    expect(nav.y + nav.height).toBeLessThan(boxes[0].y);
    const height = await footer.evaluate(el => el.getBoundingClientRect().height);
    const maximumHeight = width === 1280 ? 220 : path === '/' ? (width === 390 ? 430 : 530) : 350;
    expect(height).toBeLessThan(maximumHeight);
    await checkBottomSpacing(page);
    expect(await footer.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    sessionStorage.setItem('santa-message-offer-shown', 'shown');
    localStorage.setItem('santaradio-cookie-consent-v2', JSON.stringify({
      version: 2, analytics: false, marketing: false, media: false, savedAt: Date.now(),
    }));
  });
});

for (const enlarged of [false, true]) {
  for (const width of enlarged ? [1280, 390, 320] : [1440, 1280, 1024, 901, 768, 390, 320]) {
    test(`homepage footer clears both radio sizes at ${width}px${enlarged ? ' with 200% text' : ''}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('/');
      await page.addStyleTag({ content: `html { scroll-behavior: auto !important; ${enlarged ? 'font-size: 200% !important;' : ''} }` });
      await page.evaluate(() => document.fonts.ready);
      const footer = page.locator('footer');
      const dock = page.getByRole('complementary', { name: 'Santa Radio player' });
      await expect(dock).toHaveClass(/is-minimized/);
      for (const expanded of [false, true, false]) {
        if (expanded) await dock.getByRole('button', { name: 'Expand radio player', exact: true }).click();
        else if (!(await dock.getAttribute('class')).includes('is-minimized')) {
          await dock.getByRole('button', { name: 'Minimise radio player', exact: true }).click();
        }
        await checkBottomSpacing(page);
        expect(await footer.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
        // The homepage's separate 320px/200% overflow issue is tracked
        // independently; do not mask it or change other sections here.
        if (!enlarged || width > 320) {
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        }
        const nav = await footer.locator('.footer-links').boundingBox();
        const row = await footer.locator('.footer-controls').boundingBox();
        const copy = await footer.locator('.footer-copy').boundingBox();
        expect(nav.y + nav.height).toBeLessThan(row.y);
        expect(row.y + row.height).toBeLessThan(copy.y);
        for (const control of await footer.locator('a, button').all()) {
          if (enlarged) {
            // The complete enlarged footer plus expanded dock can be taller
            // than the viewport. Earlier links must remain reachable by
            // scrolling up, not be hidden under the sticky header.
            await control.evaluate(el => {
              const headerBottom = document.querySelector('.navbar').getBoundingClientRect().bottom;
              const dockTop = document.querySelector('.radio-dock').getBoundingClientRect().top;
              const box = el.getBoundingClientRect();
              const availableCentre = (headerBottom + dockTop) / 2;
              window.scrollBy({ top: box.top + box.height / 2 - availableCentre, behavior: 'instant' });
            });
          }
          // Hit testing catches actual interception, not just viewport visibility.
          expect(await control.evaluate(el => {
            const box = el.getBoundingClientRect();
            const target = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
            return el.contains(target);
          })).toBe(true);
        }
        await checkBottomSpacing(page);
        const snow = footer.getByRole('switch', { name: 'Snow', exact: true });
        const checked = await snow.getAttribute('aria-checked');
        await snow.click();
        await expect(snow).toHaveAttribute('aria-checked', checked === 'true' ? 'false' : 'true');
        if (!enlarged && [1280, 390].includes(width)) {
          mkdirSync('generated-artifacts', { recursive: true });
          await page.screenshot({ path: `generated-artifacts/homepage-footer-${width}-${expanded ? 'expanded' : 'minimised'}.jpg` });
        }
      }
      await footer.getByRole('button', { name: 'Cookie settings', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Decline optional cookies', exact: true })).toBeVisible();
    });
  }
}

test('Studio footer stays hidden on phones and visible on desktop, without player clearance', async ({ page }) => {
  await page.goto('/santa-message-workshop');
  const footer = page.locator('footer');
  for (const width of [390, 760, 761, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    if (width <= 760) await expect(footer).toBeHidden();
    else {
      await expect(footer).toBeVisible();
      await expect(footer).toHaveCSS('padding-bottom', '20px');
    }
  }
  await page.goto('/');
  await checkBottomSpacing(page);
});

test('footer controls support keyboard use and keep the snow preference', async ({ page }) => {
  await page.goto('/christmas-artist/not-found');
  await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });
  const footer = page.locator('footer');
  const snow = footer.getByRole('switch', { name: 'Snow', exact: true });
  await footer.getByRole('button', { name: 'Cookie settings', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(snow).toBeFocused();
  await expect(snow).toHaveCSS('outline-style', 'solid');
  const before = await snow.getAttribute('aria-checked');
  await page.keyboard.press('Space');
  const after = before === 'true' ? 'false' : 'true';
  await expect(snow).toHaveAttribute('aria-checked', after);
  await expect(snow.locator('.effects-toggle-state')).toHaveText(after === 'true' ? 'On' : 'Off');
  for (const name of ['Instagram', 'Facebook']) {
    await page.keyboard.press('Tab');
    const link = footer.getByRole('link', { name, exact: true });
    await expect(link).toBeFocused();
    await expect(link).toHaveCSS('outline-style', 'solid');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  }
  await page.reload();
  await expect(snow).toHaveAttribute('aria-checked', after);
  await expect(page.locator('html')).toHaveAttribute('data-effects', after === 'true' ? 'on' : 'off');
});

for (const width of [320, 240]) {
  test(`footer wraps safely with enlarged text at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/christmas-artist/not-found');
    await page.addStyleTag({ content: 'html { font-size: 200% !important; scroll-behavior: auto !important; }' });
    const footer = page.locator('footer');
    await footer.scrollIntoViewIfNeeded();
    expect(await footer.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    // The existing header is wider than 240px with 200% text; keep this check
    // focused on the footer, without hiding overflow elsewhere on the page.
    if (width >= 320) {
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    for (const control of await footer.locator('.footer-controls button, .footer-controls a').all()) {
      const box = await control.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    const row = await footer.locator('.footer-controls').boundingBox();
    const copy = await footer.locator('.footer-copy').boundingBox();
    expect(copy.y).toBeGreaterThan(row.y + row.height);
  });
}
