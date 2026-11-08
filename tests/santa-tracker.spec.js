import { test, expect } from '@playwright/test';
import { readFile, stat } from 'node:fs/promises';

const canonical = 'https://www.santaradio.co.uk/santa-tracker';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/radio-metadata*', route => route.fulfill({
    json: { available: false, current: null, upcoming: [] },
  }));
});

test('tracker ends with Christmas facts rather than the voiceover promotion', async ({ page }) => {
  await page.goto('/santa-tracker');
  await expect(page.getByRole('heading', { name: 'Christmas Around the World', exact: true })).toBeVisible();
  await expect(page.locator('.tracker-cta')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /Want Santa.*Voice for Your Project/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Check Availability', exact: true })).toHaveCount(0);
  await expect(page.locator('.tracker-shell > section').last()).toContainText('Christmas Around the World');
});

test('homepage feature and navigation keep the one existing radio playing', async ({ page }) => {
  await page.addInitScript(() => {
    window.playCalls = 0;
    window.pauseCalls = 0;
    HTMLMediaElement.prototype.load = function () {};
    HTMLMediaElement.prototype.pause = function () { window.pauseCalls++; };
    HTMLMediaElement.prototype.play = function () {
      window.playCalls++;
      this.dispatchEvent(new Event('playing'));
      return Promise.resolve();
    };
  });
  await page.goto('/');
  await expect(page.locator('.tracker-banner')).toContainText('Santa');
  await expect(page.locator('.tracker-banner .tracker-action')).toHaveAttribute('href', '/santa-tracker');
  await page.locator('.hero-actions').getByRole('button', { name: 'Listen Live' }).click();
  await page.getByRole('slider', { name: 'Radio volume' }).fill('0.25');
  await page.evaluate(() => { window.originalAudio = document.querySelector('audio'); });
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Santa Tracker', exact: true }).click();
  await expect(page).toHaveURL(/\/santa-tracker$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText("Track Santa's Journey");
  await expect(page.locator('.radio-dock').getByRole('button', { name: 'Pause Radio' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Apps', exact: true }).click();
  expect(await page.evaluate(() => ({
    sameAudio: window.originalAudio === document.querySelector('audio'),
    count: document.querySelectorAll('audio').length,
    volume: document.querySelector('audio').volume,
    plays: window.playCalls, pauses: window.pauseCalls,
  }))).toEqual({ sameAudio: true, count: 1, volume: 0.25, plays: 1, pauses: 0 });
});

test('direct route metadata, assets and preview noindex are available before JavaScript', async ({ request, page }) => {
  const response = await request.get('/santa-tracker');
  expect(response.ok()).toBeTruthy();
  const html = await response.text();
  expect(html).toContain("Santa Tracker | Track Santa's Journey");
  expect(html).toContain(`rel="canonical" href="${canonical}"`);
  expect(html).toContain('property="og:site_name" content="Santa Radio"');
  expect(html).toMatch(/"@type"\s*:\s*"BreadcrumbList"/);
  expect(html).toContain('https://www.santaradio.co.uk/santa-tracker#breadcrumbs');
  const preview = await request.get('/santa-tracker/preview');
  // The development proxy also appends its own non-indexing directives.
  expect(preview.headers()['x-robots-tag']).toContain('noindex, follow');
  expect(await preview.text()).toContain('name="robots" content="noindex, follow"');
  for (const asset of ['/images/santa-post-stamp.png', '/images/santa-radio-logo.png']) {
    expect((await request.get(asset)).ok()).toBeTruthy();
  }
  await page.goto('/santa-tracker');
  await expect(page.locator('meta[property="og:url"]')).toHaveCount(1);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', canonical);
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute('content', 'Santa Radio');
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toHaveCount(0);
  expect(await page.locator('a[href*="/santa-tracker/preview"]').count()).toBe(0);
  expect(await page.locator('main form').count()).toBe(0);
  await expect(page.locator('main')).not.toContainText('Santa’s voice by Guy Harris');
  await expect(page.locator('.tracker-hero')).toContainText(
    'The countdown is on until departure. Keep up with Santa’s seasonal travels, route preparations and festive facts. Keep checking back!',
  );
});

test('tracker questions use expandable, keyboard-accessible question controls', async ({ page }) => {
  await page.goto('/santa-tracker');
  const questions = page.locator('.tracker-questions details');
  await expect(questions).toHaveCount(6);
  const first = questions.first();
  const answer = first.locator('p');
  await expect(answer).toBeHidden();
  await first.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(first).toHaveAttribute('open', '');
  await expect(answer).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(first).not.toHaveAttribute('open', '');
  await expect(answer).toBeHidden();
});

for (const [date, text] of [
  ['2026-03-15T12:00:00Z', /Holiday Postcards/],
  ['2026-07-15T12:00:00Z', /Christmas in July Postcards/],
   ['2026-11-01T00:00:00Z', /Holiday Postcards/],
    ['2026-11-09T23:59:59Z', /Holiday Postcards/],
    ['2026-11-10T00:00:00Z', /Route Research Report/],
    ['2026-12-22T23:59:59Z', /Route Research Report/],
    ['2026-12-23T00:00:00Z', /Workshop Dispatch/],
  ['2026-12-24T09:00:00Z', /Preparing/],
  ['2026-12-24T14:00:00Z', /Live Update/],
  ['2026-12-25T11:21:00Z', /Journey Summary/],
   ['2026-12-25T23:59:59Z', /Journey Summary/],
   ['2026-12-26T00:00:00Z', /Holiday Postcards/],
   ['2027-01-01T12:00:00Z', /Holiday Postcards/],
    ['2027-02-28T23:59:59Z', /Holiday Postcards/],
]) {
  test(`seasonal content at ${date}`, async ({ page }) => {
    await page.clock.setFixedTime(new Date(date));
    await page.goto('/santa-tracker');
    await expect(page.locator('main')).toContainText(text);
    await expect(page.locator('main svg[role="img"]')).toBeVisible();
    expect(await page.locator('h1').count()).toBe(1);
    await expect(page.getByRole('button', { name: 'Preview Controls' })).toHaveCount(0);
  });
}

test('desktop/mobile map, typography and menu fit without horizontal overflow', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-12-24T09:00:00Z'));
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 1280, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/santa-tracker');
    const map = page.locator('main svg[role="img"]');
    await expect(map).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toHaveCount(0);
    const box = await page.locator('.tracker-map').boundingBox();
    const statusBox = await page.locator('.tracker-status').boundingBox();
    const headingBox = await page.locator('main h1').boundingBox();
    const descriptionBox = await page.locator('.tracker-hero .tracker-copy').first().boundingBox();
    const countdownBox = await page.getByText("Countdown to Santa's Departure").boundingBox();
    expect(box.width).toBeGreaterThan(250);
    if (viewport.width >= 768) {
      expect(Math.abs(box.width - Math.min(1320, viewport.width - 48))).toBeLessThanOrEqual(1);
    }
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(box.y).toBeGreaterThanOrEqual(headingBox.y + headingBox.height);
    expect(statusBox.y).toBeGreaterThanOrEqual(box.y + box.height);
    expect(descriptionBox.y).toBeGreaterThanOrEqual(box.y + box.height);
    expect(statusBox.y + statusBox.height).toBeLessThan(descriptionBox.y);
    expect(countdownBox.y).toBeGreaterThanOrEqual(box.y + box.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    expect(await page.locator('main h1').evaluate(node => getComputedStyle(node).fontWeight)).toBe('400');
    await expect(map.locator('text').filter({ hasText: '🎅' })).toHaveCount(1);
    if (viewport.width < 768) {
      await page.getByRole('button', { name: 'Open menu' }).click();
      await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Santa Tracker', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Close menu' }).click();
    }
  }
});

test('homepage, world, and regional maps share the bright map palette', async ({ page }) => {
  test.setTimeout(60000);
  const landColors = ['#78A967', '#91B777', '#568B59', '#A8B77B', '#B89A68', '#C58C62'];
  const readLandColors = async locator => locator.evaluateAll(paths => [...new Set(paths.map(path => path.getAttribute('fill')))].sort());

  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const date of ['2026-11-09T12:00:00Z', '2026-11-15T12:00:00Z']) {
      await page.clock.setFixedTime(new Date(date));
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      const homepageMap = page.locator('.tracker-banner-map svg');
      await expect(homepageMap.locator('rect').first()).toHaveAttribute('fill', '#2F83B7');
      await expect(homepageMap.locator('[data-night-overlay]')).toHaveAttribute('data-solar-time', new Date(date).toISOString());
      await expect(homepageMap.locator('[data-night-overlay]')).toHaveAttribute('fill-opacity', '0.25');
      const homepageLand = await readLandColors(homepageMap.locator('g path'));
      expect(homepageLand).toEqual([...landColors].sort());

      await page.goto('/santa-tracker', { waitUntil: 'domcontentloaded' });
      const map = page.locator('main svg[role="img"]');
      await expect(map.locator('rect').first()).toHaveAttribute('fill', '#2F83B7');
      await expect(map.locator('.tj-camera > [data-night-overlay]')).toHaveAttribute('data-solar-time', new Date(date).toISOString());
      await expect(map.locator('.tj-camera > [data-night-overlay]')).toHaveAttribute('fill-opacity', '0.25');
      const worldLand = await readLandColors(map.locator('.tj-camera > g:first-child path'));
      expect(worldLand).toEqual(homepageLand);
      const descriptionId = await map.getAttribute('aria-describedby');
      await expect(page.locator(`[id="${descriptionId}"]`)).toContainText('Subtle shading marks the night side of Earth');
      await expect(page.locator(`[id="${descriptionId}"]`)).toContainText('Faint dots mark');

      await page.getByLabel('Browse a region', { exact: true }).selectOption('Australia');
      await expect(page.locator('.tj-minimap rect').first()).toHaveAttribute('fill', '#2F83B7');
      await expect(page.locator('.tj-minimap [data-night-overlay]')).toHaveAttribute('data-solar-time', new Date(date).toISOString());
      const minimapLand = await readLandColors(page.locator('.tj-minimap g path'));
      expect(minimapLand).toEqual(homepageLand);
      await page.getByLabel('Browse a region', { exact: true }).selectOption('Pacific');
      await expect(page.locator('.tj-camera > [data-night-overlay-duplicate]')).toHaveAttribute('data-solar-time', new Date(date).toISOString());
    }

    await page.clock.setFixedTime(new Date('2026-12-24T14:00:00Z'));
    await page.goto('/santa-tracker', { waitUntil: 'domcontentloaded' });
    const christmasMap = page.locator('main svg[role="img"]');
    await expect(christmasMap.locator('.tj-camera path[stroke="#17334A"]').first()).toBeAttached();
    await expect(christmasMap.locator('.tj-camera path[stroke="#FFD36F"]').first()).toBeAttached();
    await expect(christmasMap.locator('.tj-label').first()).toHaveCSS('stroke', 'rgb(23, 51, 74)');
  }
});

