import { test, expect } from '@playwright/test';
import { studioEditorialContext } from '../server/studio-letter-editorial.js';
import { createStudioLetterVariation, createStudioLetter } from '../src/lib/santaStudioLetter.js';
import { workshopTreatWording } from '../src/lib/workshopTreatWording.js';

const cases = [
  ['3 months old', 'Learning to talk', 'Being brave', 'Beautiful note', 'England'],
  ['2 years old', 'Art', 'Starting nursery', 'Smelly socks', 'Wonderland'],
  ['10 years old', 'Playing your musical instrument', 'Completing a jigsaw puzzle', 'Your rubbish', 'The Moon'],
  ['18 years old', 'Coding', 'Doing well in your exams', 'Glass whisky', 'Japan'],
  ['50 years old', 'Personal hygiene', 'Being brave', 'Map', 'Falkland Islands'],
  ['17 years old', 'Building lego', 'Learning to swim', 'Packet of reindeer food', 'The Enchanted Forest'],
];
const fields = ['age', 'activity', 'achievement', 'treats', 'destination'];
const categories = ['age', 'activity', 'achievement', 'treat', 'place'];
function detailFixture(values) {
  const details = Object.fromEntries(fields.map((key, index) =>
    [key, key === 'treats' ? workshopTreatWording(values[index]) : values[index]]));
  details.context = Object.fromEntries(fields.slice(1).map((field, offset) =>
    [field, studioEditorialContext(categories[offset + 1], { label: values[offset + 1] })]));
  return details;
}

async function render(page, { name, details, variant = .67 }) {
  await page.evaluate(async props => {
    if (!window.contextualLetterRoot) {
      const [{ default: React }, { default: ReactDOM }, { StudioKeepsakePreview }] = await Promise.all([
        import('/node_modules/.vite/deps/react.js'),
        import('/node_modules/.vite/deps/react-dom_client.js'),
        import('/src/components/SantaStudioGifts.jsx'),
      ]);
      const host = document.createElement('main');
      host.style.cssText = 'width:min(460px,calc(100vw - 24px));margin:24px auto';
      document.body.replaceChildren(host);
      const root = ReactDOM.createRoot(host);
      window.contextualLetterRoot = props => root.render(React.createElement(StudioKeepsakePreview, props));
    }
    window.contextualLetterRoot(props);
  }, { name, details, variation: createStudioLetterVariation(() => variant) });
  await expect(page.locator('.studio-gifts')).toHaveAttribute('data-demo-name', name);
}

async function letterGeometry(page) {
  const geometry = await page.locator('dialog[open]').evaluate(dialog => {
    const paper = dialog.querySelector('.studio-letter__paper').getBoundingClientRect();
    const text = dialog.querySelector('.studio-letter__text').getBoundingClientRect();
    const content = dialog.querySelector('.studio-letter-dialog__content');
    const paragraphs = [...dialog.querySelectorAll('.studio-letter__text p')].map(p => {
      const r = document.createRange(); r.selectNodeContents(p);
      return r.getBoundingClientRect().toJSON();
    });
    return { paper: paper.toJSON(), text: text.toJSON(), paragraphs,
      scroll: content.scrollHeight - content.clientHeight,
      font: parseFloat(getComputedStyle(dialog.querySelector('.studio-letter__text')).fontSize),
      signature: dialog.querySelector('.studio-letter__signature').getBoundingClientRect().toJSON(),
      width: innerWidth, height: innerHeight };
  });
  expect(geometry.paper.width / geometry.paper.height).toBeCloseTo(210 / 297, 3);
  expect(geometry.text.top).toBeGreaterThanOrEqual(geometry.paper.top + geometry.paper.height * .239);
  expect(geometry.text.bottom).toBeLessThan(geometry.paper.top + geometry.paper.height * .88);
  expect(geometry.paper.bottom).toBeLessThanOrEqual(geometry.height + .5);
  expect(geometry.paper.left).toBeGreaterThanOrEqual(0);
  expect(geometry.paper.right).toBeLessThanOrEqual(geometry.width + .5);
  expect(geometry.scroll).toBeLessThanOrEqual(1);
  expect(geometry.font / geometry.paper.width).toBeCloseTo(.0195, 4); // unchanged readable A4 type scale
  expect(geometry.signature.bottom).toBeLessThan(geometry.paragraphs.at(-2).top);
  for (const paragraph of geometry.paragraphs) {
    expect(paragraph.left).toBeGreaterThanOrEqual(geometry.text.left - .5);
    expect(paragraph.right).toBeLessThanOrEqual(geometry.text.right + .5);
  }
}

for (const width of [390, 1440]) {
  test(`contextual letter variants fit A4 and stay fixed through spelling, reveal and enlargement at ${width}px`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/free-santa-message');
    // Render the production component directly, not a public test route or auth bypass.
    for (const [index, values] of cases.entries()) {
      const details = detailFixture(values);
      for (const variant of [0, .5, .999]) {
        await render(page, { name: 'Alexandria Rose Montgomery', details, variant });
        const compact = page.locator('.studio-gifts__gallery .studio-letter__text');
        const before = await compact.innerText();
        for (const value of fields.map(key => details[key])) expect(before).toContain(value);
        await page.getByRole('button', { name: 'Enlarge letter to read', exact: true }).click();
        await expect(page.locator('dialog[open] .studio-letter__text')).toHaveText(await compact.textContent());
        await page.evaluate(() => document.fonts.ready);
        await letterGeometry(page);
        await page.keyboard.press('Escape');
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await render(page, { name: 'Alexandria Rose Montgomery', details: { ...details }, variant });
        expect(await compact.innerText()).toBe(before);
        await render(page, { name: 'Alexandra Rose Montgomery', details, variant });
        expect(await compact.innerText()).toBe(before.replaceAll('Alexandria', 'Alexandra'));
        await page.getByRole('button', { name: 'Enlarge letter to read', exact: true }).click();
        await expect(page.locator('dialog[open] .studio-letter__text')).toContainText('Dear Alexandra Rose Montgomery,');
        if (index === 2 && variant === .5) await page.screenshot({ path: `generated-artifacts/studio-editorial/contextual-${width}.jpg` });
        await page.keyboard.press('Escape');
      }
    }
    // Longest authored response in each slot, plus realistic long selections.
    const { responseLibraries } = await import('../src/lib/studioLetterResponses.js');
    const details = detailFixture(['18 years old', 'Playing your musical instrument', 'Being patient with your siblings', 'Cup of mulled wine', 'Trinidad and Tobago']);
    const variation = createStudioLetterVariation(() => 0);
    for (const [field, library] of Object.entries(responseLibraries)) {
      const group = field === 'age' ? 'eighteen' : details.context[field].group;
      const variants = library[group];
      const longest = variants.reduce((best, response, index) => response.length > variants[best].length ? index : best, 0);
      variation[field] = (longest + .1) / variants.length;
    }
    const expected = createStudioLetter('Élodie-Joséphine O’Neill', () => 0, details, variation);
    await page.evaluate(({ details, variation }) =>
      window.contextualLetterRoot({ name: 'Élodie-Joséphine O’Neill', details, variation }), { details, variation });
    await expect(page.locator('.studio-gifts__gallery .studio-letter__text > p').first()).toHaveText(expected.paragraphs[0]);
    await page.getByRole('button', { name: 'Enlarge letter to read', exact: true }).click();
    await letterGeometry(page);
    await page.setViewportSize({ width: width === 390 ? 844 : 320, height: 700 });
    await letterGeometry(page);
  });
}
