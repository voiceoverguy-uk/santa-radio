import { test, expect } from '@playwright/test';

test.use({ timezoneId: 'Europe/London', reducedMotion: 'reduce' });
const routes = ['/', '/preview/hero-name-checker'];
const greeting = page => page.locator('.hero-halloween-greeting');

async function setup(page, date) {
  await page.clock.install({ time: new Date(new Date(date).getTime() - 1000) });
  await page.clock.pauseAt(new Date(date));
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.load = function () {};
    HTMLMediaElement.prototype.pause = function () {};
    HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  });
  await page.route(/youtube\.com|googlevideo\.com/, route => route.abort());
  await page.route('**/api/radio-metadata*', route => route.fulfill({ json: {
    current: { artist: 'John Legend', title: 'Bring Me Love' }, currentStatus: 'ready',
    upcoming: [], upcomingStatus: 'ready',
  } }));
  await page.route('**/api/santa-names?*', route => route.fulfill({ json: {
    hostedCount: 1, warning: null, records: [{ id: 'arabella', name: 'Arabella' }],
  } }));
}

async function open(page, route) {
  await page.goto(route);
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
  await expect(page.locator('.hero-name-checker input')).toBeVisible();
}

for (const route of routes) {
  for (const [date, visible] of [
    ['2026-10-30T12:00:00Z', false],
    ['2026-10-31T12:00:00Z', true],
    ['2026-11-01T12:00:00Z', false],
    ['2027-10-31T12:00:00Z', true],
    ['2028-10-31T12:00:00Z', true],
  ]) {
    test(`${route} Halloween visibility on ${date}`, async ({ page }) => {
      await setup(page, date);
      await open(page, route);
      await expect(greeting(page)).toHaveCount(visible ? 1 : 0);
      if (visible) await expect(greeting(page)).toHaveText('Happy Halloween');
      else {
        await expect(page.locator('.hero-name-preview__intro > :last-child')).toHaveClass('hero-title');
      }
      await expect(page.locator('.hero h1')).toHaveText('Santa Radio A little magic from the North Pole.');
    });
  }

  test(`${route} updates at both local midnights without navigation`, async ({ page }) => {
    await setup(page, '2026-10-30T23:59:59Z');
    await open(page, route);
    await expect(greeting(page)).toHaveCount(0);
    await page.clock.runFor(1100);
    await expect(greeting(page)).toHaveText('Happy Halloween');
    // Jump close to the next deadline without running every countdown tick.
    await page.clock.fastForward(86399000);
    await page.clock.runFor(1100);
    await expect(greeting(page)).toHaveCount(0);
  });

  test(`${route} refreshes suspended tabs and restored pages`, async ({ page }) => {
    await setup(page, '2026-10-30T12:00:00Z');
    await open(page, route);
    // Change wall time without running the outstanding midnight timer.
    await page.clock.setSystemTime(new Date('2026-10-31T12:00:00Z'));
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(greeting(page)).toBeVisible();
    await page.clock.setSystemTime(new Date('2026-11-01T12:00:00Z'));
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(greeting(page)).toHaveCount(0);
    await page.clock.setSystemTime(new Date('2027-10-31T12:00:00Z'));
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
    await expect(greeting(page)).toBeVisible();
  });

  for (const width of [320, 390, 1440]) {
    test(`${route} Halloween layout and controls at ${width}px and enlarged text`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await setup(page, '2026-10-31T12:00:00Z');
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => {
        if (/hydrat|did not match|server HTML/i.test(message.text())) errors.push(message.text());
      });
      await open(page, route);
      await expect(greeting(page)).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(await greeting(page).evaluate(async el => {
        const font = getComputedStyle(el).fontFamily;
        const faces = await document.fonts.load(`32px ${font}`, el.textContent);
        return faces.length > 0 && faces.every(face => face.status === 'loaded');
      })).toBe(true);
      for (const size of ['100%', '200%']) {
        await page.evaluate(size => { document.documentElement.style.fontSize = size; }, size);
        const geometry = await greeting(page).evaluate(el => {
          const box = el.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(el);
          const rect = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
          return {
            box: box.toJSON(), ink: [...range.getClientRects()].map(r => r.toJSON()),
            heading: rect('.hero-title'), hero: rect('.hero'),
            next: rect(innerWidth < 768 ? '.hero-name-preview__player-row' : '.hero-name-preview__description'),
            checker: rect('.hero-name-preview__checker'), width: innerWidth,
            intro: rect('.hero-name-preview__intro'),
          };
        });
        expect(geometry.box.top).toBeGreaterThanOrEqual(geometry.heading.bottom - .5);
        expect(geometry.box.bottom).toBeLessThanOrEqual(geometry.next.top + .5);
        for (const ink of geometry.ink) {
          expect(ink.left).toBeGreaterThanOrEqual(geometry.box.left - .5);
          expect(ink.right).toBeLessThanOrEqual(Math.min(geometry.box.right, geometry.width) + .5);
          expect(ink.top).toBeGreaterThanOrEqual(geometry.box.top - .5);
          expect(ink.bottom).toBeLessThanOrEqual(geometry.box.bottom + .5);
          expect(ink.right <= geometry.checker.left + .5 || ink.bottom <= geometry.checker.top + .5).toBe(true);
        }
        expect(geometry.intro.left).toBeGreaterThanOrEqual(-.5);
        expect(geometry.intro.right).toBeLessThanOrEqual(width + .5);
      }
      await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
      const hero = page.locator('.hero');
      await hero.getByRole('button', { name: 'Listen Live', exact: true }).click();
      await expect(hero.locator('.now-playing-artwork')).toBeVisible();
      await hero.getByRole('button', { name: /Pause/ }).click();
      await expect(hero.locator('.now-playing-artwork')).toHaveCount(0);
      await hero.getByRole('combobox').fill('Ara');
      await hero.getByRole('option', { name: 'Arabella', exact: true }).click();
      await expect(hero.getByRole('status')).toHaveText('Yes! Santa can record for Arabella.');
      await expect(hero.getByLabel('Countdown to Christmas Day')).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
}

test('the same instant uses the visitor calendar, not UTC or the server date', async ({ browser }) => {
  for (const [timezoneId, visible] of [['Asia/Tokyo', true], ['America/Los_Angeles', false]]) {
    const context = await browser.newContext({ timezoneId });
    const page = await context.newPage();
    try {
      await setup(page, '2026-10-30T16:00:00Z');
      await open(page, '/');
      await expect(greeting(page)).toHaveCount(visible ? 1 : 0);
    } finally {
      await context.close();
    }
  }
});

test('missing display font retains readable unclipped fallback text', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 1000 });
  await setup(page, '2026-10-31T12:00:00Z');
  await page.route('**/fonts/**', route => route.abort());
  await open(page, '/');
  await expect(greeting(page)).toHaveText('Happy Halloween');
  await page.evaluate(() => document.fonts.ready);
  expect(await greeting(page).evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
});
