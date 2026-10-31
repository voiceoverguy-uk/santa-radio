import { test as base, expect } from '@playwright/test';

// The offer has its own suite. Keep its 16-second dialog from intercepting
// unrelated carousel, keyboard and capture checks under the virtual clock.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => sessionStorage.setItem('santa-message-offer-shown', 'shown'));
    await use(page);
  },
});
export { expect };
