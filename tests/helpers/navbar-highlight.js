import { expect } from '@playwright/test';

export async function expectHighlight(nav, control) {
  await expect.poll(async () => control.evaluate(el => {
    const menu = el.closest('ul');
    const style = getComputedStyle(menu, '::before');
    const matrix = new DOMMatrixReadOnly(style.transform);
    const box = el.getBoundingClientRect();
    const origin = menu.getBoundingClientRect();
    const inset = el.classList.contains('nav-message') ? 18 : 0;
    return Math.max(
      Math.abs(matrix.m41 - (box.left - origin.left + inset)),
      Math.abs(matrix.m42 - (box.bottom - origin.top + (inset ? -8 : 4))),
      Math.abs(parseFloat(style.width) - (box.width - inset * 2)),
    );
  })).toBeLessThan(1);
  expect(await nav.locator('#main-menu').evaluate(el => getComputedStyle(el, '::before').backgroundColor))
    .toBe('rgb(230, 206, 134)');
}