test('late UK evening shading leaves the Americas lit and preview maps use simulated time', async ({ page }) => {
  const publicTime = '2026-11-08T21:00:00Z';
  const normalizedPublicTime = new Date(publicTime).toISOString();
  await page.clock.install({ time: new Date(new Date(publicTime).getTime() - 1000) });
  await page.clock.pauseAt(new Date(publicTime));
  await page.goto('/santa-tracker');
  const map = page.locator('main svg[role="img"]');
  const overlay = map.locator('.tj-camera > [data-night-overlay]');
  await expect(overlay).toHaveAttribute('data-solar-time', normalizedPublicTime);
  await expect(overlay).toHaveAttribute('d', /M/);

  await page.clock.runFor(1000);
  await expect(overlay).toHaveAttribute('data-solar-time', '2026-11-08T21:00:01.000Z');

  await page.clock.setFixedTime(new Date('2026-07-15T12:00:00Z'));
  await page.evaluate(() => localStorage.setItem('santa-tracker-preview', JSON.stringify({
    enabled: true,
    activatedAtRealMs: Date.now(),
    simulatedStartMs: Date.UTC(2026, 10, 8, 21),
    speedMultiplier: 1,
    jumpTarget: null,
  })));
  await page.goto('/santa-tracker/preview');
  await expect(page.locator('main svg[role="img"] [data-night-overlay]')).toHaveAttribute(
    'data-solar-time',
    /^2026-11-08T21:00:00/,
  );
  await page.getByLabel('Browse a region', { exact: true }).selectOption('Europe');
  await expect(page.locator('.tj-minimap [data-night-overlay]')).toHaveAttribute(
    'data-solar-time',
    /^2026-11-08T21:00:00/,
  );
});

