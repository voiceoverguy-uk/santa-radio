import { test, expect } from '@playwright/test';
import { studioLetterChoices, createStudioLetter, CERTIFICATE_WRITE_MS,
  SIGNATURE_WRITE_MS, GIFT_EXAMPLE_INTERVAL_MS, letterBodyDuration, letterDuration } from '../src/lib/santaStudioLetter.js';
import { certificateExampleNames, studioGiftExampleNames } from '../src/lib/santaCertificateExamples.js';

const gifts = page => page.locator('.studio-gifts');
const body = page => gifts(page).locator('.studio-gifts__gallery .studio-letter__text');
const readable = page => gifts(page).locator('.studio-gifts__gallery .studio-gifts__sr');

async function visit(page, { reduced = false, clock = true } = {}) {
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  if (clock) await page.clock.install();
  await page.addInitScript(() => {
    sessionStorage.setItem('santa-message-offer-shown', 'shown');
    sessionStorage.setItem('santa-radio-example-last', 'charlotte');
    localStorage.setItem('santa-radio-cookie-consent', JSON.stringify({ necessary: true, analytics: false }));
    // Development-only media mocks: no requests to live radio or greetings.
    HTMLMediaElement.prototype.load = function () {};
    HTMLMediaElement.prototype.play = function () {
      this.dispatchEvent(new Event('play'));
      this.dispatchEvent(new Event('playing'));
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function () {};
  });
  await page.route(/youtube\.com|googlevideo\.com|citrus3\.com|\/audio\/examples\//, route => route.abort());
  await page.route('**/api/santa-names?*', route => route.fulfill({ json: { records: [], hostedCount: 300, warning: null } }));
  await page.route('**/api/radio-metadata*', route => route.fulfill({ json: { available: false, current: null, upcoming: [] } }));
  await page.goto('/free-santa-message', { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
  await gifts(page).scrollIntoViewIfNeeded();
  await expect(gifts(page)).toHaveAttribute('data-demo-name', 'Edward');
  await expect(gifts(page).getByRole('heading', { level: 4 })).toHaveText('From Santa’s desk — a gift preview for Edward');
  await expect(gifts(page)).not.toContainText('Example for');
}

// Exercise the automatic cycle rather than relying on removed manual controls.
async function advanceExample(page) {
  const reduced = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.activeElement?.blur());
  await page.clock.runFor(GIFT_EXAMPLE_INTERVAL_MS + 50);
  if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
}

test('the additional requested names rotate through all gifts without extra certificate files', async ({ page }) => {
  test.setTimeout(60000);
  const additionalNames = ['Lydia', 'Layla', 'Jack', 'Ellis', 'Matilda', 'Jasmine', 'Claudia', 'Bob', 'Alfie'];
  expect(studioGiftExampleNames).toEqual([...certificateExampleNames, ...additionalNames]);
  expect(new Set(studioGiftExampleNames).size).toBe(studioGiftExampleNames.length);
  const certificateRequests = [];
  page.on('request', request => {
    if (request.url().includes('/certificates/examples/')) certificateRequests.push(request.url());
  });
  await visit(page, { reduced: true });
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  for (const name of studioGiftExampleNames) {
    await expect(gifts(page)).toHaveAttribute('data-demo-name', name);
    if (additionalNames.includes(name)) {
      await expect(gifts(page).locator('.studio-certificate__name')).toHaveText(name);
      await expect(readable(page)).toContainText(`Dear ${name},`);
      const pictureName = gifts(page).locator('.studio-gifts__preview-stack .studio-santa-picture__name');
      await expect(pictureName).toHaveText(name);
      await expect(pictureName).toHaveAttribute('data-fitted', 'true');
      await gifts(page).getByRole('button', { name: 'Enlarge certificate', exact: true }).click();
      await expect(page.locator('dialog .studio-certificate__name')).toHaveText(name);
      await expect(page.locator('dialog .studio-certificate > img')).toHaveAttribute('src', '/certificates/examples/blank-master.webp');
      await page.keyboard.press('Escape');
    }
    await advanceExample(page);
  }
  await expect(gifts(page)).toHaveAttribute('data-demo-name', 'Edward');
  for (const name of additionalNames) {
    expect(certificateRequests.some(url => url.endsWith(`/${name.toLowerCase()}.webp`))).toBe(false);
  }
});

// Compare real browser pixels with an unclipped rendering at the SAME position.
// A DOM rectangle cannot tell us whether Great Vibes' swashes were cut off.
async function scriptInk(page, span, { partial = false } = {}) {
  await page.evaluate(() => document.fonts.load('60px "Great Vibes"'));
  await span.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }));
  const geometry = await span.evaluate(el => {
    const rect = el.getBoundingClientRect();
    const font = parseFloat(getComputedStyle(el).fontSize);
    const certificate = el.closest('.studio-certificate')?.getBoundingClientRect();
    const paper = el.closest('.studio-letter__paper')?.getBoundingClientRect();
    const parent = certificate || paper || el.closest('.studio-santa-picture')?.getBoundingClientRect();
    const frame = el.closest('.studio-santa-picture__name')?.getBoundingClientRect();
    return { frame: frame?.toJSON(), x: Math.max(0, Math.floor(rect.left - font)),
      y: Math.max(0, Math.floor(rect.top - font)),
      right: Math.min(innerWidth, Math.ceil(rect.right + font)),
      bottom: Math.min(innerHeight, Math.ceil(rect.bottom + font)),
      parent: { x: parent.x, y: parent.y, width: parent.width, height: parent.height } };
  });
  const clip = { x: geometry.x, y: geometry.y,
    width: geometry.right - geometry.x, height: geometry.bottom - geometry.y };
  const capture = async () => (await page.screenshot({ clip, animations: 'disabled' })).toString('base64');
  const actual = await capture();
  const original = await span.getAttribute('style');
  await span.evaluate((el, partial) => {
    // During writing retain the exact horizontal reveal edge; release ONLY
    // the other edges to detect lost upper/lower/leading glyph ink.
    const edge = getComputedStyle(el).clipPath;
    el.style.clipPath = partial
      ? edge.replace(/^inset\(\S+ (.+) \S+ \S+\)$/, 'inset(-3em $1 -3em -3em)')
      : 'none';
  }, partial);
  const reference = await capture();
  await span.evaluate(el => { el.style.visibility = 'hidden'; });
  const blank = await capture();
  await span.evaluate((el, style) => {
    if (style === null) el.removeAttribute('style');
    else el.setAttribute('style', style);
  }, original);
  const pixels = await page.evaluate(async ({ actual, reference, blank }) => {
    const decode = async base64 => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      return ctx.getImageData(0, 0, image.width, image.height);
    };
    const [a, r, b] = await Promise.all([actual, reference, blank].map(decode));
    let changed = 0, ink = 0, left = r.width, top = r.height, right = -1, bottom = -1;
    for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++) {
      const i = (y * r.width + x) * 4;
      if ([0, 1, 2].some(c => Math.abs(r.data[i + c] - b.data[i + c]) > 12)) {
        ink++; left = Math.min(left, x); top = Math.min(top, y);
        right = Math.max(right, x); bottom = Math.max(bottom, y);
      }
      if ([0, 1, 2].some(c => Math.abs(a.data[i + c] - r.data[i + c]) > 12)) changed++;
    }
    return { changed, ink, left, top, right, bottom };
  }, { actual, reference, blank });
  if (pixels.changed) {
    await test.info().attach('script-actual', { body: Buffer.from(actual, 'base64'), contentType: 'image/png' });
    await test.info().attach('script-unclipped', { body: Buffer.from(reference, 'base64'), contentType: 'image/png' });
  }
  return { ...pixels, frame: geometry.frame, absoluteInk: {
    left: clip.x + pixels.left, right: clip.x + pixels.right + 1,
    top: clip.y + pixels.top, bottom: clip.y + pixels.bottom + 1,
  }, bounds: {
    left: (clip.x + pixels.left - geometry.parent.x) / geometry.parent.width,
    right: (clip.x + pixels.right - geometry.parent.x) / geometry.parent.width,
    top: (clip.y + pixels.top - geometry.parent.y) / geometry.parent.height,
    bottom: (clip.y + pixels.bottom - geometry.parent.y) / geometry.parent.height,
  } };
}

