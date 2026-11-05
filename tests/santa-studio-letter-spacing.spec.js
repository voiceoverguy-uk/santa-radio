import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { PDFDocument } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { studioLetterLayout as current } from '../src/lib/studioLetterLayout.js';
import { layoutStudioLetter, wrapLetterText } from '../src/lib/studioGiftExports.js';
import { workshopCatalogue } from '../server/santa-workshop-catalogue.js';
import { measureLetterSpacing } from './helpers/studio-letter-spacing.js';
import { spacingCandidates } from './helpers/studio-letter-spacing-candidates.js';

const output = 'generated-artifacts/studio-spacing';
// An explicit, unshipped comparison, never a per-letter production adjustment.
const trial = { leading: 1.25, paragraphGap: .18 };
const erin = {
  name: 'Erin',
  paragraphs: [
    'Dear Erin,',
    'We tried a new puzzle on the long table this morning. Nobody could find the final piece until I lifted my sleeve. There it was, caught in the cuff. My coat has now been searched for further missing scenery.',
    'You are 3 years old. The world is full of new things to try. Take your time: even my elves needed help with their first ribbon!',
    'A word about “bike riding”, while I have my pen out. Learning to steer and stop deserves as much care as getting going. Enjoy the progress at your own pace.',
    'The sleigh runners have been polished until they reflect the stable lanterns. An elf knelt down to inspect them and found his own hat looking back. He gave it a solemn nod before returning to the checklist.',
    'Here is a Christmas cheer for “being brave”! Being brave can include feeling worried and asking for support. You never have to hide a feeling to deserve kindness.',
    'I have marked Scotland in the travel book. My imaginary Scotland log has Edinburgh Castle on its cover. The illustrator gave my sleigh a rather grand parking space.',
    'My offering note reads “a box of shortbread”. My snack notebook has gained an interesting entry. The elves insist crumbs do not count as wrapping decorations.',
    'At the North Pole, the kitchen door closes with a soft wooden click. I heard it tonight as I settled into my chair. Such a tiny sound, but it made the room feel ready for a peaceful spell of writing.',
    'Now, Erin, this Christmas wish comes without a test or a score: a little joy, a little kindness and a welcome just as you are.',
    'By the way, Erin, do you like jokes? Where do snowmen keep their money? In a snowbank!',
    'With a very merry Christmas hello,',
  ],
  closing: ['The North Pole', 'P.S. I have approved your Nice List certificate. The seal is official; the elf’s proud grin is entirely unofficial.'],
};

async function fixture(page, letter) {
  await page.evaluate(async letter => {
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
      picture: '/images/santa-nice-list.jpg', reducedMotion: true,
    } }));
  }, letter);
  await expect(page.locator('.studio-gifts')).toHaveAttribute('data-demo-name', letter.name);
  await expect(page.locator('.studio-gifts__preview-stack .studio-letter__text > p'))
    .toHaveText(letter.paragraphs);
}

function expectPitch(metrics) {
  expect(metrics.pitch.length).toBeGreaterThan(4);
  for (const pitch of metrics.pitch) {
    // A print-size floor independent of the shared constant catches accidental
    // tightly packed inline text even if container styles still look correct.
    expect(pitch).toBeGreaterThan(15.3);
    expect(pitch).toBeCloseTo(595.2756 * current.body * current.leading, 0);
  }
  for (const paragraph of metrics.paragraphs) {
    expect(paragraph.font).toBeCloseTo(595.2756 * .0225, 2);
    expect(paragraph.gap).toBeCloseTo(595.2756 * current.body * current.paragraphGap, 0);
  }
}