test('gold dividers separate holiday activity, introduction and countdown without moving live updates', async ({ page }) => {
  const states = [
    { date: '2026-11-09T12:00:00Z', status: /On Holiday in/ },
    { date: '2026-11-15T12:00:00Z', status: /Prepping the route in/ },
    { date: '2026-12-24T14:00:00Z', status: /Delivering Now/ },
    { date: '2026-12-25T11:21:00Z', status: /Journey Complete/ },
  ];
  for (const state of states) {
    await page.clock.setFixedTime(new Date(state.date));
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.goto('/santa-tracker');
      await expect(page.locator('.tracker-status')).toContainText(state.status);
       const holiday = /Holiday|Prepping/.test(state.status.source);
      const dividers = page.locator('.tracker-copy-divider');
      await expect(dividers).toHaveCount(holiday ? 2 : 1);
      const divider = dividers.last();
      await expect(divider).toBeVisible();
      await expect(divider).toHaveAttribute('aria-hidden', 'true');
      const dividerBox = await divider.boundingBox();
      const introBox = await page.locator('.tracker-hero .tracker-copy').filter({ hasText: 'The countdown is on until departure.' }).boundingBox();
      const statusMessageBox = await page.locator('.tracker-status-message').boundingBox();
      expect(dividerBox.y).toBeGreaterThan(introBox.y + introBox.height - 1);
      if (holiday) {
        const upperDividerBox = await dividers.first().boundingBox();
        const badgeBox = await page.locator('.tracker-status').boundingBox();
        const firstIntroBox = await page.locator('.tracker-copy').filter({ hasText: 'Santa Radio’s Santa Tracker follows' }).boundingBox();
        expect(statusMessageBox.y).toBeGreaterThanOrEqual(badgeBox.y + badgeBox.height);
        expect(upperDividerBox.y).toBeGreaterThanOrEqual(statusMessageBox.y + statusMessageBox.height);
        expect(firstIntroBox.y).toBeGreaterThanOrEqual(upperDividerBox.y + upperDividerBox.height);
        const countdownBox = await page.locator('.tracker-countdown-label').first().boundingBox();
        expect(countdownBox.y).toBeGreaterThanOrEqual(dividerBox.y + dividerBox.height);
      } else {
        expect(statusMessageBox.y).toBeGreaterThan(dividerBox.y + dividerBox.height);
      }
      expect(Math.abs(dividerBox.x + dividerBox.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(1);
      expect(dividerBox.width).toBeGreaterThan(200);
      expect(dividerBox.width).toBeLessThanOrEqual(416);
    }
  }
});

test('tracker copy and divider remain readable at 200% text zoom', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-09T12:00:00Z'));
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/santa-tracker');
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });

    const intro = page.locator('.tracker-hero .tracker-copy').filter({ hasText: 'The countdown is on until departure.' });
    const seasonalMessage = page.locator('.tracker-status-message');
    const dividers = page.locator('.tracker-copy-divider');
    await expect(dividers).toHaveCount(2);
    const divider = dividers.first();
    await expect(intro).toContainText('The countdown is on until departure.');
    await expect(seasonalMessage).toContainText("Santa's taking a well-earned break");
    await expect(divider).toBeVisible();

    const zoomedLayout = await page.evaluate(() => {
      const textBounds = node => {
        const range = document.createRange();
        range.selectNodeContents(node);
        const rects = [...range.getClientRects()];
        return rects.reduce((bounds, rect) => ({
          left: Math.min(bounds.left, rect.left),
          right: Math.max(bounds.right, rect.right),
          top: Math.min(bounds.top, rect.top),
          bottom: Math.max(bounds.bottom, rect.bottom),
        }), { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity });
      };
      const paragraphBounds = node => {
        const rect = node.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      };
      return {
        rootFontSize: parseFloat(getComputedStyle(document.documentElement).fontSize),
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: innerWidth,
        introText: textBounds(document.querySelectorAll('.tracker-hero .tracker-copy')[2]),
        introParagraph: paragraphBounds(document.querySelectorAll('.tracker-hero .tracker-copy')[2]),
        seasonalText: textBounds(document.querySelector('.tracker-status-message')),
        seasonalParagraph: paragraphBounds(document.querySelector('.tracker-status-message')),
      };
    });
    const dividerBox = await divider.boundingBox();

    expect(zoomedLayout.rootFontSize).toBe(32);
    expect(zoomedLayout.documentWidth).toBeLessThanOrEqual(zoomedLayout.viewportWidth + 1);
    for (const [text, paragraph] of [
      [zoomedLayout.introText, zoomedLayout.introParagraph],
      [zoomedLayout.seasonalText, zoomedLayout.seasonalParagraph],
    ]) {
      expect(text.left).toBeGreaterThanOrEqual(paragraph.left - 0.5);
      expect(text.right).toBeLessThanOrEqual(paragraph.right + 0.5);
      expect(text.top).toBeGreaterThanOrEqual(paragraph.top - 0.5);
      expect(text.bottom).toBeLessThanOrEqual(paragraph.bottom + 0.5);
    }
    expect(dividerBox.y).toBeGreaterThanOrEqual(zoomedLayout.seasonalText.bottom - 0.5);
    expect(zoomedLayout.introText.top).toBeGreaterThanOrEqual(dividerBox.y + dividerBox.height - 0.5);
    const lowerDividerBox = await dividers.last().boundingBox();
    expect(lowerDividerBox.y).toBeGreaterThanOrEqual(zoomedLayout.introText.bottom - 0.5);
    expect(Math.abs(dividerBox.x + dividerBox.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(1);
  }
});

