import { expect } from '@playwright/test';

export async function expectSampleWatermark(frame, { forcedColors = false } = {}) {
  const watermark = frame.locator('.studio-gifts__watermark');
  await expect(watermark).toBeVisible();
  await expect(watermark).toHaveAttribute('aria-hidden', 'true');
  await expect(watermark).toHaveCSS('pointer-events', 'none');
  await expect(watermark.locator('span')).toHaveText(['Preview']);
  const geometry = await watermark.evaluate(node => {
    const sheet = node.getBoundingClientRect().toJSON();
    return { sheet, marks: [...node.children].map(mark => ({
      rect: mark.getBoundingClientRect().toJSON(),
      size: parseFloat(getComputedStyle(mark).fontSize),
      color: getComputedStyle(mark).color,
      backgroundColor: getComputedStyle(mark).backgroundColor,
    })) };
  });
  for (const { rect, size, color, backgroundColor } of geometry.marks) {
    expect(size).toBeGreaterThanOrEqual(10);
    if (forcedColors) {
      expect(color).not.toBe(backgroundColor);
      expect(color).not.toBe('rgba(0, 0, 0, 0)');
      expect(backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    } else {
      expect(color).toBe('rgba(86, 76, 56, 0.85)');
    }
    expect(rect.left).toBeGreaterThanOrEqual(geometry.sheet.left - .5);
    expect(rect.right).toBeLessThanOrEqual(geometry.sheet.right + .5);
    expect(rect.top).toBeGreaterThanOrEqual(geometry.sheet.top - .5);
    expect(rect.bottom).toBeLessThanOrEqual(geometry.sheet.bottom + .5);
  }
}
