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
    await cards(game).nth(a).click();
    await cards(game).nth(b).click();
  }
}

for (const width of [320, 390, 1440]) {
  test(`free pairs gameplay, progression, pause and browser best at ${width}px`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: 1000 });
    const game = await setup(page);
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
    if (width === 320) {
      for (const count of [6, 8, 10, 12]) {
        await expect(shown(game)).toHaveCount(count * 2);
        await layout(page, game, width);
        await page.clock.runFor(3050);
        await solve(game);
        if (count !== 12) {
          await game.getByRole('button', { name: 'Next level' }).click();
          await expect(cards(game)).toHaveCount((count + 2) * 2);
        }
      }
    }
    await page.reload();
    await expect(game.getByRole('button', { name: 'Start game' })).toBeVisible();
    await expect(game.locator('.christmas-pairs__stat--best strong')).toHaveText(width === 320 ? '6' : '2');
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