test('tracker omits the gold divider when no status message follows the introduction', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-12-24T09:00:00Z'));
  await page.goto('/santa-tracker');
  await expect(page.locator('.tracker-hero .tracker-copy')).toHaveCount(2);
  await expect(page.locator('.tracker-status-message')).toHaveCount(0);
  await expect(page.locator('.tracker-copy-divider')).toHaveCount(0);
});

test('tracker uses the homepage typography and readable brand accents without changing shared styles', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-07-15T12:00:00Z'));
  await page.goto('/');
  const shared = await page.evaluate(() => {
    const heading = getComputedStyle(document.querySelector('main h1'));
    const button = getComputedStyle(document.querySelector('.hero-actions .btn-red'));
    return { font: heading.fontFamily, weight: heading.fontWeight, button: button.backgroundColor };
  });
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Santa Tracker', exact: true }).click();
  const tracker = await page.locator('main h1').evaluate(node => {
    const style = getComputedStyle(node);
    return { font: style.fontFamily, weight: style.fontWeight, size: parseFloat(style.fontSize) };
  });
  expect(tracker.font).toBe(shared.font);
  expect(tracker.weight).toBe(shared.weight);
  expect(tracker.size).toBeLessThanOrEqual(48);
  const contrast = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d');
    const rgb = color => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
    };
    const luminance = channels => channels.map(v => {
      v /= 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    const background = rgb(getComputedStyle(document.querySelector('main')).backgroundColor);
    return {
      background,
      ratios: [...document.querySelectorAll('main h1 span, main h1 + p, main [class*="tabular-nums"]')].map(node => {
        const a = luminance(rgb(getComputedStyle(node).color)), b = luminance(background);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      }),
    };
  });
  expect(contrast.background[1]).toBeGreaterThan(contrast.background[2]);
  expect(contrast.background[1]).toBeGreaterThan(contrast.background[0]);
  expect(contrast.ratios.length).toBeGreaterThanOrEqual(5);
  for (const ratio of contrast.ratios) expect(ratio).toBeGreaterThanOrEqual(4.5);
  await expect(page.getByRole('button', { name: 'Share this postcard' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page.locator('.hero-actions .btn-red')).toBeVisible();
  expect(await page.evaluate(() => ({
    font: getComputedStyle(document.querySelector('main h1')).fontFamily,
    weight: getComputedStyle(document.querySelector('main h1')).fontWeight,
    button: getComputedStyle(document.querySelector('.hero-actions .btn-red')).backgroundColor,
  }))).toEqual(shared);
});

