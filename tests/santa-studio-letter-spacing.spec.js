import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { PDFDocument } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { studioLetterLayout as type, LETTER_WIDTH as W, LETTER_HEIGHT as H } from '../src/lib/studioLetterLayout.js';
import { layoutStudioLetter, wrapLetterText } from '../src/lib/studioGiftExports.js';
import { createStudioLetter } from '../src/lib/santaStudioLetter.js';
import { studioEditorialContext } from '../server/studio-letter-editorial.js';
import { workshopCatalogue } from '../server/santa-workshop-catalogue.js';
import { measureLetterSpacing } from './helpers/studio-letter-spacing.js';
import { spacingCandidates } from './helpers/studio-letter-spacing-candidates.js';
import { expectLeftAlignedLetter } from './helpers/studio-letter-alignment.js';

const output = 'generated-artifacts/studio-spacing';
const edwardSelections = createStudioLetter('Edward', () => 0, {
  age: '4 years old', activity: 'bike riding', achievement: 'completing a jigsaw puzzle',
  destination: 'Scotland', treats: 'a beautiful note',
  context: { destination: studioEditorialContext('place', { label: 'Scotland' }) },
}, { workshop: 5.1 / 20, departure: 17.1 / 20, atmosphere: 4.1 / 20,
  activityIntro: .625, achievementIntro: .8, destinationIntro: .99, treatsIntro: .4,
  reminder: .1, age: .99, signoff: .4, postscript: .1, joke: 9.1 / 25 });
// The exact letter in the owner's later screenshot, including all selected
// details and complete story, joke, sign-off, signature and postscript.
const edward = {
  ...edwardSelections,
  paragraphs: [
    'Dear Edward,',
    'The paint room has a shelf for things that are drying. Today a striped spinning top sat there beside an elf’s accidentally spotted apron. Both were admired, though only one was supposed to have a pattern.',
    'You are 4 years old. The world is full of new things to try. Take your time: even my elves needed help with their first ribbon!',
    'I smiled to see “bike riding” in my notes. Balance and control come a little at a time. There is no hurry to master the next move.',
    'A little bell on the sleigh rail needed its clasp tightened. The elf fixing it worked so gently that it hardly rang at all. Afterwards she gave it one bright shake, simply to hear that everything was right.',
    'Here is a Christmas cheer for “completing a jigsaw puzzle”. Following clues and fitting pieces together takes patience. What a satisfying thing to celebrate! I hope you enjoyed that moment when the pieces made sense.',
    'The chosen destination is Scotland. Our fictional Scotland practice used an Edinburgh Castle postcard. I nearly filed it among the workshop building plans.',
    'My offering note reads “a beautiful note”. Words rather than crumbs: how lovely. I have a special place for letters, where the elves cannot mistake them for wrapping paper.',
    'The North Pole kitchen windows were misty when I passed them. Inside, somebody was stirring a pan and somebody else was telling a story. I could not hear the words, but the laughter reached me quite clearly through the door.',
    'Now, Edward, remember this: you do not have to get everything right to matter. Keep room for kindness, curiosity and the things you enjoy.',
    'By the way, Edward, do you like jokes? What do you call a snowman’s party? A snowball!',
    'With a very merry Christmas hello,',
  ],
};

async function fixture(page, letter, animated = false) {
  await page.evaluate(async ({ letter, animated }) => {
    const [{ default: React }, { default: ReactDOM }, { StudioGiftPreview }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'), import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/components/SantaStudioGifts.jsx'),
    ]);
    if (!window.spacingRoot) {
      const host = document.createElement('main');
      host.style.cssText = 'width:min(460px,calc(100vw - 24px));margin:auto';
      document.body.replaceChildren(host);
      window.spacingRoot = ReactDOM.createRoot(host);
    }
    window.spacingRoot.render(React.createElement(StudioGiftPreview, { example: {
      name: letter.name, suppliedLetter: letter, staticPreview: true,
      picture: '/images/santa-nice-list.jpg', reducedMotion: !animated, downloadReady: true,
    } }));
  }, { letter, animated });
  await expect(page.locator('.studio-gifts__preview-stack [data-letter-ready]')).toBeVisible();
  return page.locator('.studio-gifts__preview-stack .studio-letter__paper');
}