async function expectPictureInk(page, span) {
  await expect(span.locator('..')).toHaveAttribute('data-fitted', 'true');
  const ink = await scriptInk(page, span);
  expect(ink.ink).toBeGreaterThan(10);
  expect(ink.changed, 'no script ink is clipped').toBe(0);
  // Pixel bounds, not element/advance boxes. Half-pixel rounding tolerance.
  expect(ink.absoluteInk.left).toBeGreaterThanOrEqual(ink.frame.left - .5);
  expect(ink.absoluteInk.right).toBeLessThanOrEqual(ink.frame.right + .5);
  expect(ink.absoluteInk.top).toBeGreaterThanOrEqual(ink.frame.top - .5);
  expect(ink.absoluteInk.bottom).toBeLessThanOrEqual(ink.frame.bottom + .5);
  expect(Math.abs((ink.absoluteInk.left + ink.absoluteInk.right) / 2 -
    (ink.frame.left + ink.frame.right) / 2)).toBeLessThan(1.5);
  return span.evaluate(el => parseFloat(getComputedStyle(el).fontSize) /
    el.closest('.studio-santa-picture').getBoundingClientRect().width);
}

// Render the real component with arbitrary fixture names without changing the
// public name catalogue, access flow or introducing a visitor-facing test route.
async function renderGiftFixture(page, name) {
  await page.evaluate(async name => {
    if (!window.renderGift) {
      const [{ default: React }, { default: ReactDOM }, { default: Gifts }] = await Promise.all([
        import('/node_modules/.vite/deps/react.js'),
        import('/node_modules/.vite/deps/react-dom_client.js'),
        import('/src/components/SantaStudioGifts.jsx'),
      ]);
      const host = document.createElement('div');
      host.style.cssText = 'width:min(360px, calc(100vw - 24px));margin:20px auto';
      document.body.replaceChildren(host);
      const root = ReactDOM.createRoot(host);
      window.renderGift = name => root.render(React.createElement(Gifts, { previewName: name }));
    }
    window.renderGift(name);
  }, name);
  await expect(gifts(page)).toHaveAttribute('data-demo-name', name);
}

