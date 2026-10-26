import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fillAccessForm, mockBrevo, mockSantaNames } from './helpers/message-access.js';
import { MESSAGE_ACCESS_KEY } from '../src/lib/santaMessageAccess.js';

async function settled(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function expectLanding(page, width) {
  await settled(page);
  await expect(page.locator('.santa-message-heading')).toHaveText('FREE Personalised message from Santa');
  await expect(page.locator('.santa-message-subheading')).toHaveText('Their name. Santa’s voice.');
  await expect(page.locator('.santa-message-subheading')).toHaveCSS('white-space', 'nowrap');
  await expect(page.getByRole('button', { name: 'Hear an example message', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const layout = document.querySelector('#santa-messages .message-layout').getBoundingClientRect();
    const nav = document.querySelector('.navbar').getBoundingClientRect();
    return Math.round(layout.top - nav.bottom);
  })).toBe(24);
  const geometry = await page.evaluate(() => {
    const box = selector => {
      const { top, left, right, bottom } = document.querySelector(selector).getBoundingClientRect();
      return { top, left, right, bottom };
    };
    return {
      nav: box('.navbar'), intro: box('.message-intro'),
      heading: box('.santa-message-heading'), desk: box('.santa-message-box'),
      scroll: scrollY, activeInput: document.activeElement.matches('input, textarea, select'),
    };
  });
  expect(geometry.scroll).toBeGreaterThan(100);
  expect(geometry.activeInput).toBe(false);
  expect(geometry.heading.top).toBeGreaterThan(geometry.nav.bottom);
  if (width > 767) {
    expect(geometry.desk.top).toBeGreaterThan(geometry.nav.bottom);
    expect(geometry.heading.top).toBeLessThan(300);
    expect(geometry.desk.top).toBeLessThan(300);
    expect(geometry.desk.top - geometry.intro.top).toBeCloseTo(24, 0);
    expect(geometry.intro.right).toBeLessThan(geometry.desk.left);
  } else {
    expect(geometry.intro.top - geometry.nav.bottom).toBeCloseTo(24, 0);
    expect(geometry.desk.top).toBeGreaterThanOrEqual(geometry.intro.bottom);
  }
}

async function scrollTo(page, top) {
  await page.evaluate(top => window.scrollTo({ top, behavior: 'instant' }), top);
  return page.evaluate(() => scrollY);
}

async function finishFocusScroll(page) {
  await page.evaluate(async () => {
    let previous = scrollY;
    let stable = 0;
    while (stable < 4) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      stable = Math.abs(scrollY - previous) < 1 ? stable + 1 : 0;
      previous = scrollY;
    }
  });
}

async function expectStayedAt(page, top) {
  // Observe beyond a single frame to catch a delayed reset/scroll animation.
  const positions = await page.evaluate(async () => {
    const values = [];
    for (let i = 0; i < 20; i++) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      values.push(scrollY);
    }
    return values;
  });
  expect(positions, `Scroll should stay at ${top}`).toEqual(positions.map(() => top));
}