test('saved simulated dates stay isolated on the preview route and controls avoid the player', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-07-15T12:00:00Z'));
  await page.addInitScript(() => localStorage.setItem('santa-tracker-preview', JSON.stringify({
    enabled: true, activatedAtRealMs: Date.now(), simulatedStartMs: Date.UTC(2026, 11, 24, 14),
    speedMultiplier: 1, jumpTarget: 'route-start',
  })));
  await page.goto('/santa-tracker');
  await expect(page.locator('main')).toContainText('Christmas in July Postcards');
  await expect(page.getByRole('button', { name: 'Preview Controls' })).toHaveCount(0);
  await page.goto('/santa-tracker/preview');
  await expect(page.getByRole('button', { name: 'Preview Controls' })).toBeVisible();
  const toggle = page.getByRole('button', { name: 'Preview Controls' });
  if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
  await expect(page.getByRole('switch', { name: 'Preview mode' })).toHaveAttribute('aria-checked', 'true');
  const panel = page.locator('.tracker-preview-panel');
  await panel.getByRole('button', { name: /complete/i }).click();
  await expect(page.locator('main')).toContainText('Journey Summary');
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    const a = await panel.boundingBox(), b = await page.locator('.radio-dock').boundingBox();
    expect(a.x + a.width <= b.x || a.y + a.height <= b.y || b.y + b.height <= a.y).toBeTruthy();
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Santa Tracker', exact: true }).click();
  await expect(page.locator('main')).toContainText('Christmas in July Postcards');
  await expect(page.getByRole('button', { name: 'Preview Controls' })).toHaveCount(0);
  expect(await page.locator('meta[name="robots"][content*="noindex"]').count()).toBe(0);
});