for (const width of [390, 1440]) {
  test(`rotating Santa pictures dissolve over loaded artwork at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    let release;
    const waiting = new Promise(resolve => { release = resolve; });
    await page.route('**/images/santa-nice-list-2.jpg', async route => {
      await waiting;
      await route.continue();
    });
    await visit(page);
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
    // Cover both a recipient-keyed remount and a checked name held across rotation.
    if (width === 1440) await renderGiftFixture(page, 'Han Solo');
    const picture = gifts(page).locator('.studio-gifts__preview-stack .studio-santa-picture');
    await advanceExample(page);
    await expect(gifts(page)).toHaveAttribute('data-demo-name', width === 1440 ? 'Han Solo' : 'Ayla');
    await expect(picture.locator('> img')).toHaveAttribute('src', '/images/santa-nice-list-2.jpg');
    const outgoing = picture.locator('.studio-santa-picture__outgoing');
    await expect(outgoing.locator('img')).toHaveAttribute('src', '/images/santa-nice-list.jpg');
    await expect(outgoing).toHaveAttribute('aria-hidden', 'true');
    expect(await outgoing.evaluate(el => getComputedStyle(el).animationName)).toBe('none');
    expect(await outgoing.evaluate(el => getComputedStyle(el).opacity)).toBe('1');
    release();
    await expect.poll(() => outgoing.evaluate(el => getComputedStyle(el).animationName))
      .toBe('studio-picture-dissolve');
    const halfway = await outgoing.evaluate(el => {
      const animation = el.getAnimations()[0];
      animation.pause();
      animation.currentTime = 350;
      return { opacity: Number(getComputedStyle(el).opacity),
        duration: animation.effect.getTiming().duration };
    });
    expect(halfway.duration).toBe(700);
    expect(halfway.opacity).toBeGreaterThan(.4);
    expect(halfway.opacity).toBeLessThan(.6);
    await expect(picture.locator('.studio-santa-picture__name')).toHaveAttribute('data-fitted', 'true');
    await picture.screenshot({ path: `test-results/picture-dissolve-${width}.png`, animations: 'allow' });
    await outgoing.evaluate(el => el.getAnimations()[0].finish());
    await expect(outgoing).toHaveCount(0);
    await advanceExample(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(outgoing).toHaveCount(0);
    await page.mouse.move(0, 0);
    await page.evaluate(() => document.activeElement?.blur());
    await page.clock.runFor(30000);
    await expect(picture.locator('> img')).toHaveAttribute('src', '/images/santa-nice-list-3.jpg');
  });
}

for (const width of [1440, 390, 320]) {
  test(`all picture safe frames contain complete names in both sizes at ${width}px`, async ({ page }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width, height: 1000 });
    await visit(page, { reduced: true });
    const names = ['Ayla', 'Han Solo', 'Lilliana Mai',
      'Alexandria Rose Montgomery', 'Élodie-Joséphine O’Neill', 'gj Áý'];
    const sizes = [];
    for (let picture = 0; picture < 3; picture++) {
      // Independently approved artwork clearances: below the heading/holly,
      // inside both hands and above the lower rolled parchment.
      const safe = [
        { left: .535, right: .866, top: .49, bottom: .791 },
        { left: .539, right: .891, top: .429, bottom: .781 },
        { left: .535, right: .855, top: .459, bottom: .781 },
      ][picture];
      for (const name of names) {
        await renderGiftFixture(page, name);
        const compact = gifts(page).locator('.studio-gifts__preview-stack .studio-santa-picture__name > span');
        const size = await expectPictureInk(page, compact);
        const geometry = await compact.evaluate(el => {
          const frame = el.parentElement.getBoundingClientRect();
          const image = el.closest('.studio-santa-picture').getBoundingClientRect();
          return { left: (frame.left - image.left) / image.width,
            right: (frame.right - image.left) / image.width,
            top: (frame.top - image.top) / image.height,
            bottom: (frame.bottom - image.top) / image.height };
        });
        expect(geometry.left).toBeGreaterThanOrEqual(safe.left);
        expect(geometry.right).toBeLessThanOrEqual(safe.right);
        expect(geometry.top).toBeGreaterThanOrEqual(safe.top);
        expect(geometry.bottom).toBeLessThanOrEqual(safe.bottom);
        if (name === 'Ayla') sizes[picture] = size;
        if (name === 'Lilliana Mai' || name === 'Alexandria Rose Montgomery') {
          expect(size).toBeLessThan(sizes[picture]);
        }
        await gifts(page).getByRole('button', { name: 'Enlarge Santa’s Nice List picture' }).click();
        const enlarged = page.locator('dialog .studio-santa-picture__name > span');
        expect(await expectPictureInk(page, enlarged)).toBeCloseTo(size, 4);
        await expect(page.locator('dialog .studio-gifts__watermark span')).toHaveCount(3);
        if (name === 'Lilliana Mai') {
          await page.locator('dialog .studio-santa-picture').screenshot({
            path: `test-results/picture-frame-${picture + 1}-${width}.png`,
          });
          if (width === 1440) {
            const frame = enlarged.locator('..');
            await frame.evaluate(el => { el.style.outline = '1px solid magenta'; });
            await page.locator('dialog .studio-santa-picture').screenshot({
              path: `test-results/picture-frame-guide-${picture + 1}.png`,
            });
            await frame.evaluate(el => el.style.removeProperty('outline'));
          }
          // Exercise an open popup through portrait/landscape-like resizing.
          await page.setViewportSize({ width: width === 1440 ? 390 : 844, height: 700 });
          expect(await expectPictureInk(page, enlarged)).toBeCloseTo(size, 4);
          await page.setViewportSize({ width, height: 1000 });
        }
        await page.keyboard.press('Escape');
      }
      await advanceExample(page);
      await expect(gifts(page).locator('.studio-gifts__preview-stack .studio-santa-picture > img'))
        .toHaveAttribute('src', `/images/santa-nice-list${picture === 2 ? '' : `-${picture + 2}`}.jpg`);
    }
  });
}

test('picture names wait for the real script font, then fit without changing during writing', async ({ page }) => {
  test.setTimeout(60000);
  let release;
  const waiting = new Promise(resolve => { release = resolve; });
  await page.route('**/GreatVibes-Regular.ttf', async route => {
    await waiting;
    await route.continue();
  });
  await visit(page);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await renderGiftFixture(page, 'Lilliana Mai');
  const frame = gifts(page).locator('.studio-gifts__preview-stack .studio-santa-picture__name');
  await expect(frame).toHaveAttribute('data-fitted', 'false');
  expect(await frame.evaluate(el => getComputedStyle(el).visibility)).toBe('hidden');
  // Change the name while the previous load/measurement is still pending.
  await renderGiftFixture(page, 'Élodie-Joséphine O’Neill');
  await gifts(page).getByRole('button', { name: 'Enlarge Santa’s Nice List picture' }).click();
  const enlargedFrame = page.locator('dialog .studio-santa-picture__name');
  await expect(enlargedFrame).toHaveAttribute('data-fitted', 'false');
  expect(await enlargedFrame.evaluate(el => getComputedStyle(el).visibility)).toBe('hidden');
  release();
  await expectPictureInk(page, enlargedFrame.locator('> span'));
  await page.keyboard.press('Escape');
  await expect(frame).toHaveAttribute('data-fitted', 'true');
  const style = await frame.getAttribute('style');
  await page.clock.runFor(800);
  expect(await frame.getAttribute('style')).toBe(style);
  const writing = frame.locator('> span');
  expect((await scriptInk(page, writing, { partial: true })).changed).toBe(0);
  await page.clock.runFor(CERTIFICATE_WRITE_MS);
  expect(await frame.getAttribute('style')).toBe(style);
  await expectPictureInk(page, writing);
});

for (const width of [1440, 390, 320]) {
  test(`script ink is complete and clear of certificate artwork at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await visit(page, { reduced: true });
    for (const name of certificateExampleNames) {
      await expect(gifts(page)).toHaveAttribute('data-demo-name', name);
      const compact = gifts(page).locator('.studio-certificate__name > span');
      const ink = await scriptInk(page, compact);
      expect(ink.ink, `${name} has rendered ink`).toBeGreaterThan(15);
      expect(ink.changed, `${name} compact script cropped`).toBe(0);
      expect(ink.bounds.top, `${name} clears introductory text`).toBeGreaterThan(.33);
      expect(ink.bounds.bottom, `${name} clears gold line`).toBeLessThan(.493);
      expect(Math.abs((ink.bounds.left + ink.bounds.right) / 2 - .5)).toBeLessThan(.02);
      await gifts(page).getByRole('button', { name: 'Enlarge certificate', exact: true }).click();
      const enlarged = await scriptInk(page, page.locator('dialog .studio-certificate__name > span'));
      expect(enlarged.changed, `${name} enlarged script cropped`).toBe(0);
      expect(enlarged.bounds.top).toBeGreaterThan(.33);
      expect(enlarged.bounds.bottom).toBeLessThan(.493);
      expect(Math.abs((enlarged.bounds.left + enlarged.bounds.right) / 2 - .5)).toBeLessThan(.015);
      await page.getByRole('button', { name: 'Close preview', exact: true }).click();
      await advanceExample(page);
    }
    const signature = gifts(page).locator('.studio-gifts__gallery .studio-letter__signature > span');
    expect((await scriptInk(page, signature)).changed).toBe(0);
    await gifts(page).getByRole('button', { name: 'Enlarge letter to read' }).click();
    const enlargedSignature = await scriptInk(page, page.locator('dialog .studio-letter__signature > span'));
    expect(enlargedSignature.changed).toBe(0);
    expect(enlargedSignature.ink).toBeGreaterThan(300);
    await expectSignatureSpacing(page, enlargedSignature.bounds);
    await page.screenshot({ path: `test-results/studio-signature-ink-${width}.png` });
  });
}