function expectFrame(metrics) {
  expect(metrics.pitch.length).toBeGreaterThan(3);
  const leading = metrics.pitch[0] / (W * type.body);
  expect(leading).toBeGreaterThanOrEqual(type.leading - .002);
  expect(leading).toBeLessThanOrEqual(type.maxLeading + .002);
  for (const pitch of metrics.pitch) expect(pitch).toBeCloseTo(metrics.pitch[0], 1);
  for (const p of metrics.paragraphs) {
    expect(p.font).toBeCloseTo(W * .0225, 2);
    expect(p.gap / p.font).toBeGreaterThanOrEqual(type.paragraphGap - .002);
    expect(p.gap / p.font).toBeLessThanOrEqual(type.maxParagraphGap + .002);
  }
  expect(metrics.end).toBeLessThan(.853);
  expect(metrics.signatureEnd).toBeLessThan(metrics.end);
}

async function selected(page, letter) {
  return page.evaluate(async letter => {
    const { prepareStudioLetter } = await import('/src/lib/prepareStudioLetter.js');
    return prepareStudioLetter(letter);
  }, letter);
}

async function pdfEvidence(page, raw, filename) {
  const letter = await selected(page, raw);
  const bytes = await page.evaluate(async letter => {
    const { exportStudioLetter } = await import('/src/lib/studioGiftExports.js');
    return [...new Uint8Array(await (await exportStudioLetter(letter)).arrayBuffer())];
  }, letter);
  const file = `${output}/${filename}.pdf`;
  await writeFile(file, new Uint8Array(bytes));
  const pdf = await PDFDocument.load(new Uint8Array(bytes));
  expect(pdf.getPageCount()).toBe(1);
  expect(pdf.getPage(0).getSize()).toEqual({ width: W, height: H });
  const extracted = execFileSync('pdftotext', [file, '-'], { encoding: 'utf8' }).replace(/\s+/gu, ' ');
  for (const p of [...letter.paragraphs, 'Santa Claus', ...letter.closing]) {
    expect(extracted).toContain(p.replace(/\s+/gu, ' '));
  }
  const boxes = execFileSync('pdftotext', ['-bbox-layout', file, '-'], { encoding: 'utf8' });
  const lines = [...boxes.matchAll(/<line xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)"[^>]*>([\s\S]*?)<\/line>/gu)];
  expect(Math.min(...lines.map(line => Number(line[2])))).toBeGreaterThan(H * .24 - .5);
  expect(Math.max(...lines.map(line => Number(line[4])))).toBeLessThan(H * .85);
  expect(Math.min(...lines.map(line => Number(line[1])))).toBeGreaterThan(W * .04);
  expect(Math.max(...lines.map(line => Number(line[3])))).toBeLessThan(W * .96);
  const lineText = line => line[5].replace(/<[^>]*>/gu, ' ').replace(/\s+/gu, ' ').trim();
  const signatureLine = lines.find(line => lineText(line) === 'Santa Claus');
  const closingLine = lines.find(line => lineText(line) === 'The North Pole');
  expect(Number(closingLine?.[2]) - Number(signatureLine?.[4])).toBeGreaterThan(3);
  execFileSync('pdftoppm', ['-scale-to', '1200', '-png', '-singlefile', file, `${output}/${filename}-rendered`]);
  return letter;
}

test('Edward uses the writing frame with stable wording, type and a same-size before/after PDF comparison', async ({ page }) => {
  await mkdir(output, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  // Homepage is the real promotional example component.
  const homepage = page.locator('.studio-gifts__preview-stack [data-letter-ready]').first();
  await expect(homepage).toBeAttached();
  expectFrame(await measureLetterSpacing(homepage));
  await fixture(page, edward);
  await expect(page.locator('.studio-letter__text > p')).toHaveText(edward.paragraphs);
  const chosen = await selected(page, edward);
  expect(chosen.compact).toBe(false);
  await page.getByRole('button', { name: 'Enlarge letter to read', exact: true }).click();
  const paper = page.locator('dialog[open] .studio-letter__paper');
  await expectLeftAlignedLetter(paper);
  const after = await measureLetterSpacing(paper);
  expectFrame(after);
  expect(after.end).toBeGreaterThan(.83);
  const wording = await paper.locator('.studio-letter__text').textContent();
  await expect(paper.locator('.studio-gifts__sr p')).toHaveText([
    ...edward.paragraphs, 'Santa Claus', ...edward.closing,
  ]);
  await paper.screenshot({ path: `${output}/edward-after.png` });
  const beforeStyle = await page.addStyleTag({ content: `
    .studio-letter__text { line-height:1.17 !important }
    .studio-letter__text p { margin-bottom:.1em !important }
  ` });
  const before = await measureLetterSpacing(paper);
  await paper.screenshot({ path: `${output}/edward-before.png` });
  await beforeStyle.evaluate(node => node.remove());
  expect(after.sheet).toEqual(before.sheet);
  expect(after.end - before.end).toBeGreaterThan(.01);
  expect(after.inkEnd - before.inkEnd).toBeGreaterThan(.012);
  expect(after.inkEnd).toBeLessThan(.85);
  expect(after.paragraphs.map(p => p.font)).toEqual(before.paragraphs.map(p => p.font));
  expect(await paper.locator('.studio-letter__text').textContent()).toBe(wording);
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    const resized = await measureLetterSpacing(paper);
    expectFrame(resized);
    expect(resized.end).toBeCloseTo(after.end, 3);
    expect(await paper.locator('.studio-letter__text').textContent()).toBe(wording);
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    expectFrame(await measureLetterSpacing(paper));
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    await page.locator('dialog[open]').screenshot({ path: `${output}/edward-enlarged-${viewport.width}.png` });
  }
  await pdfEvidence(page, edward, 'edward');
  await writeFile(`${output}/edward-measurements.json`, JSON.stringify({ before, after }, null, 2));
});

test('independent browser and embedded-font maxima fit all age bands, regional labels and 80-character names', async ({ page }) => {
  test.setTimeout(240000);
  await mkdir(output, { recursive: true });
  const catalogue = await workshopCatalogue();
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const embedded = await pdf.embedFont(readFileSync('public/certificates/nice-list/CertificateSerif.ttf'),
    { features: { calt: false, liga: false, clig: false } });
  const cache = new Map();
  const font = { widthOfTextAtSize(text, size) {
    if (!cache.has(text)) cache.set(text, embedded.widthOfTextAtSize(text, 1));
    return cache.get(text) * size;
  } };
  await page.goto('/free-santa-message');
  await fixture(page, edward);
  const report = [];
  const name = 'Alexandria-Catherine Elizabeth Montgomery-Worthington Victoria Arabella Rose Joy';
  expect(name).toHaveLength(80);
  for (const age of ['3 months old', '2 years old', '10 years old', '17 years old',
    '18 years old', '50 years old', 'Unknown age']) {
    const full = spacingCandidates(catalogue, name, age);
    const compact = spacingCandidates(catalogue, name, age, true);
    for (const renderer of ['browser', 'pdf']) {
      const maximise = async candidates => {
        if (renderer === 'browser') return page.evaluate(candidates => {
          const sheet = document.createElement('article');
          sheet.className = 'studio-letter__paper';
          sheet.style.cssText = 'position:fixed;width:595.2756px;left:-10000px;top:0';
          const text = document.createElement('div'); text.className = 'studio-letter__text';
          sheet.append(text); document.body.append(sheet);
          const p = document.createElement('p'); text.append(p);
          const choose = (options, closing) => {
            p.style.width = closing ? `${.8 / .88 * 100}%` : '100%';
            return options.reduce((best, candidate) => {
              p.textContent = candidate;
              const height = p.getBoundingClientRect().height;
              return height > best.height ? { height, text: candidate } : best;
            }, { height: -1 }).text;
          };
          const paragraphs = candidates.paragraphs.map(options => choose(options, false));
          const closing = candidates.closing.map(options => choose(options, true));
          sheet.remove(); return { ...candidates.base, paragraphs, closing };
        }, candidates);
        const choose = (options, closing) => options.reduce((best, text) => {
          const lines = wrapLetterText(text, font, W * type.body, W * (closing ? .8 : .88)).length;
          return lines > best.lines ? { lines, text } : best;
        }, { lines: -1 }).text;
        return { ...candidates.base,
          paragraphs: candidates.paragraphs.map(options => choose(options, false)),
          closing: candidates.closing.map(options => choose(options, true)) };
      };
      const worst = await maximise(full);
      // Independently maximise compact alternatives too: this is a conservative
      // upper bound, not a shorter fixture substituted for an ordinary letter.
      worst.compactParagraphs = (await maximise(compact)).paragraphs;
      await fixture(page, worst);
      const chosen = await selected(page, worst);
      const plan = layoutStudioLetter(chosen, font);
      expect(plan.size).toBe(W * .0225);
      expect(plan.contentHeight / H + .24).toBeLessThan(.853);
      for (const width of [1440, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.getByRole('button', { name: 'Enlarge letter to read', exact: true }).click();
        const paper = page.locator('dialog[open] .studio-letter__paper');
        expectFrame(await measureLetterSpacing(paper));
        await expectLeftAlignedLetter(paper);
        await expect(paper.locator('.studio-letter__text > p')).toHaveText(chosen.paragraphs);
        await page.keyboard.press('Escape');
      }
      report.push({ age, renderer, compact: chosen.compact, leading: plan.leading,
        paragraphGap: plan.paragraphGap, end: plan.contentHeight / H + .24 });
      if (age === '50 years old') await pdfEvidence(page, worst, `longest-${renderer}`);
    }
  }
  expect(report.some(row => row.compact)).toBe(true);
  await writeFile(`${output}/longest-measurements.json`, JSON.stringify(report, null, 2));
});

test('short letters cap spare-space gaps and unexpected unfit input fails visibly without clipping', async ({ page }) => {
  await page.goto('/');
  const short = { ...edward, paragraphs: [edward.paragraphs[0], 'A warm Christmas hello!', edward.paragraphs.at(-1)],
    compactParagraphs: undefined };
  const chosen = await selected(page, short);
  expect(chosen.browserLayout.leading).toBe(type.maxLeading);
  expect(chosen.browserLayout.paragraphGap).toBe(type.maxParagraphGap);
  const impossible = { ...edward, paragraphs: Array(100).fill('This entire paragraph must not be hidden.'), compactParagraphs: undefined };
  await page.evaluate(async letter => {
    const { prepareStudioLetter } = await import('/src/lib/prepareStudioLetter.js');
    try { await prepareStudioLetter(letter); throw new Error('Unexpected success'); }
    catch (error) { if (!error.message.includes('cannot fit readably')) throw error; }
  }, impossible);
  await fixture(page, short);
  await page.evaluate(letter => { window.impossible = letter; }, impossible);
  // Reuse the real component's rendering boundary to exercise its error UI.
  await page.evaluate(async letter => {
    const [{ default: React }, { StudioGiftPreview }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'), import('/src/components/SantaStudioGifts.jsx'),
    ]);
    window.spacingRoot.render(React.createElement(StudioGiftPreview, { example: {
      name: letter.name, suppliedLetter: letter, staticPreview: true, picture: '/images/santa-nice-list.jpg',
    } }));
  }, impossible);
  await expect(page.getByRole('alert')).toContainText('could not be fitted safely');
  await expect(page.getByRole('button', { name: 'Enlarge letter to read', exact: true })).toBeDisabled();
  await expect(page.locator('[data-letter-ready]')).toHaveCount(0);
});