test('postcard falls back to a real PNG download when embedded native sharing is blocked', async ({ page }) => {
  test.setTimeout(60000);
  await page.clock.setFixedTime(new Date('2026-07-15T12:00:00Z'));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
    Object.defineProperty(navigator, 'share', { value: async data => {
      window.sharedTracker = { title: data.title, text: data.text, url: data.url };
      throw new DOMException('Sharing blocked by embedded preview', 'NotAllowedError');
    }, configurable: true });
  });
  await page.goto('/santa-tracker');
  await expect(page.getByRole('button', { name: 'Share this postcard' })).toBeVisible();
  await expect(page.locator('main a', { hasText: 'santa-radio.replit.app/santa-tracker' })).toHaveAttribute('href', canonical);
  const minimise = page.getByRole('button', { name: 'Minimise radio player' });
  if (await minimise.isVisible()) await minimise.click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Share this postcard' }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe('santa-postcard.png');
  const path = await download.path();
  expect((await stat(path)).size).toBeGreaterThan(10000);
  expect((await readFile(path)).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(await page.evaluate(() => window.sharedTracker.url)).toBe(canonical);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

const holidaySpeeds = [
  'Slow', 'Horizontal', 'Easy', 'Very leisurely', 'Cruising',
  'Taking it easy', 'Snoozing', 'In no rush',
];
const dashboardCard = (page, label) => page.locator('main .tracker-card').filter({
  has: page.locator('span', { hasText: new RegExp(`^${label}$`) }),
}).locator('.tracker-card-value');

async function pauseClock(page, iso) {
  const date = new Date(iso);
  await page.clock.install({ time: new Date(date.getTime() - 1000) });
  await page.clock.pauseAt(date);
}

test('holiday Speed cycles in order every six seconds, wraps, and keeps the destination', async ({ page }) => {
  await pauseClock(page, '2026-11-09T12:00:00Z');
  await page.goto('/santa-tracker');
  await expect(page.locator('main')).toContainText('Holiday Postcards');
   const speed = dashboardCard(page, 'Estimated Speed');
  const location = await dashboardCard(page, 'Current Location').textContent();
  await expect(speed).toHaveText('Slow');
   await expect(dashboardCard(page, 'Route Stops')).toHaveText('Research from 10 November');
   await expect(page.locator('.tracker-hero')).toContainText('Route-research trips begin on 10 November');
  for (let i = 1; i <= holidaySpeeds.length; i++) {
    await page.clock.runFor(5999);
    await expect(speed).toHaveText(holidaySpeeds[(i - 1) % holidaySpeeds.length]);
    await page.clock.runFor(1);
    await expect(speed).toHaveText(holidaySpeeds[i % holidaySpeeds.length]);
    await expect(dashboardCard(page, 'Current Location')).toHaveText(location);
  }
});

test('an open tracker exits holidays on 10 November and retains its research destination', async ({ page }) => {
  await pauseClock(page, '2026-11-09T23:59:53Z');
  await page.goto('/santa-tracker');
  await expect(page.locator('main')).toContainText('Holiday Postcards');
  await expect(page.locator('main svg > title')).toContainText('holiday location');
  const location = (await dashboardCard(page, 'Current Location').textContent()).replace('🏖️ ', '');
  await page.clock.runFor(6000);
  await expect(dashboardCard(page, 'Estimated Speed')).toHaveText('Horizontal');
  await page.clock.runFor(1000);
  await expect(page.locator('main')).toContainText('Route Research Report');
  await expect(page.locator('main')).not.toContainText('Holiday Postcards');
  await expect(page.locator('.tracker-status')).toContainText(`Prepping the route in ${location}`);
  await expect(page.locator('main svg > title')).toContainText(`route research map: ${location}`);
  await expect(dashboardCard(page, 'Current Location')).toContainText(location);
  await expect(dashboardCard(page, 'Estimated Speed')).toHaveText('—');
  await expect(dashboardCard(page, 'ETA')).not.toContainText('Relaxing');
  await page.clock.runFor(18000);
  await expect(dashboardCard(page, 'Estimated Speed')).toHaveText('—');
});

test('homepage banner leaves holidays at the same November boundary without reloading', async ({ page }) => {
  await pauseClock(page, '2026-11-09T23:59:59Z');
  await page.goto('/');
  const banner = page.locator('.tracker-banner');
  await expect(banner).toContainText('Route-research trips begin on 10 November');
  await expect(banner).toContainText("Santa's holiday location");
  await page.clock.runFor(1000);
  await expect(banner).toContainText('Prepping the route in');
  await expect(banner).toContainText("Santa's route research location:");
  await expect(banner).not.toContainText('well-earned break');
});

test('homepage mini map links to the tracker with an accessible name and keyboard focus', async ({ page }) => {
  test.setTimeout(90000);
  await page.clock.setFixedTime(new Date('2026-11-09T12:00:00Z'));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const map = page.getByRole('link', { name: "Open the Santa Tracker: Santa's holiday location" });
  await expect(map).toHaveAttribute('href', '/santa-tracker');
  await page.locator('.tracker-banner .tracker-action').focus();
  await page.keyboard.press('Tab');
  await expect(map).toBeFocused();
  await expect(map).toHaveCSS('outline-style', 'solid');
  await map.locator('svg').click();
  await expect(page).toHaveURL(/\/santa-tracker$/);
});

for (const [date, holiday] of [
   ['2026-11-09T12:00:00Z', true],
   ['2026-12-23T12:00:00Z', false],
]) {
  test(`homepage enlarged map preserves location and leaves the countdown in the hero at ${date}`, async ({ page }) => {
    await pauseClock(page, date);
    await page.goto('/');
    const banner = page.locator('.tracker-banner');
    const caption = holiday ? "Santa's holiday location" : "Santa's at the North Pole";
    const map = banner.getByRole('link', { name: `Open the Santa Tracker: ${caption}` });
    await expect(map).toBeVisible();
    await expect(map.locator('.tracker-map-caption')).toHaveText(caption);
    const marker = map.locator(holiday ? 'svg [data-santa-location]' : 'svg text');
    const position = async () => marker.evaluate(node => {
      if (node.tagName.toLowerCase() === 'text') return {
        x: Number(node.getAttribute('x')), y: Number(node.getAttribute('y')),
      };
      const [x, y] = node.getAttribute('transform').match(/-?\d+(?:\.\d+)?/g).map(Number);
      return { x, y };
    });
    const { x, y } = await position();
    if (holiday) {
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(1000);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(500);
      await expect(banner).toContainText('Route-research trips begin on 10 November');
    } else {
      expect(x).toBe(500);
      expect(y).toBe(0);
      await expect(banner.locator('.tracker-status')).toContainText('Final Preparations Underway');
    }
    await expect(banner.locator('.tracker-countdown-value')).toHaveCount(0);
    const countdown = page.locator('.hero-countdown .countdown-unit strong');
    await expect(countdown).toHaveCount(4);
    const before = await countdown.allTextContents();
    await page.clock.runFor(1000);
    const after = await countdown.allTextContents();
    const seconds = values => values.reduce((sum, value, i) => sum + Number(value) * [86400, 3600, 60, 1][i], 0);
    expect(seconds(before) - seconds(after)).toBe(1);
    expect(await position()).toEqual({ x, y });
    const stops = map.locator('[data-route-stops] circle');
    await expect(stops).toHaveCount(60);
    const positions = await stops.evaluateAll(nodes => nodes.map(node => ({
      id: node.getAttribute('data-stop-id'),
      x: node.getAttribute('cx'),
      y: node.getAttribute('cy'),
    })));
    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const status = banner.locator('.tracker-status');
      await expect(status).toHaveCount(1);
      await expect(banner.locator('.tracker-banner-copy .tracker-status')).toHaveCount(0);
      const badgeBox = await status.boundingBox();
      const mapBox = await map.boundingBox();
      expect(badgeBox.y).toBeGreaterThanOrEqual(mapBox.y + mapBox.height + 12);
      expect(Math.abs(badgeBox.x + badgeBox.width / 2 - mapBox.x - mapBox.width / 2)).toBeLessThanOrEqual(1);
      expect(badgeBox.x).toBeGreaterThanOrEqual(0);
      expect(badgeBox.x + badgeBox.width).toBeLessThanOrEqual(width);
      expect(await map.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
      await expect(stops.first()).toHaveAttribute('stroke', '#bcc9bd');
    }
    await page.goto('/santa-tracker');
    const mainStops = page.locator('.tracker-map g[data-stop-id]');
    await expect(mainStops).toHaveCount(60);
    expect(await mainStops.evaluateAll(nodes => nodes.map(node => ({
      id: node.getAttribute('data-stop-id'),
      x: node.querySelector('circle').getAttribute('cx'),
      y: node.querySelector('circle').getAttribute('cy'),
    })))).toEqual(positions);
  });
}

for (const [date, complete] of [
  ['2026-12-24T14:00:00Z', false],
  ['2026-12-25T11:21:00Z', true],
]) {
  test(`homepage retains ${complete ? 'completed' : 'live'} statistics instead of the map`, async ({ page }) => {
    await page.clock.setFixedTime(new Date(date));
    for (const width of [1280, 768, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      const banner = page.locator('.tracker-banner');
      await expect(banner.locator('.tracker-status')).toContainText(complete ? 'Journey Complete' : 'Delivering in');
      await expect(banner.locator('.tracker-map, .tracker-countdown-value')).toHaveCount(0);
      const cards = banner.locator('.tracker-banner-visual .tracker-card');
      await expect(cards).toHaveCount(4);
      for (const label of ['Journey Progress', 'Regions Visited', 'Gifts Delivered', 'Current Location']) {
        await expect(cards.filter({ hasText: label })).toBeVisible();
      }
      await expect(cards.first().locator('div').first()).toHaveText(complete ? '100.0%' : '15.8%');
      await expect(cards.nth(2).locator('div').first()).toHaveText(complete ? '2.5B' : '395M');
      await expect(banner.locator('.tracker-action')).toContainText(complete ? 'Open the Tracker' : 'Track Santa Now');
      await expect(banner.locator('.tracker-action')).toHaveAttribute('href', '/santa-tracker');
      const statsBox = await banner.locator('.tracker-banner-visual > div').boundingBox();
      if (width === 1280) expect(statsBox.width).toBe(256);
      expect(statsBox.x).toBeGreaterThanOrEqual(0);
      expect(statsBox.x + statsBox.width).toBeLessThanOrEqual(width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  });
}

for (const [realDate, simulatedDate, holiday] of [
  ['2026-12-23T12:00:00Z', '2026-12-22T23:59:53Z', true],
  ['2026-11-15T12:00:00Z', '2026-12-23T12:00:00Z', false],
]) {
  test(`preview uses ${simulatedDate} independently of public date ${realDate}`, async ({ page }) => {
    await pauseClock(page, realDate);
    await page.addInitScript(({ simulatedDate }) => localStorage.setItem('santa-tracker-preview', JSON.stringify({
      enabled: true, activatedAtRealMs: Date.now(), simulatedStartMs: new Date(simulatedDate).getTime(),
      speedMultiplier: 1, jumpTarget: null,
    })), { simulatedDate });
    await page.goto('/santa-tracker/preview');
    await expect(page.locator('main')).toContainText(holiday ? 'Route Research Report' : 'Workshop Dispatch');
    await expect(dashboardCard(page, 'Estimated Speed')).toHaveText('—');
    if (holiday) {
      await page.clock.runFor(7000);
      await expect(page.locator('main')).toContainText('Workshop Dispatch');
      await expect(dashboardCard(page, 'Estimated Speed')).toHaveText('—');
    }
    await page.getByRole('button', { name: 'Reset to Real Time' }).click();
    await expect(page.locator('main')).toContainText(holiday ? 'Workshop Dispatch' : 'Route Research Report');
    await expect(dashboardCard(page, 'Estimated Speed')).toHaveText('—');
    await page.goto('/santa-tracker');
    await expect(page.locator('main')).toContainText(holiday ? 'Workshop Dispatch' : 'Route Research Report');
  });
}

test('holiday homepage and tracker labels fit desktop and mobile without clipping', async ({ page }) => {
  await pauseClock(page, '2026-11-09T12:00:00Z');
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.locator('.tracker-banner')).toContainText('Route-research trips begin on 10 November');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.goto('/santa-tracker');
    await expect(dashboardCard(page, 'Estimated Speed')).toHaveText('Slow');
    for (const label of holidaySpeeds) {
      await expect(dashboardCard(page, 'Estimated Speed')).toHaveText(label);
      expect(await dashboardCard(page, 'Estimated Speed').evaluate(node =>
        node.scrollWidth <= node.clientWidth && node.scrollHeight <= node.clientHeight
      )).toBeTruthy();
      await page.clock.runFor(6000);
    }
    expect(await dashboardCard(page, 'Route Stops').evaluate(node =>
      node.scrollWidth <= node.clientWidth && node.scrollHeight <= node.clientHeight
    )).toBeTruthy();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  }
});

test('Christmas Eve uses the real route and estimated Speed, not holiday labels', async ({ page }) => {
  await pauseClock(page, '2026-12-24T14:00:00Z');
  await page.goto('/santa-tracker');
  await expect(dashboardCard(page, 'Estimated Speed')).toHaveText('6,650,000 mph');
  await expect(page.locator('.tracker-status')).toContainText('Delivering Now');
  await expect(page.locator('main svg > title')).toContainText('estimated journey map');
  await page.clock.runFor(18000);
  await expect(dashboardCard(page, 'Estimated Speed')).toHaveText('6,650,000 mph');
});

for (const [before, after, status, content] of [
  ['2026-11-09T23:59:59Z', '2026-11-10T00:00:00Z', 'Prepping the route in', 'Route Research Report'],
  ['2026-12-22T23:59:59Z', '2026-12-23T00:00:00Z', 'Prepar', 'Workshop Dispatch'],
  ['2026-12-25T23:59:59Z', '2026-12-26T00:00:00Z', 'On Holiday in', 'Holiday Postcards'],
]) {
  test(`both public trackers cross ${after} without reloading`, async ({ page }) => {
    await pauseClock(page, before);
    await page.goto('/santa-tracker');
    await expect(page.locator('main svg[role="img"]')).toBeVisible();
    if (before.includes('12-25')) {
      await expect(page.locator('.tracker-status')).toContainText('Journey Complete');
      await expect(page.locator('.tracker-progress-value')).toHaveText('100.0%');
    }
    await page.clock.runFor(1000);
    await expect(page.locator('.tracker-status')).toContainText(status);
    await expect(page.locator('main')).toContainText(content);
    if (content === 'Route Research Report') {
      await expect(page.locator('main')).not.toContainText('Holiday Postcards');
      await expect(dashboardCard(page, 'Estimated Speed')).toHaveText('—');
      await expect(dashboardCard(page, 'Next Stop')).toHaveText('North Pole between trips');
    }
    // Reset the browser clock for the independent homepage transition.
    await page.clock.setSystemTime(new Date(before));
    await page.goto('/');
    await expect(page.locator('.tracker-banner .tracker-status')).toBeVisible();
    await page.clock.runFor(1000);
    await expect(page.locator('.tracker-banner .tracker-status')).toContainText(status);
    if (content === 'Route Research Report') {
      await expect(page.locator('.tracker-banner')).toContainText('North Pole between trips');
      await expect(page.locator('.tracker-banner')).not.toContainText('well-earned break');
    }
  });
}

test('seasonal preview controls show every boundary independently of the public date', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-06-15T12:00:00Z'));
  await page.goto('/santa-tracker/preview');
  await page.getByRole('switch', { name: 'Preview mode' }).click();
  for (const [label, status, content] of [
    ['9 November', 'On Holiday in', 'Holiday Postcards'],
    ['10 November', 'Prepping the route in', 'Route Research Report'],
    ['22 December', 'Prepping the route in', 'Route Research Report'],
    ['23 December', 'Preparing for Takeoff', 'Workshop Dispatch'],
    ['25 December', 'Journey Complete', 'Journey Summary'],
    ['26 December', 'On Holiday in', 'Holiday Postcards'],
  ]) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect(page.locator('.tracker-status')).toContainText(status);
    await expect(page.locator('main')).toContainText(content);
  }
  await page.goto('/santa-tracker');
  await expect(page.locator('main')).toContainText('Holiday Postcards');
  await expect(page.getByRole('button', { name: 'Preview Controls' })).toHaveCount(0);
});

