import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

async function setup(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  await page.clock.pauseAt(Date.now() + 1000);
  await page.addInitScript(() => {
    sessionStorage.setItem('santa-message-offer-shown', 'shown');
    window.__gameAudioStarts = 0;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (Audio) {
      const original = Audio.prototype.createOscillator;
      Audio.prototype.createOscillator = function () {
        window.__gameAudioStarts++;
        return original.call(this);
      };
    }
  });
  await page.route(/youtube\.com|googlevideo\.com/, route => route.abort());
  await page.goto('/#christmas-pairs');
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
  await page.addStyleTag({ content: '* { animation: none !important; transition: none !important; scroll-behavior: auto !important; }' });
  const game = page.getByRole('region', { name: 'Christmas Pairs', exact: true });
  await game.scrollIntoViewIfNeeded();
  return game;
}

const cards = game => game.locator('.christmas-pairs__card');
const shown = game => game.locator('.christmas-pairs__card.is-shown');
// Evidence isolates this section; fixed navigation/radio are verified separately.
const evidenceStyle = '.navbar, .radio-dock { visibility: hidden !important; }';
async function layout(page, game, width) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  const bounds = await cards(game).evaluateAll(nodes => nodes.map(node => {
    const r = node.getBoundingClientRect();
    return { x: r.x, right: r.right, width: r.width, height: r.height };
  }));
  for (const card of bounds) {
    expect(card.x).toBeGreaterThanOrEqual(0);
    expect(card.right).toBeLessThanOrEqual(width);
    expect(card.width).toBeGreaterThanOrEqual(44);
    expect(card.height).toBeGreaterThanOrEqual(44);
  }
}
async function cardGroups(game) {
  const sources = await cards(game).evaluateAll(nodes => nodes.map(node => node.querySelector('img').getAttribute('src')));
  return [...new Set(sources)].map(src => sources.flatMap((source, index) => source === src ? [index] : []));
}
async function solve(game) {
  for (const [a, b] of await cardGroups(game)) {
    if (await cards(game).nth(a).getAttribute('class').then(value => value.includes('is-matched'))) continue;
    await cards(game).nth(a).click();
    await cards(game).nth(b).click();
  }
}

for (const width of [320, 390, 1440]) {
  test(`free pairs gameplay, progression, pause and browser best at ${width}px`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: 1000 });
    const game = await setup(page);
    mkdirSync('generated-artifacts', { recursive: true });
    await game.screenshot({ path: `generated-artifacts/christmas-pairs-idle-${width}.jpg`, style: evidenceStyle });
    expect(await game.evaluate(el => el.previousElementSibling.classList.contains('soundboard'))).toBe(true);
    await expect(game.getByRole('button', { name: 'Turn sound on' })).toHaveAttribute('aria-pressed', 'false');
    expect(await page.evaluate(() => window.__gameAudioStarts)).toBe(0);
    await game.getByRole('button', { name: 'Start game' }).click();
    await expect(shown(game)).toHaveCount(6);
    await layout(page, game, width);
    await expect(game.locator('.christmas-pairs__grid')).toBeFocused();
    const groups = await cardGroups(game);
    await cards(game).first().dispatchEvent('click');
    await page.clock.runFor(1000);
    await game.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(shown(game)).toHaveCount(0);
    const before = await game.locator('.christmas-pairs__board-note').textContent();
    await page.clock.runFor(15000);
    expect(await game.locator('.christmas-pairs__board-note').textContent()).toBe(before);
    await game.locator('.christmas-pairs__pause-cover').getByRole('button', { name: 'Resume', exact: true }).click();
    await page.clock.runFor(4050);
    await expect(shown(game)).toHaveCount(0);
    await expect(cards(game).first()).toHaveAccessibleName('Card 1, face down');
    await cards(game).nth(groups[0][0]).focus();
    await page.keyboard.press('Enter');
    await expect(shown(game)).toHaveCount(1);
    await cards(game).nth(groups[1][0]).click();
    await expect(shown(game)).toHaveCount(2);
    await game.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.clock.runFor(2000);
    await game.locator('.christmas-pairs__pause-cover').getByRole('button', { name: 'Resume', exact: true }).click();
    await expect(shown(game)).toHaveCount(2);
    await cards(game).nth(groups[2][0]).dispatchEvent('click');
    await expect(shown(game)).toHaveCount(2);
    await page.clock.runFor(950);
    await expect(shown(game)).toHaveCount(0);
    await solve(game);
    await expect(game.getByRole('button', { name: 'Next level' })).toBeFocused();
    await expect(game.locator('.christmas-pairs__stat--best strong')).toHaveText('1');
    await game.getByRole('button', { name: 'Next level' }).click();
    await expect(shown(game)).toHaveCount(8);
    await layout(page, game, width);
    await page.clock.runFor(4050);
    await solve(game);
    await expect(game.locator('.christmas-pairs__stat--best strong')).toHaveText('2');
    await game.getByRole('button', { name: 'Next level' }).click();
    await expect(shown(game)).toHaveCount(12);
    await layout(page, game, width);
    await page.clock.runFor(3050);
    await expect(shown(game)).toHaveCount(0);
    await cards(game).first().click();
    await game.getByRole('button', { name: 'Restart level' }).click();
    await expect(shown(game)).toHaveCount(12);
    await expect(game.locator('.christmas-pairs__stat--center strong')).toHaveText('0 / 6');
    expect(await page.evaluate(() => window.__gameAudioStarts)).toBe(0);
    if (width === 390) {
      mkdirSync('generated-artifacts', { recursive: true });
      await game.screenshot({ path: 'generated-artifacts/christmas-pairs-mobile.jpg' });
    }
    if (width === 320 || width === 1440) {
      for (const count of [6, 8, 10, 12]) {
        await expect(shown(game)).toHaveCount(count * 2);
        await layout(page, game, width);
        await page.clock.runFor(3050);
        if (count === 12) {
          await game.screenshot({ path: `generated-artifacts/christmas-pairs-24-cards-${width}.jpg`, style: evidenceStyle });
        }
        await solve(game);
        await expect(game.locator('.christmas-pairs__stat--center strong')).toHaveText(`${count} / ${count}`);
        await expect(game.locator('.christmas-pairs__stat--best strong')).toHaveText(String(count / 2));
        if (count !== 12) {
          await game.getByRole('button', { name: 'Next level' }).click();
          await expect(cards(game)).toHaveCount((count + 2) * 2);
        }
      }
      await game.getByRole('button', { name: 'Next level' }).click();
      await expect(shown(game)).toHaveCount(24);
      await layout(page, game, width);
      await page.clock.runFor(2050);
      await solve(game);
      await expect(game.locator('.christmas-pairs__stat--best strong')).toHaveText('7');
      await game.getByRole('button', { name: 'Play again', exact: true }).click();
      await expect(shown(game)).toHaveCount(6);
      await expect(game.locator('.christmas-pairs__stat strong').first()).toHaveText('1');
    }
    await page.reload();
    await expect(game.getByRole('button', { name: 'Start game' })).toBeVisible();
    await expect(game.locator('.christmas-pairs__stat--best strong')).toHaveText(width === 390 ? '2' : '7');
    await expect(game.getByRole('button', { name: 'Turn sound on' })).toBeVisible();
  });
}

