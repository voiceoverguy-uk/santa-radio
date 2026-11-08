import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const sections = [
  ['studio', '.homepage-santa-studio', 'A unique Christmas treat.', 'MESSAGE FROM SANTA', 'Ask Santa for a bespoke message to your little one.', '.homepage-santa-studio__layout'],
  ['tracker', '.tracker-banner', 'THE ENTIRE JOURNEY', 'THE SANTA TRACKER', 'Follow Santa not just at Christmas, but the whole year!', '.tracker-banner'],
  ['naughty-nice', '.nn-widget', 'Naughty or Nice?', 'WHICH LIST ARE YOU ON?', 'Let Head Elf find out which list he thinks you really should be on.', '.nn-quiz-intro-inner'],
  ['youtube', '.youtube-section', 'A window to the North Pole', 'Best of the North Pole Webcams', 'Highlights of the webcams at the North Pole. Keep checking back!', '.youtube-section > .container'],
  ['mugshots', '#homepage-mugshots', 'THE SANTA RADIO HALL OF FAME', 'Celebrity Mugshots', null, '.mugshots-preview-inner'],
  ['contact', '.contact-section', 'THE NORTH POLE POST ROOM', 'We’d love to hear from you', 'Got a question, a festive idea or something to share? Get in touch with the Santa Radio team.', '.contact-copy'],
  ['dash', '.santa-dash-promo', 'A festive rooftop adventure', 'SANTA DASH BACK TO THE GROTTO', 'Race across snowy rooftops with Santa collecting Golden Mince Pies!', '.santa-dash-promo__inner'],
];

async function typography(locator) {
  return locator.evaluate(element => {
    const style = getComputedStyle(element);
    return Object.fromEntries([
      'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
      'color', 'textTransform', 'textShadow', 'marginTop', 'marginBottom',
    ].map(property => [property, style[property]]));
  });
}