test('actual homepage, Review and enlarged line pitches agree with the downloaded PDF', async ({ page }) => {
  await mkdir(output, { recursive: true });
  await page.setViewportSize({ width: 620, height: 939 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const homepage = page.locator('.studio-gifts__preview-stack .studio-letter__paper');
  await homepage.scrollIntoViewIfNeeded();
  expectPitch(await measureLetterSpacing(homepage));
  await page.getByRole('button', { name: 'Enlarge letter to read', exact: true }).click();
  expectPitch(await measureLetterSpacing(page.locator('dialog[open] .studio-letter__paper')));
  await page.keyboard.press('Escape');
  await fixture(page, erin);
  const compact = await measureLetterSpacing(page.locator('.studio-gifts__preview-stack .studio-letter__paper'));
  expectPitch(compact);
  await page.getByRole('button', { name: 'Enlarge letter to read', exact: true }).click();
  await page.evaluate(() => document.fonts.ready);
  const paper = page.locator('dialog[open] .studio-letter__paper');
  const before = await measureLetterSpacing(paper);
  expectPitch(before);
  expect(before.end).toBeLessThan(.88);
  await paper.screenshot({ path: `${output}/erin-current.png` });
  const override = await page.addStyleTag({ content: `
    .studio-letter__text { line-height:${trial.leading}; }
    .studio-letter__text p { margin-bottom:${trial.paragraphGap}em; }
  ` });
  const after = await measureLetterSpacing(paper);
  expect(after.sheet).toEqual(before.sheet);
  expect(after.end).toBeLessThan(.88);
  expect(Math.min(...after.pitch) - Math.min(...before.pitch)).toBeGreaterThan(.8);
  expect(Math.min(...after.inkGaps) - Math.min(...before.inkGaps)).toBeGreaterThan(.8);
  expect(after.paragraphs.map(p => p.font)).toEqual(before.paragraphs.map(p => p.font));
  await paper.screenshot({ path: `${output}/erin-trial-not-applied.png` });
  await override.evaluate(node => node.remove());
  const bytes = await page.evaluate(async letter => {
    const { exportStudioLetter } = await import('/src/lib/studioGiftExports.js');
    return [...new Uint8Array(await (await exportStudioLetter(letter)).arrayBuffer())];
  }, erin);
  const file = `${output}/erin-current.pdf`;
  await writeFile(file, new Uint8Array(bytes));
  expect((await PDFDocument.load(new Uint8Array(bytes))).getPageCount()).toBe(1);
  const extracted = execFileSync('pdftotext', [file, '-'], { encoding: 'utf8' }).replace(/\s+/gu, ' ');
  for (const p of [...erin.paragraphs, 'Santa Claus', ...erin.closing]) {
    expect(extracted).toContain(p.replace(/\s+/gu, ' '));
  }
  const boxes = execFileSync('pdftotext', ['-bbox-layout', file, '-'], { encoding: 'utf8' });
  const lines = [...boxes.matchAll(/<line xMin="[\d.]+" yMin="([\d.]+)" xMax="[\d.]+" yMax="([\d.]+)"/gu)];
  expect(Number(lines[2][1]) - Number(lines[1][1])).toBeCloseTo(before.pitch[0], 1);
  expect(Number(lines[1][1]) - Number(lines[0][1])).toBeCloseTo(
    before.pitch[0] + before.paragraphs[0].gap, 1);
  expect(Math.max(...lines.map(line => Number(line[2])))).toBeLessThan(841.8898 * .88);
  await writeFile(`${output}/erin-measurements.json`, JSON.stringify({ before, trial: after }, null, 2));
});

test('spacing constraint audit measures independent browser and PDF longest combinations', async ({ page }) => {
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
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.goto('/free-santa-message');
  await fixture(page, erin);
  await page.evaluate(() => document.fonts.ready);
  const report = [];
  const name = 'Alexandria-Catherine Elizabeth Montgomery-Worthington Victoria Arabella Rose Joy';
  expect(name).toHaveLength(80);
  for (const age of ['3 months old', '2 years old', '10 years old', '17 years old',
    '18 years old', '50 years old', 'Unknown age']) {
    const candidates = spacingCandidates(catalogue, name, age);
    for (const fallback of [false, true]) {
      const longest = await page.evaluate(({ candidates, fallback }) => {
        const sheet = document.createElement('article');
        sheet.className = 'studio-letter__paper';
        sheet.style.cssText = 'position:fixed;width:794px;left:-10000px;top:0';
        const text = document.createElement('div');
        text.className = 'studio-letter__text';
        if (fallback) text.style.fontFamily = '"Times New Roman", serif';
        sheet.append(text); document.body.append(sheet);
        const p = document.createElement('p'); text.append(p);
        const choose = (options, closing) => {
          p.style.width = closing ? `${.8 / .88 * 100}%` : '100%';
          return options.reduce((best, candidate) => {
            p.textContent = candidate;
            const height = p.getBoundingClientRect().height;
            return height > best.height ? { height, text: candidate } : best;
          }, { height: -1 });
        };
        const paragraphs = candidates.paragraphs.map(options => choose(options, false).text);
        const closing = candidates.closing.map(options => choose(options, true).text);
        sheet.remove();
        return { ...candidates.base, paragraphs, closing };
      }, { candidates, fallback });
      await fixture(page, longest);
      const override = await page.addStyleTag({ content: fallback
        ? '.studio-letter__text { font-family:"Times New Roman",serif !important } .studio-letter__signature { font-family:cursive !important }'
        : '/* production font stack */' });
      const paper = page.locator('.studio-gifts__preview-stack .studio-letter__paper');
      // Canonical print-size measurement avoids subpixel thumbnail wrapping.
      const canonical = await page.addStyleTag({ content: `
        .studio-gifts__thumbnail-artwork:has(.studio-letter__paper) { width:794px }
      ` });
      for (const spacing of [current, trial]) {
        const spacingStyle = await page.addStyleTag({ content: `
          .studio-letter__text { line-height:${spacing.leading}; }
          .studio-letter__text p { margin-bottom:${spacing.paragraphGap}em; }
        ` });
        const measured = await measureLetterSpacing(paper);
        report.push({ renderer: fallback ? 'browser-fallback' : 'browser', age,
          leading: spacing.leading, paragraphGap: spacing.paragraphGap, end: measured.end,
          lines: measured.paragraphs.reduce((sum, p) => sum + p.lines.length, 0),
          excessPoints: Math.max(0, measured.end - .88) * 841.8898 });
        await spacingStyle.evaluate(node => node.remove());
      }
      await canonical.evaluate(node => node.remove());
      await override.evaluate(node => node.remove());
    }
    // Maximise the embedded font independently; browser maxima need not
    // produce the PDF's maximum number of lines.
    const choose = (options, closing) => options.reduce((best, text) => {
      const lines = wrapLetterText(text, font, 595.2756 * current.body, 595.2756 * (closing ? .8 : .88)).length;
      return lines > best.lines ? { lines, text } : best;
    }, { lines: -1 });
    const groups = [...candidates.paragraphs.map(options => choose(options, false)),
      ...candidates.closing.map(options => choose(options, true))];
    const size = 595.2756 * current.body;
    const count = groups.reduce((sum, group) => sum + group.lines, 0);
    for (const spacing of [current, trial]) {
      const height = count * size * spacing.leading + groups.length * size * spacing.paragraphGap
        + 595.2756 * current.signature * 1.5;
      report.push({ renderer: 'pdf', age, lines: count, leading: spacing.leading,
        paragraphGap: spacing.paragraphGap, end: current.top + height / 841.8898,
        excessPoints: Math.max(0, height - 841.8898 * (current.bottom - current.top)) });
    }
    const worst = { ...candidates.base, paragraphs: groups.slice(0, 12).map(group => group.text),
      closing: groups.slice(12).map(group => group.text) };
    const measured = report.filter(item => item.renderer === 'pdf' && item.age === age && item.leading === current.leading)[0];
    if (measured.excessPoints) {
      expect(() => layoutStudioLetter(worst, font)).toThrow('cannot fit readably on one page');
    } else {
      expect(layoutStudioLetter(worst, font).contentHeight / 841.8898 + current.top).toBeCloseTo(measured.end, 8);
      if (age === '50 years old') {
        const bytes = await page.evaluate(async letter => {
          const { exportStudioLetter } = await import('/src/lib/studioGiftExports.js');
          return [...new Uint8Array(await (await exportStudioLetter(letter)).arrayBuffer())];
        }, worst);
        const file = `${output}/longest-current.pdf`;
        await writeFile(file, new Uint8Array(bytes));
        expect((await PDFDocument.load(new Uint8Array(bytes))).getPageCount()).toBe(1);
        const extracted = execFileSync('pdftotext', [file, '-'], { encoding: 'utf8' }).replace(/\s+/gu, ' ');
        for (const paragraph of [...worst.paragraphs, 'Santa Claus', ...worst.closing]) {
          expect(extracted).toContain(paragraph.replace(/\s+/gu, ' '));
        }
        const boxes = execFileSync('pdftotext', ['-bbox-layout', file, '-'], { encoding: 'utf8' });
        const lines = [...boxes.matchAll(/<line xMin="[\d.]+" yMin="([\d.]+)" xMax="[\d.]+" yMax="([\d.]+)"/gu)];
        expect(Math.min(...lines.map(line => Number(line[1])))).toBeGreaterThan(841.8898 * .24 - .5);
        expect(Math.max(...lines.map(line => Number(line[2])))).toBeLessThan(841.8898 * .88);
      }
    }
  }
  await writeFile(`${output}/longest-measurements.json`, JSON.stringify(report, null, 2));
  // This audit is evidence, not a passing fit assertion: the separate existing
  // full-content regression remains strict and continues to expose overflow.
  console.log('Spacing limits:', JSON.stringify(report.filter(row => row.excessPoints > 0)));
  expect(report).toHaveLength(42);
});