test('picture failure can be retried, and blocked storage does not prevent play', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = function () { throw new Error('Storage blocked'); };
    Storage.prototype.setItem = function () { throw new Error('Storage blocked'); };
  });
  await page.route('**/images/christmas-pairs/*.webp', route => route.abort());
  const game = await setup(page);
  await game.getByRole('button', { name: 'Start game' }).click();
  await expect(game.getByRole('button', { name: 'Retry images' })).toBeVisible();
  await page.unroute('**/images/christmas-pairs/*.webp');
  await game.getByRole('button', { name: 'Retry images' }).click();
  await expect(shown(game)).toHaveCount(6);
  await page.clock.runFor(5050);
  await solve(game);
  await expect(game.locator('.christmas-pairs__stat--best strong')).toHaveText('1');
});

test('sound requires an explicit choice and game pauses when the tab is hidden', async ({ page }) => {
  const game = await setup(page);
  await game.getByRole('button', { name: 'Turn sound on' }).click();
  await expect(game.getByRole('button', { name: 'Turn sound off' })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.__gameAudioStarts)).toBeGreaterThan(0);
  await game.getByRole('button', { name: 'Start game' }).click();
  await expect(shown(game)).toHaveCount(6);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(game.locator('.christmas-pairs__pause-cover')).toBeVisible();
  await page.clock.runFor(10000);
  await expect(shown(game)).toHaveCount(0);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(game.locator('.christmas-pairs__pause-cover')).toBeVisible();
  await game.getByRole('button', { name: 'Turn sound off' }).click();
  await expect(game.getByRole('button', { name: 'Turn sound on' })).toHaveAttribute('aria-pressed', 'false');
  await game.getByRole('button', { name: 'Turn sound on' }).click();
  await expect(game.getByRole('button', { name: 'Turn sound off' })).toBeVisible();
  await page.reload();
  await expect(game.getByRole('button', { name: 'Turn sound on' })).toHaveAttribute('aria-pressed', 'false');
});

