import { test as base, expect } from '@playwright/test';

// Context-level safety net covers every page, including new tabs. Page-level
// mocks take precedence; an unexpected provider request is blocked and fails.
export const test = base.extend({
  providerGuard: [async ({ context }, use) => {
    const unexpected = [];
    await context.route('https://*.sibforms.com/**', async route => {
      if (route.request().method() === 'POST') {
        unexpected.push(route.request().url());
      }
      await route.abort('blockedbyclient');
    });
    await use();
    expect(unexpected, 'Unexpected Brevo POSTs were blocked, never sent live').toEqual([]);
  }, { auto: true }],
});