async function expectSignatureSpacing(page, ink) {
  const neighbours = await page.locator('dialog .studio-letter__signature').evaluate(el => {
    const paper = el.closest('.studio-letter__paper').getBoundingClientRect();
    const range = document.createRange();
    const textBounds = node => {
      range.selectNodeContents(node);
      const rect = range.getBoundingClientRect();
      return { top: (rect.top - paper.top) / paper.height,
        bottom: (rect.bottom - paper.top) / paper.height };
    };
    return { signoff: textBounds(el.previousElementSibling),
      closing: textBounds(el.nextElementSibling.querySelector('p')),
      ps: textBounds(el.nextElementSibling.lastElementChild) };
  });
  expect(ink.top).toBeGreaterThan(neighbours.signoff.bottom);
  expect(ink.bottom).toBeLessThan(neighbours.closing.top);
  expect(neighbours.closing.bottom).toBeLessThan(neighbours.ps.top);
  expect(neighbours.ps.bottom).toBeLessThan(.88);
}

for (const width of [1440, 390]) {
  test(`writing and immediate reveal preserve script ink at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await visit(page, { clock: true });
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
    await advanceExample(page);
    await expect(gifts(page)).toHaveAttribute('data-demo-name', 'Ayla');
    await page.clock.runFor(800);
    const name = gifts(page).locator('.studio-certificate__name > span');
    for (const enlarged of [false, true]) {
      if (enlarged) await gifts(page).getByRole('button', { name: 'Enlarge certificate', exact: true }).click();
      const span = enlarged ? page.locator('dialog .studio-certificate__name > span') : name;
      const ink = await scriptInk(page, span, { partial: true });
      expect(ink.ink).toBeGreaterThan(10);
      expect(ink.changed).toBe(0);
      if (enlarged) await page.getByRole('button', { name: 'Close preview', exact: true }).click();
    }
    const paragraphs = await body(page).locator(':scope > p').allTextContents();
    await page.clock.runFor(CERTIFICATE_WRITE_MS + letterBodyDuration({ paragraphs }) + SIGNATURE_WRITE_MS / 2 - 800);
    const signature = gifts(page).locator('.studio-gifts__gallery .studio-letter__signature > span');
    const compactInk = await scriptInk(page, signature, { partial: true });
    expect(compactInk.ink).toBeGreaterThan(5);
    expect(compactInk.changed).toBe(0);
    await gifts(page).getByRole('button', { name: 'Enlarge letter to read' }).click();
    const fullSignature = page.locator('dialog .studio-letter__signature > span');
    const partialInk = await scriptInk(page, fullSignature, { partial: true });
    expect(partialInk.ink).toBeGreaterThan(100);
    expect(partialInk.changed).toBe(0);
    // Enlarging always displays the complete document without a reveal control.
    expect((await scriptInk(page, fullSignature)).changed).toBe(0);
    await fullSignature.evaluate(el => { el.style.clipPath = 'inset(0 0% 0 0)'; });
    expect((await scriptInk(page, fullSignature)).changed).toBeGreaterThan(10);
    await fullSignature.evaluate(el => { el.style.clipPath = 'none'; });
    await page.getByRole('button', { name: 'Close preview', exact: true }).click();
    // Enlargement is fully readable immediately; the thumbnail keeps its own writing timeline.
    await page.clock.runFor(SIGNATURE_WRITE_MS);
    await expect(gifts(page)).toHaveAttribute('data-complete', 'true');
    expect((await scriptInk(page, name)).changed).toBe(0);
    expect((await scriptInk(page, signature)).changed).toBe(0);
    await gifts(page).getByRole('button', { name: 'Enlarge certificate', exact: true }).click();
    const fullName = page.locator('dialog .studio-certificate__name > span');
    expect((await scriptInk(page, fullName)).changed).toBe(0);
    await page.locator('dialog .studio-certificate').screenshot({ path: `test-results/studio-ayla-ink-${width}.png` });
    // Prove this pixel test detects the original tight-box regression.
    await fullName.evaluate(el => { el.style.clipPath = 'inset(0 0% 0 0)'; });
    expect((await scriptInk(page, fullName)).changed).toBeGreaterThan(10);
  });
}

test('letter substitutions use the verified public subset and inclusive whole-number ages', () => {
  expect(createStudioLetter('Edward', () => 0).age).toBe(3);
  expect(createStudioLetter('Edward', () => .999999).age).toBe(11);
  for (let index = 0; index < 200; index++) {
    const letter = createStudioLetter('Ayla');
    expect(letterDuration(letter)).toBeLessThan(GIFT_EXAMPLE_INTERVAL_MS);
    expect(Number.isInteger(letter.age) && letter.age >= 3 && letter.age <= 11).toBe(true);
    for (const key of Object.keys(studioLetterChoices)) expect(studioLetterChoices[key]).toContain(letter[key]);
    expect(letter.paragraphs.join('\n')).not.toMatch(/\[|\]|\{|\}|\.wav|\.mp3|ACTIVITY|ACHIEVEMENT|DESTINATION|TREATS/);
    expect(letter.paragraphs[0]).toBe('Dear Ayla,');
    expect(letter.paragraphs[7]).toContain('Now, Ayla, remember this:');
  }
});

test('compact desktop card groups gifts right of voucher controls without a full-size letter stack', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await visit(page, { reduced: true });
  const promotion = page.locator('.santa-studio-promotion');
  const preview = await gifts(page).boundingBox();
  const form = await promotion.locator('form').boundingBox();
  const card = await promotion.boundingBox();
  expect(form.x + form.width).toBeLessThanOrEqual(preview.x);
  expect(Math.abs(form.y - preview.y)).toBeLessThan(card.height);
  // The third compact gift now occupies the previously empty area below the pair.
  expect(card.height).toBeLessThan(750);
  const paper = await gifts(page).locator('.studio-gifts__gallery .studio-letter__paper').boundingBox();
  expect(paper.width / paper.height).toBeCloseTo(210 / 297, 2);
  expect(paper.height).toBeLessThan(350);
  await page.screenshot({ path: 'test-results/studio-compact-desktop.png' });
});

for (const width of [320, 390, 1440]) {
  test(`equal-height documents and personalised Santa picture fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await visit(page, { reduced: true });
    const certificate = await gifts(page).locator('.studio-gifts__gallery .studio-certificate').boundingBox();
    const letter = await gifts(page).locator('.studio-gifts__gallery .studio-letter__paper').boundingBox();
    const certificateCard = await gifts(page).locator('.studio-gifts__thumbnail--certificate').boundingBox();
    const letterCard = await gifts(page).locator('.studio-gifts__thumbnail--letter').boundingBox();
    expect(Math.abs(certificate.height - letter.height)).toBeLessThan(1);
    expect(Math.abs(certificate.y - letter.y)).toBeLessThan(1);
    expect(Math.abs(certificateCard.height - letterCard.height)).toBeLessThan(1);
    const picture = gifts(page).locator('.studio-gifts__preview-stack .studio-santa-picture');
    await expect(picture.locator('img')).toHaveJSProperty('naturalWidth', 1536);
    const box = await picture.boundingBox();
    expect(box.y).toBeGreaterThan(certificateCard.y + certificateCard.height);
    expect(box.width).toBeLessThanOrEqual(360);
    expect(box.width / box.height).toBeCloseTo(1.5, 2);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    const name = picture.locator('.studio-santa-picture__name > span');
    await expect(name).toHaveText('Edward');
    const font = await name.evaluate(el => ({
      family: getComputedStyle(el).fontFamily,
      size: parseFloat(getComputedStyle(el).fontSize),
    }));
    expect(font.family).toContain('Great Vibes');
    expect(font.size / box.width).toBeCloseTo(.1, 2);
    const ink = await scriptInk(page, name);
    expect(ink.changed).toBe(0);
    expect(ink.ink).toBeGreaterThan(30);
    expect(ink.bounds.left).toBeGreaterThan(.49);
    expect(ink.bounds.right).toBeLessThan(.91);
    expect(ink.bounds.top).toBeGreaterThan(.48);
    expect(ink.bounds.bottom).toBeLessThan(.8);
    const opener = gifts(page).getByRole('button', { name: 'Enlarge Santa’s Nice List picture' });
    await opener.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.studio-santa-picture__name')).toHaveText('Edward');
    expect(await dialog.locator('.studio-santa-picture__name > span').evaluate(el => getComputedStyle(el).clipPath)).toBe('none');
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(opener).toBeFocused();
  });
}

