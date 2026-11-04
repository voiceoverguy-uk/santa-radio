import { expect } from '@playwright/test';

export async function expectSampleWatermark(frame) {
  const watermark = frame.locator('.studio-gifts__watermark');
  await expect(watermark).toBeVisible();
  await expect(watermark).toHaveAttribute('aria-hidden', 'true');
  await expect(watermark).toHaveCSS('pointer-events', 'none');
  await expect(watermark.locator('span')).toHaveText(['SAMPLE', 'SAMPLE', 'SAMPLE']);
  const geometry = await watermark.evaluate(node => {
    const sheet = node.getBoundingClientRect().toJSON();
    return { sheet, marks: [...node.children].map(mark => ({
      rect: mark.getBoundingClientRect().toJSON(),
      size: parseFloat(getComputedStyle(mark).fontSize),
      color: getComputedStyle(mark).color,
    })) };
  });
  for (const { rect, size, color } of geometry.marks) {
    expect(size).toBeGreaterThanOrEqual(12);
    expect(color).toBe('rgba(185, 20, 35, 0.45)');
    expect(rect.left).toBeGreaterThanOrEqual(geometry.sheet.left - .5);
    expect(rect.right).toBeLessThanOrEqual(geometry.sheet.right + .5);
    expect(rect.top).toBeGreaterThanOrEqual(geometry.sheet.top - .5);
    expect(rect.bottom).toBeLessThanOrEqual(geometry.sheet.bottom + .5);
  }
}