for (const width of [1440, 390]) {
  test.describe(`${width}px message opening`, () => {
    test.use({ viewport: { width, height: 900 } });
    test.beforeEach(async ({ page }) => {
      await mockBrevo(page);
      await mockSantaNames(page);
      await page.route('**/api/radio-metadata*', route => route.fulfill({
        json: { available: false, current: null, upcoming: [] },
      }));
    });

    test('fresh loads and refreshes open below the navigation without changing the URL or trapping scroll', async ({ page }) => {
      await page.goto('/free-santa-message');
      await expectLanding(page, width);
      await expect(page).toHaveURL(/\/free-santa-message$/);
      await scrollTo(page, 0);
      await expectStayedAt(page, 0);
      await expect(page.locator('.fsm-hero')).toBeInViewport();
      await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toHaveCount(0);
      const lowerPosition = await scrollTo(page, 1000);
      await expectStayedAt(page, lowerPosition);
      await page.reload();
      await expectLanding(page, width);
      await expect(page).toHaveURL(/\/free-santa-message$/);
    });

    test('internal links and history re-entry position only the standalone page', async ({ page }) => {
      await page.goto('/');
      await settled(page);
      await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
      const nav = page.getByRole('navigation', { name: 'Main navigation' });
      if (width < 1200) await nav.getByRole('button', { name: 'Open menu' }).click();
      await nav.getByRole('link', { name: 'FREE Santa Message', exact: true }).click();
      await expectLanding(page, width);
      if (width < 1200) await nav.getByRole('button', { name: 'Open menu' }).click();
      await nav.getByRole('link', { name: 'Apps', exact: true }).click();
      await expect(page).toHaveURL(/\/apps$/);
      await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
      if (width < 1200) await nav.getByRole('button', { name: 'Open menu' }).click();
      await nav.getByRole('link', { name: 'FREE Santa Message', exact: true }).click();
      await expectLanding(page, width);
      await page.goBack();
      await expect(page).toHaveURL(/\/apps$/);
      await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
      await page.goForward();
      await expectLanding(page, width);
    });

    test('the homepage hero message link scrolls to its own desk without leaving the homepage', async ({ page }) => {
      await page.goto('/');
      await settled(page);
      const originalUrl = page.url();
      const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
      if (await decline.isVisible()) await decline.click();
      const link = page.locator('.hero-actions').getByRole('link', { name: 'FREE Santa Message', exact: true });
      await expect(link).toHaveAttribute('href', '#santa-messages');
      await link.click();
      await expectLanding(page, width);
      await expect(page).toHaveURL(originalUrl);
      await expect(page.locator('main.home-page')).toHaveCount(1);
      await expect(page.locator('.message-name-label')).toHaveCount(0);
      await expect(page.locator('.santa-message-section').getByRole('link', { name: 'Visit Santa’s message desk' })).toHaveCount(0);
      await scrollTo(page, 0);
      await expectStayedAt(page, 0);
      await link.focus();
      await link.press('Enter');
      await expectLanding(page, width);
      await expect(page).toHaveURL(originalUrl);
    });

    test('the top-nav message link also returns to the desk when already on this page', async ({ page }) => {
      await page.goto('/free-santa-message');
      await expectLanding(page, width);
      const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
      if (await decline.isVisible()) await decline.click();
      const nav = page.getByRole('navigation', { name: 'Main navigation' });
      for (const top of [0, 1200]) {
        await scrollTo(page, top);
        if (width < 1200) await nav.getByRole('button', { name: 'Open menu' }).click();
        await nav.getByRole('link', { name: 'FREE Santa Message', exact: true }).click();
        await expectLanding(page, width);
        await expect(page).toHaveURL(/\/free-santa-message$/);
        if (width < 1200) await expect(nav.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false');
      }
      await scrollTo(page, 0);
      await expectStayedAt(page, 0);
    });

    test('prefilled names, typing, unlocking and creating a greeting do not repeat the opening scroll', async ({ page }) => {
      await page.route('**/api/santa-message', route => route.fulfill({
        contentType: 'audio/mpeg', body: readFileSync('server/santa-audio/names/olivia.wav'),
      }));
      await page.goto('/free-santa-message?name=Olivia&utm_source=test');
      await expectLanding(page, width);
      const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
      if (await decline.isVisible()) await decline.click();
      await fillAccessForm(page);
      const email = page.locator('input[name="EMAIL"]');
      await expect(email).toBeFocused();
      await finishFocusScroll(page);
      await expectStayedAt(page, await page.evaluate(() => scrollY));
      await page.getByRole('button', { name: 'Get my free Santa message' }).click();
      const input = page.getByLabel('First Name');
      await expect(input).toHaveValue('Olivia');
      await expect(page.getByRole('heading', { name: 'Download your free Santa greeting' })).toBeFocused();
      await expect(page.getByText('A recording for Olivia is available.', { exact: true })).toBeVisible();
      await finishFocusScroll(page);
      await settled(page);
      await scrollTo(page, 0);
      await expectStayedAt(page, 0);
      await input.fill('Olivia');
      await expect(input).toBeFocused();
      await input.press('Escape');
      await page.getByRole('button', { name: 'Create message', exact: true }).click();
      await expect(page.locator('.message-result')).toBeFocused();
      await settled(page);
      await finishFocusScroll(page);
      await scrollTo(page, 0);
      await expectStayedAt(page, 0);
      await expect(page).toHaveURL(/\/free-santa-message\?name=Olivia&utm_source=test$/);
      await page.reload();
      await expectLanding(page, width);
      await expect(input).toHaveValue('Olivia');
    });

    test('a query-only name change preserves scroll and does not focus the child input', async ({ page }) => {
      await page.addInitScript(key => sessionStorage.setItem(key, 'granted'), MESSAGE_ACCESS_KEY);
      await page.goto('/free-santa-message?name=Olivia');
      await expectLanding(page, width);
      await scrollTo(page, 0);
      // Trigger React Router's normal query-only navigation, not a full load.
      await page.evaluate(() => {
        history.pushState({}, '', '/free-santa-message?name=Noel');
        dispatchEvent(new PopStateEvent('popstate'));
      });
      await expect(page.getByLabel('First Name')).toHaveValue('Noel');
      await expectStayedAt(page, 0);
      await expect(page.getByLabel('First Name')).not.toBeFocused();
    });
  });
}

test('late font readiness never overrides a visitor who has already interacted', async ({ page }) => {
  await mockBrevo(page);
  // Hold only the readiness signal; don't introduce a real network font swap
  // (and native scroll anchoring) into this cancellation-specific assertion.
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({
    contentType: 'text/css', body: '',
  }));
  await page.addInitScript(() => {
    Object.defineProperty(document.fonts, 'ready', {
      value: new Promise(resolve => { window.releaseOpeningFonts = resolve; }),
    });
  });
  await page.goto('/free-santa-message');
  await page.locator('.fsm-sub').click();
  await scrollTo(page, 0);
  await page.evaluate(() => window.releaseOpeningFonts());
  await expectStayedAt(page, 0);
});