for (const width of [1440, 390]) {
test(`longest name and choices keep the complete letter inside A4 at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  await visit(page, { reduced: true });
  // Only the letter factory consumes this deterministic sequence: longest
  // activity/achievement/treat, Scotland, and the oldest supported age.
  await page.evaluate(() => {
    const original = Math.random;
    let index = 0;
    Math.random = () => new Error().stack.includes('santaStudioLetter')
      ? [.999, .999, .3, .999, .999][index++ % 5] : original();
  });
  for (let index = 0; index < 3; index++) {
    await advanceExample(page);
  }
  await expect(gifts(page)).toHaveAttribute('data-demo-name', 'Charlotte');
  await expect(body(page)).toContainText('11 already!');
  for (const choice of ['building Lego', 'finishing your homework on time', 'Scotland', 'carrots for the reindeer']) {
    await expect(body(page)).toContainText(choice);
  }
  await gifts(page).getByRole('button', { name: 'Enlarge letter to read' }).click();
  const text = page.getByRole('dialog').locator('.studio-letter__text');
  const expected = createStudioLetter('Charlotte', (() => {
    let index = 0;
    return () => [.999, .999, .3, .999, .999][index++ % 5];
  })());
  await expect(text.locator(':scope > p')).toHaveText(expected.paragraphs);
  await expect(text).toContainText(expected.closing[1]);
  const signatureInk = await scriptInk(page, page.locator('dialog .studio-letter__signature > span'));
  expect(signatureInk.changed).toBe(0);
  await expectSignatureSpacing(page, signatureInk.bounds);
  expect(await text.evaluate(el => {
    const paper = el.closest('.studio-letter__paper').getBoundingClientRect();
    const paragraphs = [...el.querySelectorAll('p, .studio-letter__signature')];
    return paragraphs.every(node => {
      const range = document.createRange();
      range.selectNodeContents(node);
      const rects = [...range.getClientRects()];
      return rects.every(rect => rect.top >= paper.top + paper.height * .22 &&
        rect.bottom < paper.top + paper.height * .88 &&
        rect.left >= paper.left + paper.width * .06 &&
        rect.right <= paper.right - paper.width * .06);
    });
  })).toBe(true);
});
}

for (const width of [1440, 390]) {
  test(`both gifts write and change recipient together every ten seconds at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await visit(page, { clock: true });
    const picture = gifts(page).locator('.studio-gifts__preview-stack .studio-santa-picture > img');
    await expect(picture).toHaveAttribute('src', '/images/santa-nice-list.jpg');
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
    await advanceExample(page);
    await expect(gifts(page)).toHaveAttribute('data-demo-name', 'Ayla');
    await expect(picture).toHaveAttribute('src', '/images/santa-nice-list-2.jpg');
    await expect(picture).toHaveJSProperty('naturalWidth', 1536);
    await page.mouse.move(0, 0);
    await page.evaluate(() => document.activeElement?.blur());
    const certificate = gifts(page).locator('.studio-certificate__name > span');
    const pictureName = gifts(page).locator('.studio-gifts__preview-stack .studio-santa-picture__name > span');
    await page.clock.runFor(800);
    expect(await certificate.evaluate(el => getComputedStyle(el).clipPath)).not.toBe('none');
    expect(await pictureName.evaluate(el => el.style.clipPath)).toBe(await certificate.evaluate(el => el.style.clipPath));
    await expect(gifts(page)).toHaveAttribute('data-complete', 'false');
    await page.clock.runFor(1200);
    await expect(body(page)).toContainText('Dear Ayla');
    expect(await certificate.evaluate(el => getComputedStyle(el).clipPath)).toBe('none');
    await page.clock.runFor(5000);
    await expect(gifts(page)).toHaveAttribute('data-complete', 'true');
    await page.clock.runFor(2900);
    await expect(gifts(page)).toHaveAttribute('data-demo-name', 'Ayla');
    await page.clock.runFor(200);
    await expect(gifts(page)).toHaveAttribute('data-demo-name', 'Erin');
    await expect(gifts(page).getByRole('heading', { level: 4 })).toHaveText('From Santa’s desk — a gift preview for Erin');
    await expect(picture).toHaveAttribute('src', '/images/santa-nice-list-3.jpg');
    await expect(picture).toHaveJSProperty('naturalWidth', 1536);
    await expect(gifts(page)).toHaveAttribute('data-complete', 'false');
    await expect(certificate).toHaveText('Erin');
    await expect(pictureName).toHaveText('Erin');
    await expect(readable(page)).toContainText('Dear Erin,');
    await expect(readable(page)).not.toContainText('Dear Ayla');
    await page.clock.runFor(10000);
    await expect(gifts(page)).toHaveAttribute('data-demo-name', 'Charlotte');
    await expect(picture).toHaveAttribute('src', '/images/santa-nice-list.jpg');
    await expect(certificate).toHaveText('Charlotte');
    await expect(pictureName).toHaveText('Charlotte');
    await expect(readable(page)).toContainText('Dear Charlotte,');
  });
}