test('research destination, activity and map stay aligned on desktop and mobile', async ({ page }) => {
  await pauseClock(page, '2026-12-12T12:00:00Z');
  for (const width of [1280, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/santa-tracker');
    await expect(page.locator('.tracker-status')).toContainText('Prepping the route in');
    const location = (await dashboardCard(page, 'Current Location').textContent()).replace('🧭 ', '');
    await expect(page.locator('.tracker-status')).toContainText(location);
    await expect(page.locator('main svg > title')).toHaveText(`Santa's route research map: ${location}`);
    await expect(page.locator('main svg > desc')).toContainText('not a Christmas Eve delivery stop');
    await expect(page.locator('.tracker-map-caption')).toHaveText(`Route research in ${location}`);
    const activity = await page.locator('.tracker-status-message').textContent();
    await expect(page.locator('main svg > desc')).toContainText(activity);
    await expect(page.locator('.tracker-story-card').first()).toContainText(activity);
    await expect(page.getByRole('button', { name: 'Share this postcard' })).toHaveCount(0);
    await expect(dashboardCard(page, 'ETA')).toHaveText('Quick research trip');
    await expect(dashboardCard(page, 'Route Stops')).toHaveText('Research, not deliveries');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.clock.runFor(18000);
    await expect(dashboardCard(page, 'Current Location')).toContainText(location);
    await expect(dashboardCard(page, 'Estimated Speed')).toHaveText('—');
  }
});

for (const date of ['2026-11-09T12:00:00Z', '2026-12-26T00:00:00Z', '2027-01-01T12:00:00Z']) {
  test(`holiday return messages match the annual research transition at ${date}`, async ({ page }) => {
    await page.clock.setFixedTime(new Date(date));
    await page.goto('/');
    const banner = page.locator('.tracker-banner');
    await expect(banner).toContainText('On Holiday in');
    await expect(banner).toContainText('Route-research trips begin on 10 November');
    await expect(banner).not.toContainText('1 December');
    await page.goto('/santa-tracker');
    await expect(page.locator('.tracker-status')).toContainText('On Holiday in');
    await expect(page.locator('.tracker-status-message')).toContainText('Route-research trips begin on 10 November');
    await expect(dashboardCard(page, 'Route Stops')).toHaveText('Research from 10 November');
    await expect(page.locator('main')).not.toContainText('1 December');
  });
}