for (const [width, enlarged] of [[1440, false], [768, false], [390, false], [320, false], [390, true], [320, true]]) {
  test(`Pairs heading consistency at ${width}px${enlarged ? ' with 200% text' : ''}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1100 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => {
      sessionStorage.setItem('santa-message-offer-shown', 'shown');
      localStorage.setItem('santaradio-cookie-consent-v2', JSON.stringify({
        version: 2, analytics: false, marketing: false, media: false, savedAt: Date.now(),
      }));
    });
    await page.route('**/api/radio-metadata*', route => route.fulfill({
      json: { available: false, current: null, upcoming: [] },
    }));
    await page.goto('/');
    await page.addStyleTag({ content: `html { scroll-behavior: auto !important; ${enlarged ? 'font-size: 200% !important;' : ''} }` });
    await page.evaluate(() => document.fonts.ready);
    const pairs = page.locator('.christmas-pairs__heading');
    const reference = {
      eyebrow: await typography(pairs.locator('.christmas-pairs__eyebrow')),
      title: await typography(pairs.locator('h2')),
      subtitle: await typography(pairs.locator('.christmas-pairs__intro')),
    };
    const soundboard = page.locator('.soundboard-intro');
    expect({
      eyebrow: await typography(soundboard.locator('.soundboard-eyebrow')),
      title: await typography(soundboard.locator('.soundboard-title')),
      subtitle: await typography(soundboard.locator('.soundboard-subtitle')),
    }).toEqual(reference);
    mkdirSync('generated-artifacts/homepage-headings', { recursive: true });
    const suffix = `${width}${enlarged ? '-enlarged' : ''}`;
    const capture = async (locator, name) => {
      await locator.screenshot({
        path: `generated-artifacts/homepage-headings/${name}-${suffix}.jpg`,
        animations: 'disabled',
        style: '.navbar, .radio-dock { visibility: hidden !important; }',
      });
    };
    await capture(pairs, 'pairs-reference');
    for (const [name, selector, eyebrow, title, subtitle, contentSelector] of sections) {
      const section = page.locator(selector);
      const stack = section.locator('.homepage-section-heading');
      const small = stack.locator('.homepage-section-heading__eyebrow');
      const heading = stack.getByRole('heading', { level: 2, name: title, exact: true });
      const intro = stack.locator('.homepage-section-heading__subtitle');
      const divider = stack.locator('.homepage-section-heading__divider');
      await expect(stack).toHaveCount(1);
      await expect(small).toHaveText(eyebrow);
      if (subtitle === null) await expect(intro).toHaveCount(0);
      else await expect(intro).toHaveText(subtitle);
      if (name === 'studio')
        await expect(stack.locator('.homepage-section-heading__supporting')).toHaveText('OUR PREMIUM EXPERIENCE');
      if (name === 'youtube') {
        await expect(section.getByRole('button', { name: /^(Pause video|Resume muted video)$/ })).toHaveCount(0);
        await expect(section.locator('.video-preview, .video-motion-toggle')).toHaveCount(0);
        // The video follows the heading directly, with only its approved margin.
        const stackBox = await stack.boundingBox();
        const frameBox = await section.locator('.tv-frame').boundingBox();
        const margin = await stack.evaluate(element => parseFloat(getComputedStyle(element).marginBottom));
        expect(frameBox.y - stackBox.y - stackBox.height).toBeCloseTo(margin, 0);
      }
      await expect(heading).toBeVisible();
      await expect(divider).toHaveCount(1);
      await expect(divider).toHaveAttribute('aria-hidden', 'true');
      expect(await typography(small), `${name} eyebrow`).toEqual(reference.eyebrow);
      const headline = await typography(heading);
      expect(headline, `${name} headline`).toEqual(reference.title);
      if (subtitle !== null)
        expect(await typography(intro), `${name} subheading`).toEqual(reference.subtitle);
      const dividerBox = await divider.boundingBox();
      expect(dividerBox.width).toBeGreaterThanOrEqual(140);
      expect(dividerBox.height).toBe(24);
      const dividerLines = divider.locator('.homepage-section-heading__divider-line');
      await expect(dividerLines).toHaveCount(2);
      const lineBounds = await dividerLines.evaluateAll(lines => lines.map(line => {
        const box = line.getBoundingClientRect();
        return { x: box.x, right: box.right, width: box.width, height: box.height,
          backgroundImage: getComputedStyle(line).backgroundImage,
          backgroundColor: getComputedStyle(line).backgroundColor,
          opacity: getComputedStyle(line).opacity };
      }));
      const starBounds = await divider.locator('svg').evaluate(element => {
        const box = element.getBoundingClientRect();
        return { x: box.x, right: box.right };
      });
      expect(lineBounds[0].width).toBeGreaterThanOrEqual(42);
      expect(lineBounds[1].width).toBeGreaterThanOrEqual(42);
      expect(lineBounds[0].height).toBe(1);
      expect(lineBounds[1].height).toBe(1);
      expect(lineBounds[0].right).toBeLessThan(starBounds.x);
      expect(lineBounds[1].x).toBeGreaterThan(starBounds.right);
      if (name === 'tracker') {
        expect(lineBounds.every(line => line.backgroundColor === 'rgb(214, 181, 91)' && line.opacity === '1')).toBe(true);
      } else {
        expect(lineBounds.every(line => line.backgroundImage.includes('linear-gradient'))).toBe(true);
      }
      expect(await small.evaluate(element => ['::before', '::after'].every(pseudo =>
        ['none', 'normal'].includes(getComputedStyle(element, pseudo).content)))).toBe(true);
      const headingItems = [small, divider, heading, ...(subtitle !== null ? [intro] : [])];
      const positions = await Promise.all(headingItems.map(item => item.boundingBox()));
      for (let index = 1; index < positions.length; index++) {
        expect(positions[index].y).toBeGreaterThanOrEqual(positions[index - 1].y + positions[index - 1].height - 1);
      }
      const supporting = stack.locator('.homepage-section-heading__supporting');
      const compactGaps = [
        [small, divider, 8],
        [divider, heading, 1],
        ...(await supporting.count()
          ? [[heading, supporting, 9], ...(subtitle !== null ? [[supporting, intro, 8]] : [])]
          : (subtitle !== null ? [[heading, intro, 8]] : [])),
      ];
      for (const [before, after, maximum] of compactGaps) {
        const beforeBox = await before.boundingBox();
        const afterBox = await after.boundingBox();
        expect(afterBox.y - beforeBox.y - beforeBox.height, `${name} internal heading gap`).toBeLessThanOrEqual(maximum);
      }
      // Scope the centre to the section's content, especially the Post Room's
      // right panel, rather than incorrectly requiring the page's midpoint.
      const content = await page.locator(contentSelector).boundingBox();
      for (const item of [stack, heading, divider]) {
        const box = await item.boundingBox();
        expect(Math.abs(box.x + box.width / 2 - content.x - content.width / 2)).toBeLessThanOrEqual(1);
      }
      for (const item of [small, heading, ...(subtitle !== null ? [intro] : [])]) {
        const itemClass = await item.getAttribute('class');
        const inkOverflow = name === 'mugshots' ? 6 : 1;
        expect(await item.evaluate((element, maxInkOverflow) => {
          const box = element.getBoundingClientRect();
          // Cinzel's font-metric range extends beyond its 1.2 line box (as
          // it does in Pairs). Check visible ink against the whole stack,
          // not a line box that deliberately permits visible overflow.
          const stack = element.closest('.homepage-section-heading').getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(element);
          return getComputedStyle(element).textAlign === 'center' &&
            getComputedStyle(element).overflowY === 'visible' &&
            [...range.getClientRects()].every(line =>
              line.left >= box.left - 1 && line.right <= box.right + 1 &&
              line.top >= stack.top - 1 &&
              line.bottom <= stack.bottom + maxInkOverflow) &&
            box.left >= 0 && box.right <= innerWidth + 1;
        }, inkOverflow), `${name} ${itemClass} text stays in bounds`).toBe(true);
      }
      await capture(stack, name);
    }
    const dashTitle = page.locator('.santa-dash-promo .homepage-section-heading__title');
    await expect(dashTitle.locator('br')).toHaveCount(1);
    await expect(dashTitle.locator('span')).toHaveText(['SANTA DASH', 'BACK TO THE GROTTO']);
    if (width === 1440 || (width === 390 && !enlarged)) {
      const titleLines = await dashTitle.locator('span').evaluateAll(lines => lines.map(line => {
        const range = document.createRange();
        range.selectNodeContents(line);
        const rects = [...range.getClientRects()];
        return { top: rects[0]?.top, count: rects.length, left: rects[0]?.left, right: rects[0]?.right };
      }));
      expect(titleLines).toHaveLength(2);
      expect(titleLines.every(line => line.count === 1 && line.left >= 0 && line.right <= width)).toBe(true);
      expect(titleLines[1].top).toBeGreaterThan(titleLines[0].top);
    }
    const mugshots = page.locator('#homepage-mugshots');
    await expect(mugshots.locator('.mugshots-description')).toHaveText('Our autograph-hunting elf has been busy with our Santa Radio mug. No A.I.');
    await expect(mugshots.locator('.mugshots-grid .mug-card').first()).toBeVisible();
    await expect(mugshots.locator('.mugshots-grid .mug-photo').first()).toBeVisible();
    await expect(mugshots.getByRole('link', { name: 'Explore the Celebrity Mugshots' })).toHaveAttribute('href', '/mugshots/all');
    await expect(page.locator('.contact-panel .homepage-section-heading')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