for (const width of [390, 1440]) {
  test(`compact gift popups deter casual saving without blocking controls at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await visit(page, { reduced: true });
    const cancelled = async target => target.evaluate(el => ({
      context: !el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 })),
      drag: !el.dispatchEvent(new Event('dragstart', { bubbles: true, cancelable: true })),
    }));
    for (const label of ['Enlarge certificate', 'Enlarge letter to read', 'Enlarge Santa’s Nice List picture']) {
      const thumbnail = gifts(page).getByRole('button', { name: label, exact: true });
      expect(await cancelled(thumbnail)).toEqual({ context: true, drag: true });
      for (const image of await thumbnail.locator('img').all()) await expect(image).toHaveAttribute('draggable', 'false');
      await thumbnail.click();
      const dialog = page.getByRole('dialog');
      const bounds = await dialog.boundingBox();
      expect(bounds.width).toBeLessThanOrEqual(Math.min(width * .9, 680) + 1);
      expect(bounds.height).toBeLessThanOrEqual(821);
      const document = dialog.locator('.studio-letter-dialog__document');
      expect(await cancelled(document)).toEqual({ context: true, drag: true });
      await expect(document.locator('.studio-gifts__watermark span')).toHaveCount(3);
      const close = dialog.getByRole('button', { name: 'Close preview', exact: true });
      expect(await close.evaluate(el => el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })))).toBe(true);
      await close.click();
      await expect(dialog).not.toBeVisible();
      await expect(thumbnail).toBeFocused();
    }
  });
}

test('alternate Santa picture enlargement preserves its image and name while reading', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  await visit(page, { reduced: true });
  await advanceExample(page);
  await expect(gifts(page)).toHaveAttribute('data-demo-name', 'Ayla');
  await gifts(page).getByRole('button', { name: 'Enlarge Santa’s Nice List picture' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('.studio-santa-picture > img')).toHaveAttribute('src', '/images/santa-nice-list-2.jpg');
  await expect(dialog.locator('.studio-santa-picture__name')).toHaveText('Ayla');
  await expect(dialog.locator('.studio-santa-picture > img')).toHaveJSProperty('naturalWidth', 1536);
  expect((await scriptInk(page, dialog.locator('.studio-santa-picture__name > span'))).changed).toBe(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.activeElement?.blur());
  await page.clock.runFor(20000);
  await expect(gifts(page)).toHaveAttribute('data-demo-name', 'Ayla');
  await expect(dialog.locator('.studio-santa-picture > img')).toHaveAttribute('src', '/images/santa-nice-list-2.jpg');
});

test('certificate precedes body, signature follows body, and hovering pauses the ten-second rotation', async ({ page }) => {
  await visit(page, { clock: true });
  await page.clock.runFor(800);
  expect(await gifts(page).locator('.studio-certificate__name > span').evaluate(el => getComputedStyle(el).clipPath)).not.toBe('inset(0px 0% 0px 0px)');
  expect(await body(page).innerText()).not.toContain('Dear Edward');
  await page.clock.runFor(4000);
  await expect(body(page)).toContainText('Dear Edward');
  const signature = gifts(page).locator('.studio-gifts__gallery .studio-letter__signature span');
  expect(await signature.evaluate(el => getComputedStyle(el).visibility)).toBe('hidden');
  await expect(gifts(page)).toHaveAttribute('data-demo-name', 'Edward');
  await gifts(page).hover();
  await page.clock.runFor(40000);
  await expect(gifts(page)).toHaveAttribute('data-complete', 'true');
  expect(await signature.evaluate(el => getComputedStyle(el).clipPath)).toBe('none');
  expect((await scriptInk(page, signature)).changed).toBe(0);
  expect((await scriptInk(page, gifts(page).locator('.studio-certificate__name > span'))).changed).toBe(0);
  await page.mouse.move(0, 0);
  await page.clock.runFor(9000);
  await expect(gifts(page)).toHaveAttribute('data-demo-name', 'Edward');
  await page.clock.runFor(2000);
  await expect(gifts(page)).toHaveAttribute('data-demo-name', 'Ayla');
  await expect(gifts(page)).toHaveAttribute('data-complete', 'false');
});

test('enlargement reveals the full document without manual controls, with Escape and restored focus', async ({ page }) => {
  await visit(page);
  await expect(gifts(page).getByRole('button', { name: /Next example|Show full letter now/i })).toHaveCount(0);
  const text = await readable(page).innerText();
  const open = gifts(page).getByRole('button', { name: 'Enlarge letter to read' });
  await open.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Show full letter now', exact: true })).toHaveCount(0);
  expect(await dialog.locator('.studio-letter__signature > span').evaluate(el => getComputedStyle(el).clipPath)).toBe('none');
  expect(await dialog.locator('.studio-gifts__sr').innerText()).toBe(text);
  await expect(dialog.getByRole('button', { name: 'Close preview' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(open).toBeFocused();
  await open.click();
  expect(await dialog.locator('.studio-gifts__sr').innerText()).toBe(text);
  await dialog.getByRole('button', { name: 'Close preview' }).click();
  await expect(open).toBeFocused();
  await gifts(page).getByRole('button', { name: 'Enlarge certificate' }).click();
  await expect(dialog.locator('.studio-certificate')).toBeVisible();
  await expect(dialog.locator('img')).toHaveAttribute('src', '/certificates/examples/blank-master.webp');
});

test('audio name wins, cancels the old animation, and stopping/ending keeps a coherent idle demo', async ({ page }) => {
  await visit(page, { clock: true });
  await page.clock.runFor(4000);
  const audioStart = page.getByRole('button', { name: 'Hear an example audio message', exact: true });
  await audioStart.click();
  await expect(gifts(page)).toHaveAttribute('data-demo-name', 'Harry');
  await expect(readable(page)).toContainText('Dear Harry,');
  await expect(readable(page)).not.toContainText('Edward');
  await expect(gifts(page).getByRole('button', { name: 'Next example' })).toHaveCount(0);
  await page.clock.runFor(800);
  await expect(gifts(page)).toHaveAttribute('data-complete', 'false');
  await page.getByRole('button', { name: 'Stop example message', exact: true }).click();
  await expect(gifts(page)).toHaveAttribute('data-demo-name', 'Harry');
  await expect(gifts(page).getByRole('button', { name: 'Next example' })).toHaveCount(0);
  await audioStart.click();
  await expect(gifts(page)).toHaveAttribute('data-demo-name', 'Arabella');
  await page.locator('.santa-message-example audio').dispatchEvent('ended');
  await expect(gifts(page)).toHaveAttribute('data-demo-name', 'Arabella');
  await expect(readable(page)).not.toContainText('Harry');
  await audioStart.click();
  await expect(gifts(page)).toHaveAttribute('data-demo-name', 'Ayla');
  await page.locator('.santa-message-example audio').dispatchEvent('error');
  await expect(gifts(page)).toHaveAttribute('data-demo-name', 'Ayla');
  await expect(audioStart).toBeEnabled();
});

test('reduced motion is complete and static; enlargement pauses normal rotation', async ({ page }) => {
  await visit(page, { reduced: true, clock: true });
  await expect(gifts(page)).toHaveAttribute('data-complete', 'true');
  await page.clock.runFor(180000);
  await expect(gifts(page)).toHaveAttribute('data-demo-name', 'Edward');
  await expect(body(page)).toContainText('The North Pole');
  await expect(gifts(page).getByRole('button', { name: 'Next example' })).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await gifts(page).getByRole('button', { name: 'Enlarge letter to read' }).click();
  await page.evaluate(() => document.activeElement.blur());
  await page.mouse.move(0, 0);
  await page.clock.runFor(180000);
  await expect(gifts(page)).toHaveAttribute('data-demo-name', 'Edward');
});

for (const [width, scale] of [[1440, 1], [320, 1], [390, 2]]) {
  test(`complete A4 letter and usable controls at ${width}px and ${scale * 100}% text`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await visit(page, { reduced: true });
    if (scale > 1) await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await gifts(page).getByRole('button', { name: 'Enlarge letter to read' }).click();
    const dialog = page.getByRole('dialog');
    const metrics = await dialog.evaluate(el => {
      const paper = el.querySelector('.studio-letter__paper');
      const text = el.querySelector('.studio-letter__text');
      const font = parseFloat(getComputedStyle(text).fontSize);
      const bounds = paper.getBoundingClientRect();
      const textBounds = text.getBoundingClientRect();
      return { font, overflow: el.scrollWidth - el.clientWidth,
        headerGap: text.getBoundingClientRect().top - paper.getBoundingClientRect().top,
        paperWidth: bounds.width, ratio: bounds.width / bounds.height,
        textBottom: (textBounds.bottom - bounds.top) / bounds.height,
        allTextFits: [...text.querySelectorAll('p, .studio-letter__signature')].every(node => {
          const range = document.createRange();
          range.selectNodeContents(node);
          return [...range.getClientRects()].every(rect => rect.left >= bounds.left - 1 &&
            rect.right <= bounds.right + 1 && rect.bottom <= bounds.bottom + 1);
        }),
        background: getComputedStyle(paper).backgroundImage,
        fontFamily: getComputedStyle(text).fontFamily, topLayer: el.matches(':modal') };
    });
    // Fixed document typography scales with the paper, not the surrounding UI.
    expect(metrics.font / metrics.paperWidth * 794).toBeGreaterThanOrEqual(14.5);
    expect(metrics.ratio).toBeCloseTo(210 / 297, 2);
    expect(metrics.overflow).toBeLessThanOrEqual(1);
    expect(metrics.headerGap / metrics.paperWidth).toBeCloseTo(.24 * 297 / 210, 2);
    expect(metrics.textBottom).toBeLessThan(.88);
    expect(metrics.allTextFits).toBe(true);
    expect(metrics.background).toContain('santa-radio-letterhead.webp');
    expect(metrics.fontFamily).toContain('Georgia');
    expect(metrics.topLayer).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await dialog.evaluate(el => { el.scrollTop = el.scrollHeight; });
    await expect(dialog.locator('.studio-letter__text')).toContainText('The elves do love making things official!');
    for (const button of await dialog.getByRole('button').all()) {
      expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({ path: `test-results/studio-letter-${width}-${scale}.png` });
    await dialog.evaluate(el => { el.scrollTop = 0; });
    await page.screenshot({ path: `test-results/studio-letter-top-${width}-${scale}.png` });
    await dialog.getByRole('button', { name: 'Close preview' }).click();
    if (width < 768) {
      const formBounds = await page.locator('.santa-studio-promotion form').boundingBox();
      const giftBounds = await gifts(page).boundingBox();
      expect(giftBounds.y).toBeGreaterThanOrEqual(formBounds.y + formBounds.height);
    }
    await page.locator('.santa-studio-promotion').screenshot({
      path: `test-results/studio-panel-${width}-${scale}.png`, animations: 'disabled',
    });
  });
}

for (const [width, height] of [[1440, 850], [621, 768], [390, 844], [320, 568], [844, 390]]) {
  test(`enlarged letter shows the whole page without panning at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await visit(page, { reduced: true });
    const opener = gifts(page).getByRole('button', { name: 'Enlarge letter to read' });
    await opener.click();
    const dialog = page.getByRole('dialog');
    const checkFullPage = async () => {
      const geometry = await dialog.evaluate(el => {
        const rect = node => node.getBoundingClientRect().toJSON();
        const content = el.querySelector('.studio-letter-dialog__content');
        return { paper: rect(el.querySelector('.studio-letter__paper')), content: rect(content),
          toolbar: rect(el.querySelector('.studio-letter-dialog__toolbar')), dialog: rect(el),
          overflowX: content.scrollWidth - content.clientWidth,
          overflowY: content.scrollHeight - content.clientHeight,
          dialogOverflow: el.scrollHeight - el.clientHeight,
          viewportWidth: innerWidth, viewportHeight: innerHeight };
      });
      expect(geometry.paper.width / geometry.paper.height).toBeCloseTo(210 / 297, 3);
      expect(geometry.paper.top).toBeGreaterThanOrEqual(geometry.toolbar.bottom);
      expect(geometry.paper.bottom).toBeLessThanOrEqual(geometry.content.bottom + .5);
      expect(geometry.paper.left).toBeGreaterThanOrEqual(geometry.content.left - .5);
      expect(geometry.paper.right).toBeLessThanOrEqual(geometry.content.right + .5);
      expect(geometry.dialog.top).toBeGreaterThanOrEqual(0);
      expect(geometry.dialog.bottom).toBeLessThanOrEqual(geometry.viewportHeight);
      expect(geometry.dialog.right).toBeLessThanOrEqual(geometry.viewportWidth);
      expect(geometry.overflowX).toBeLessThanOrEqual(1);
      expect(geometry.overflowY).toBeLessThanOrEqual(1);
      expect(geometry.dialogOverflow).toBeLessThanOrEqual(1);
      await expect(dialog.locator('.studio-gifts__watermark span')).toHaveCount(3);
      await expect(dialog.getByRole('button', { name: 'Close preview' })).toBeInViewport();
    };
    await checkFullPage();
    await dialog.screenshot({ path: `test-results/whole-letter-${width}x${height}.png` });
    // An open preview must refit when the phone rotates or its browser resizes.
    await page.setViewportSize({ width: height, height: width });
    await checkFullPage();
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await checkFullPage();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(opener).toBeFocused();
  });
}
