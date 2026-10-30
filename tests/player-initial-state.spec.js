import { test, expect } from '@playwright/test';

for (const width of [1280, 390]) {
  for (const saved of [null, 'false', 'true']) {
    test(`player loads closed at ${width}px with saved preference ${saved}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(saved => {
        if (saved === null) sessionStorage.removeItem('radio-minimized');
        else sessionStorage.setItem('radio-minimized', saved);
      }, saved);
      await page.route(/youtube\.com|googlevideo\.com|sibforms\.com/, route => route.abort());
      await page.goto('/');
      const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
      if (await decline.isVisible()) await decline.click();
      const dock = page.getByRole('complementary', { name: 'Santa Radio player' });
      await expect(dock).toHaveClass(/is-minimized/);
      await dock.getByRole('button', { name: 'Expand radio player', exact: true }).click();
      await expect(dock).not.toHaveClass(/is-minimized/);
      // An internal route change must not undo the visitor's explicit choice.
      await page.locator('footer a[href="/apps"]').first().click();
      await expect(dock).not.toHaveClass(/is-minimized/);
      await page.reload();
      await expect(dock).toHaveClass(/is-minimized/);
      await expect(dock.getByRole('button', { name: 'Expand radio player', exact: true })).toHaveAttribute('aria-expanded', 'false');
    });
  }
}
