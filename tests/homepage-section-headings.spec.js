import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const sections = [
  ['youtube', '.youtube-section', 'A window to the North Pole', 'Best of the North Pole Webcams', 'Highlights of the webcams at the North Pole. Keep checking back!', '.youtube-section > .container'],
  ['mugshots', '#homepage-mugshots', 'THE SANTA RADIO HALL OF FAME', 'Celebrity Mugshots', 'Famous faces. One festive mug.', '.mugshots-preview-inner'],
  ['contact', '.contact-section', 'THE NORTH POLE POST ROOM', 'We’d love to hear from you', 'Got a question, a festive idea or something to share? Get in touch with the Santa Radio team.', '.contact-copy'],
  ['dash', '.santa-dash-promo', 'A festive rooftop adventure', 'Santa Dash Back to the Grotto', 'Race across snowy rooftops with Santa collecting Golden Mince Pies!', '.santa-dash-promo__inner'],
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

async function dividerStyle(locator) {
  return locator.evaluate(element => {
    const style = getComputedStyle(element);
    const rule = pseudo => {
      const computed = getComputedStyle(element, pseudo);
      return Object.fromEntries(['width', 'height', 'backgroundImage', 'top', 'transform']
        .map(property => [property, computed[property]]));
    };
    return {
      width: style.width, height: style.height, color: style.color,
      before: rule('::before'), after: rule('::after'),
      star: element.querySelector('svg').outerHTML,
    };
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
      divider: await dividerStyle(pairs.locator('.christmas-pairs__title-star')),
    };
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
      await expect(intro).toHaveText(subtitle);
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
       if (name === 'dash') {
         // This deliberate two-line title scales down to keep its phrase intact.
         expect(parseFloat(headline.fontSize)).toBeLessThanOrEqual(parseFloat(reference.title.fontSize));
         expect(parseFloat(headline.lineHeight)).toBeCloseTo(parseFloat(headline.fontSize) * 1.2, 1);
         expect(parseFloat(headline.letterSpacing) / parseFloat(headline.fontSize)).toBeCloseTo(.025, 3);
         headline.fontSize = reference.title.fontSize;
         headline.lineHeight = reference.title.lineHeight;
         headline.letterSpacing = reference.title.letterSpacing;
       }
       expect(headline, `${name} headline`).toEqual(reference.title);
      expect(await typography(intro), `${name} subheading`).toEqual(reference.subtitle);
      expect(await dividerStyle(divider), `${name} divider`).toEqual(reference.divider);
      expect(await small.evaluate(element => ['::before', '::after'].every(pseudo =>
        ['none', 'normal'].includes(getComputedStyle(element, pseudo).content)))).toBe(true);
      const positions = await Promise.all([small, divider, heading, intro].map(item => item.boundingBox()));
      for (let index = 1; index < positions.length; index++) {
        expect(positions[index].y).toBeGreaterThanOrEqual(positions[index - 1].y + positions[index - 1].height - 1);
      }
      // Scope the centre to the section's content, especially the Post Room's
      // right panel, rather than incorrectly requiring the page's midpoint.
      const content = await page.locator(contentSelector).boundingBox();
      for (const item of [stack, heading, divider]) {
        const box = await item.boundingBox();
        expect(Math.abs(box.x + box.width / 2 - content.x - content.width / 2)).toBeLessThanOrEqual(1);
      }
      for (const item of [small, heading, intro]) {
        expect(await item.evaluate(element => {
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
              line.top >= stack.top - 1 && line.bottom <= stack.bottom + 1) &&
            box.left >= 0 && box.right <= innerWidth + 1;
        }), `${name} text stays in bounds`).toBe(true);
      }
      await capture(stack, name);
    }
    await expect(page.locator('.mugshots-description')).toHaveText('Our autograph-hunting elf has been busy with our Santa Radio mug. No A.I.');
    await expect(page.locator('.contact-panel .homepage-section-heading')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
