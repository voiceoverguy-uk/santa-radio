import { test, expect } from '@playwright/test';

const examples = [
  ['boy', 'Harry'], ['girl', 'Arabella'], ['ayla', 'Ayla'],
  ['mohani', 'Mohani'], ['charlotte', 'Charlotte'],
];
const start = page => page.getByRole('button', { name: 'Hear an example audio message', exact: true });
const stop = page => page.getByRole('button', { name: 'Stop example message', exact: true });
const audio = page => page.locator('.santa-message-example__audio');
const image = page => page.locator('.santa-certificate-examples__image');

async function visit(page, path) {
  await page.clock.install();
  await page.addInitScript(() => {
    sessionStorage.setItem('santa-radio-example-last', 'charlotte');
    sessionStorage.setItem('santa-message-offer-shown', 'shown');
    // Exercise audio lifecycle deterministically; the existing sample suite
    // separately verifies real decoding and playback for all five recordings.
    const load = HTMLMediaElement.prototype.load;
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.load = function () {
      if (!this.classList.contains('santa-message-example__audio')) return load.call(this);
    };
    HTMLMediaElement.prototype.play = function () {
      if (!this.classList.contains('santa-message-example__audio')) return play.call(this);
      this.dispatchEvent(new Event('play'));
      this.dispatchEvent(new Event('playing'));
      return Promise.resolve();
    };
  });
  await page.route('**/api/radio-metadata*', route => route.fulfill({
    json: { available: false, current: null, upcoming: [] },
  }));
  await page.goto(path);
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
  await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });
  await page.mouse.move(0, 0);
}

for (const path of ['/', '/free-santa-message']) {
  for (const { width, motion } of [
    { width: 1280, motion: 'no-preference' },
    { width: 390, motion: 'no-preference' },
    { width: 320, motion: 'reduce' },
  ]) {
    test(`sample pins its matching certificate and releases on stop or end on ${path} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: motion });
      await visit(page, path);
      for (const [index, [key, name]] of examples.entries()) {
        await start(page).click();
        await expect(audio(page)).toHaveAttribute('src', `/audio/examples/santa-message-${key}.mp3`);
        const src = `/certificates/examples/${name.toLowerCase()}.webp`;
        await expect(image(page)).toHaveAttribute('src', src);
        await expect(image(page)).toHaveAttribute('alt', `Example Official Nice List Certificate for ${name}`);
        await expect(image(page)).toHaveJSProperty('naturalWidth', 1800);
        await page.mouse.move(0, 0);
        await page.clock.runFor(16_000);
        await expect(image(page)).toHaveAttribute('src', src);
        if (index === 0) {
          await page.getByRole('button', { name: `Open ${name}'s certificate example`, exact: true }).click();
          const dialog = page.getByRole('dialog', { name: `${name}'s certificate example`, exact: true });
          await expect(dialog.locator('img')).toHaveAttribute('src', src);
          await page.clock.runFor(6000);
          await expect(dialog.locator('img')).toHaveAttribute('src', src);
          await page.keyboard.press('Escape');
          await expect(dialog).not.toBeVisible();
        }
        if (index === 3) {
          const card = page.locator('.santa-certificate-examples');
          await card.evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
          await card.screenshot({
            path: `generated-artifacts/sample-certificates/${path === '/' ? 'home' : 'maker'}-${width}-mohani.png`,
            animations: 'disabled',
          });
        }
        if (index % 2) await audio(page).dispatchEvent('ended');
        else await stop(page).click();
        await expect(start(page)).toBeVisible();
        await start(page).focus();
        await page.mouse.move(0, 0);
        const releasedSrc = await image(page).getAttribute('src');
        await page.clock.runFor(5100);
        if (motion === 'reduce') await expect(image(page)).toHaveAttribute('src', releasedSrc);
        else await expect(image(page)).not.toHaveAttribute('src', releasedSrc);
      }
    });
  }
}

test('errors, cancelled loading and another audio source release the certificate', async ({ page }) => {
  await visit(page, '/free-santa-message');
  const expectReleased = async () => {
    await expect(start(page)).toBeVisible();
    await start(page).focus();
    await page.mouse.move(0, 0);
    const previous = await image(page).getAttribute('src');
    await page.clock.runFor(5100);
    await expect(image(page)).not.toHaveAttribute('src', previous);
  };
  await start(page).click();
  await audio(page).dispatchEvent('error');
  await expect(page.getByRole('alert')).toContainText('could not be played');
  await expectReleased();
  await start(page).click();
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('santa-radio:soundboard-start')));
  await expectReleased();
  await start(page).click();
  await page.evaluate(() => {
    const other = document.createElement('audio');
    document.body.append(other);
    other.dispatchEvent(new Event('play'));
    other.remove();
  });
  await expectReleased();
  await audio(page).evaluate(element => {
    element.play = () => new Promise(() => {});
  });
  await start(page).click();
  await expect(stop(page)).toHaveAttribute('aria-busy', 'true');
  await expect(image(page)).toHaveAttribute('src', '/certificates/examples/mohani.webp');
  await stop(page).click();
  await expectReleased();
});