for (const width of [390, 1440]) {
  test(`workshop background loads behind the cards at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const game = await setup(page);
    const panel = game.locator('.christmas-pairs__game');
    expect(await panel.evaluate(el => getComputedStyle(el).backgroundImage)).toContain('workshop-background.webp');
    const image = await page.request.get('/images/christmas-pairs/workshop-background.webp');
    expect(image.ok()).toBe(true);
    expect(image.headers()['content-type']).toContain('image/webp');
    await game.getByRole('button', { name: 'Start game' }).click();
    await expect(shown(game)).toHaveCount(6);
    await layout(page, game, width);
    mkdirSync('generated-artifacts', { recursive: true });
    await game.screenshot({ path: `generated-artifacts/christmas-pairs-background-${width}.jpg` });
    await page.clock.runFor(5050);
    await expect(shown(game)).toHaveCount(0);
    await cards(game).first().click();
    await expect(shown(game)).toHaveCount(1);
  });
}

for (const width of [320, 390, 1440]) {
  test(`approved controls, live scores and contained decoration at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript(() => localStorage.setItem('santa-radio-christmas-pairs-best', '9'));
    const game = await setup(page);
    const start = game.getByRole('button', { name: 'Start game', exact: true });
    const sound = game.getByRole('button', { name: /Turn sound (on|off)/ });
    await expect(sound).toHaveCount(1);
    await expect(game.locator('.christmas-pairs__stat--best strong')).toHaveText('9');
    await expect(game.locator('.christmas-pairs__stat--center strong')).toHaveText('0 / 3');
    await expect(start).toHaveClass(/--ruby/);
    await expect(game.locator('.christmas-pairs__decor')).toHaveAttribute('aria-hidden', 'true');
    await expect(game.locator('.christmas-pairs__decor')).toHaveCSS('pointer-events', 'none');
    for (const control of [start, sound]) {
      const box = await control.boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      await control.focus();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      await expect(control).toBeFocused();
      await expect(control).toHaveCSS('outline-style', 'solid');
      await expect(control).toHaveCSS('outline-width', '3px');
      expect(await control.evaluate(el => {
        const r = el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      })).toBe(true);
    }
    if (width >= 390) {
      const a = await start.boundingBox();
      const b = await sound.boundingBox();
      expect(Math.abs(a.y + a.height / 2 - b.y - b.height / 2)).toBeLessThan(2);
    }
    // Expanded text must reflow without clipping the title, score labels or actions.
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    // Only Christmas Pairs is in scope: unrelated homepage sections may overflow
    // when the root size changes. Check this section and its actual text bounds.
    expect(await game.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    for (const target of [game.locator('h2'), game.locator('.christmas-pairs__scoreline'), start, sound]) {
      const box = await target.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
    for (const target of await game.locator('h2, .christmas-pairs__stat-label, .christmas-pairs__stat strong').all()) {
      expect(await target.evaluate(el => {
        const range = document.createRange();
        range.selectNodeContents(el);
        const text = range.getBoundingClientRect();
        const section = el.closest('section').getBoundingClientRect();
        return text.left >= section.left - .5 && text.right <= section.right + .5;
      })).toBe(true);
    }
    await page.addStyleTag({ content: 'html { font-size: 100% !important; }' });
    await start.click();
    await expect(shown(game)).toHaveCount(6);
    await expect(sound).toHaveCount(1);
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await game.getByRole('button', { name: 'Pause', exact: true }).click();
    const cover = game.locator('.christmas-pairs__pause-cover');
    await expect(cover).toBeVisible();
    expect(await cover.evaluate(el => el.scrollHeight <= el.clientHeight)).toBe(true);
    await cover.getByRole('button', { name: 'Resume', exact: true }).click();
    expect(await game.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.addStyleTag({ content: 'html { font-size: 100% !important; }' });
    await page.clock.runFor(5050);
    const [[a, b]] = await cardGroups(game);
    await cards(game).nth(a).click();
    await cards(game).nth(b).click();
    await expect(game.locator('.christmas-pairs__stat--center strong')).toHaveText('1 / 3');
    await expect(game.locator('.christmas-pairs__live')).toHaveText('1 of 3 pairs found.');
    await solve(game);
    await expect(game.locator('.christmas-pairs__stat--best strong')).toHaveText('9');
    expect(await page.evaluate(() => localStorage.getItem('santa-radio-christmas-pairs-best'))).toBe('9');
  });
}

test('five-second preview transitions to matching with the real browser clock', async ({ page }) => {
  const game = await setup(page);
  await page.clock.resume();
  await game.getByRole('button', { name: 'Start game', exact: true }).click();
  await expect(shown(game)).toHaveCount(6);
  await expect(game.locator('.christmas-pairs__board-note')).toContainText('5s');
  await expect(shown(game)).toHaveCount(0, { timeout: 7000 });
  await expect(game.locator('.christmas-pairs__board-note')).toHaveText('Find the matching pictures');
});

test('loading and unavailable-audio feedback stay operable', async ({ page }) => {
  await page.addInitScript(() => {
    window.AudioContext = undefined;
    window.webkitAudioContext = undefined;
  });
  const game = await setup(page);
  await game.getByRole('button', { name: 'Turn sound on' }).click();
  await expect(game.getByText('Sound is unavailable on this device.')).toBeVisible();
  await expect(game.getByRole('button', { name: 'Turn sound on' })).toHaveAttribute('aria-pressed', 'false');
  const pending = [];
  await page.route('**/images/christmas-pairs/*.webp', route => { pending.push(route); });
  await game.getByRole('button', { name: 'Start game' }).click();
  await expect(game.getByRole('status')).toContainText('Setting the picture cards...');
  await expect(game.getByRole('button', { name: /Turn sound/ })).toHaveCount(1);
  await page.unroute('**/images/christmas-pairs/*.webp');
  await Promise.all(pending.map(route => route.continue()));
  await expect(shown(game)).toHaveCount(6);
});
