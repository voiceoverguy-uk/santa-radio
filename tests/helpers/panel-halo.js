import { expect } from '@playwright/test';

// Check the visible halo against clipping ancestors, not the card's own
// overflow (which clips contents but never its own outer box shadow).
export async function expectHaloClearance(surface, reach = 16) {
  const clipped = await surface.evaluate((el, reach) => {
    const box = el.getBoundingClientRect();
    const clipped = [];
    for (let parent = el.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      const bounds = parent.getBoundingClientRect();
      if ((/(hidden|clip|scroll|auto)/.test(style.overflowX) &&
          (box.left - reach < bounds.left || box.right + reach > bounds.right)) ||
          (/(hidden|clip|scroll|auto)/.test(style.overflowY) &&
          (box.top - reach < bounds.top || box.bottom + reach > bounds.bottom))) {
        clipped.push(parent.tagName + '.' + parent.className);
      }
    }
    return clipped;
  }, reach);
  expect(clipped).toEqual([]);
}

export async function captureHalo(page, surface, name, testInfo) {
  await surface.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  // Centring can move the card away from the stationary pointer.
  await surface.hover({ position: { x: 8, y: 8 } });
  const box = await surface.boundingBox();
  const viewport = page.viewportSize();
  // Include the outside of the border: element screenshots omit outer glows.
  await page.screenshot({
    path: testInfo.outputPath(name),
    clip: {
      x: Math.max(0, box.x - 24), y: Math.max(0, box.y - 24),
      width: Math.min(viewport.width, box.x + box.width + 24) - Math.max(0, box.x - 24),
      height: Math.min(viewport.height, box.y + box.height + 24) - Math.max(0, box.y - 24),
    },
  });
}
