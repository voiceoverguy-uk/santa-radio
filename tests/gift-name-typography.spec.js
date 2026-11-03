import { test, expect } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { PDFDocument, PDFRawStream, decodePDFRawStream } from 'pdf-lib';

const directory = 'generated-artifacts/gift-lettering';
const names = ['Big Dog Alice', 'Alice', 'Arabella', 'Ayla',
  'Alexandria-Catherine Elizabeth Montgomery-Worthington',
  'Élodie O’Neill-Sáenz', "Jean-Luc D'Ávila", 'A\u0301ine', 'Saffi Affie'];

async function fixture(page, name = 'Big Dog Alice') {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/free-santa-message');
  await page.evaluate(async name => {
    const [{ default: React }, { default: ReactDOM }, { StudioKeepsakePreview }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/components/SantaStudioGifts.jsx'),
    ]);
    const host = document.createElement('div');
    host.style.cssText = 'width:min(600px, calc(100vw - 24px)); margin:20px auto';
    document.body.replaceChildren(host);
    const root = ReactDOM.createRoot(host);
    const details = { age: '9 years old', activity: 'art', achievement: 'being brave',
      destination: 'England', treats: 'carrots for the reindeer' };
    window.paintGift = name => root.render(React.createElement(StudioKeepsakePreview, { name, details }));
    window.paintGift(name);
  }, name);
}

test('recipient font retries HTTP and corrupt responses without fallback names or stale edits', async ({ page }) => {
  let requests = 0;
  let release;
  const waiting = new Promise(resolve => { release = resolve; });
  await page.route('**/Lora-Italic.ttf', async route => {
    requests++;
    if (requests <= 2) return route.fulfill({ status: requests === 1 ? 503 : 200, body: 'unavailable' });
    await waiting;
    return route.continue();
  });
  await fixture(page);
  const certificate = page.locator('.studio-gifts__gallery .studio-certificate__name');
  const picture = page.locator('.studio-gifts__preview-stack .studio-santa-picture__name');
  await expect(certificate).toHaveAttribute('data-fitted', 'false');
  await expect(certificate).toHaveCSS('visibility', 'hidden');
  await page.evaluate(() => window.paintGift('Arabella'));
  release();
  await expect(certificate).toHaveAttribute('data-fitted', 'true', { timeout: 12000 });
  await expect(picture).toHaveAttribute('data-fitted', 'true');
  await expect(certificate).toHaveText('Arabella');
  await expect(picture).toHaveText('Arabella');
  expect(requests).toBeGreaterThanOrEqual(3);
});

for (const width of [390, 1440]) {
  test(`certificate names fit the PDF region in cards and enlargements at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await fixture(page);
    for (const name of names) {
      await page.evaluate(name => window.paintGift(name), name);
      const compact = page.locator('.studio-gifts__gallery .studio-certificate__name');
      await expect(compact).toHaveText(name.normalize('NFC'));
      await expect(compact).toHaveAttribute('data-fitted', 'true');
      for (const enlarged of [false, true]) {
        if (enlarged) await page.getByRole('button', { name: 'Enlarge certificate', exact: true }).click();
        const element = enlarged ? page.locator('dialog .studio-certificate__name') : compact;
        await expect(element).toHaveAttribute('data-fitted', 'true');
        const bounds = await element.locator('text').evaluate(text => {
          const b = text.getBBox();
          return { left: b.x, right: b.x + b.width, top: b.y, bottom: b.y + b.height,
            font: getComputedStyle(text).fontFamily, style: getComputedStyle(text).fontStyle };
        });
        expect(bounds.font).toContain('Lora');
        expect(bounds.style).toBe('italic');
        // SVG getBBox includes font line metrics, so measure actual ink separately.
        const ink = await element.locator('text').evaluate(text => {
          const context = document.createElement('canvas').getContext('2d');
          // Measure in artwork coordinates, not hinted tiny CSS-pixel glyphs.
          context.font = 'italic 400 1000px "Lora"';
          context.fontKerning = 'none';
          const b = context.measureText(text.textContent);
          const x = Number(text.getAttribute('x')), y = Number(text.getAttribute('y'));
          const scale = Number(text.getAttribute('font-size')) / 1000;
          return { left: x - b.actualBoundingBoxLeft * scale, right: x + b.actualBoundingBoxRight * scale,
            top: y - b.actualBoundingBoxAscent * scale, bottom: y + b.actualBoundingBoxDescent * scale };
        });
        expect(ink.left).toBeGreaterThanOrEqual(37.9);
        expect(ink.right).toBeLessThanOrEqual(259.1);
        expect(ink.top).toBeGreaterThanOrEqual(76.9);
        expect(ink.bottom).toBeLessThanOrEqual(101.1);
        expect((ink.left + ink.right) / 2).toBeCloseTo(148.5, 0);
        if (name === 'Big Dog Alice') {
          mkdirSync(directory, { recursive: true });
          await element.locator('..').screenshot({ path: `${directory}/certificate-${width}-${enlarged ? 'large' : 'card'}.png` });
        }
        if (enlarged) await page.getByRole('button', { name: 'Close preview', exact: true }).click();
      }
    }
    await expect(page.locator('.studio-gifts .studio-letter__signature')).toHaveCSS('font-family', '"Great Vibes", cursive');
  });
}

test('a later successful font load restores previews after automatic retries are exhausted', async ({ page }) => {
  let available = false;
  await page.route('**/Lora-Italic.ttf', route => available ? route.continue()
    : route.fulfill({ status: 503, body: 'unavailable' }));
  await fixture(page, 'Ayla');
  const certificate = page.locator('.studio-gifts__gallery .studio-certificate__name');
  const picture = page.locator('.studio-gifts__preview-stack .studio-santa-picture__name');
  // Exhaust the bounded automatic retry window, not an indefinite request loop.
  await page.waitForTimeout(6500);
  await expect(certificate).toHaveAttribute('data-fitted', 'false');
  await expect(picture).toHaveAttribute('data-fitted', 'false');
  available = true;
  await page.evaluate(async () => {
    const { loadRecipientFont } = await import('/src/lib/giftFonts.js');
    await loadRecipientFont();
  });
  await expect(certificate).toHaveAttribute('data-fitted', 'true');
  await expect(picture).toHaveAttribute('data-fitted', 'true');
});

test('all three PNG exports use the fitted Lora ink and letter PDF keeps the original signature font', async ({ page }) => {
  test.setTimeout(120000);
  await fixture(page);
  mkdirSync(directory, { recursive: true });
  const signatureBytes = readFileSync('public/certificates/nice-list/GreatVibes-Regular.ttf');
  const letterBase64 = await page.evaluate(async () => {
    const { createStudioLetter } = await import('/src/lib/santaStudioLetter.js');
    const { exportStudioLetter } = await import('/src/lib/studioGiftExports.js');
    const blob = await exportStudioLetter(createStudioLetter('Alice', () => .5));
    return new Promise(resolve => { const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]); reader.readAsDataURL(blob); });
  });
  const letterBytes = Buffer.from(letterBase64, 'base64');
  writeFileSync(`${directory}/signature-letter.pdf`, letterBytes);
  const pdf = await PDFDocument.load(letterBytes);
  expect(pdf.context.enumerateIndirectObjects().some(([, obj]) => obj instanceof PDFRawStream &&
    Buffer.from(decodePDFRawStream(obj).decode()).equals(signatureBytes))).toBe(true);
  for (const name of names) {
    const results = await page.evaluate(async name => {
      const { exportStudioPicture } = await import('/src/lib/studioGiftExports.js');
      const { santaPictureFrames, fitSantaPictureName } = await import('/src/lib/santaPictureLayout.js');
      const { recipientCanvasFont, recipientDisplayName } = await import('/src/lib/giftFonts.js');
      const results = [];
      for (const picture of Object.keys(santaPictureFrames)) {
        const blob = await exportStudioPicture(name, picture);
        const png = await createImageBitmap(blob);
        const canvas = document.createElement('canvas');
        canvas.width = 1536; canvas.height = 1024;
        const context = canvas.getContext('2d');
        const background = await createImageBitmap(await (await fetch(picture)).blob());
        context.drawImage(background, 0, 0);
        const fit = fitSantaPictureName(context, name, picture), frame = santaPictureFrames[picture];
        context.font = recipientCanvasFont(fit.size);
        context.fillStyle = '#19392d';
        context.fillText(recipientDisplayName(name), frame.x + fit.x, frame.y + fit.y);
        const expected = context.getImageData(0, 0, 1536, 1024).data;
        context.clearRect(0, 0, 1536, 1024);
        context.drawImage(png, 0, 0);
        const actual = context.getImageData(0, 0, 1536, 1024).data;
        let changed = 0;
        for (let i = 0; i < actual.length; i++) if (actual[i] !== expected[i]) changed++;
        results.push({ picture, changed, base64: name === 'Big Dog Alice' ? canvas.toDataURL().split(',')[1] : null });
      }
      return results;
    }, name);
    for (const [index, result] of results.entries()) {
      expect(result.changed, `${name} in ${result.picture}`).toBe(0);
      if (result.base64) writeFileSync(`${directory}/alice-picture-${index + 1}.png`, Buffer.from(result.base64, 'base64'));
    }
  }
  execFileSync('pdftoppm', ['-singlefile', '-scale-to', '1100', '-png', `${directory}/signature-letter.pdf`, `${directory}/signature-letter`]);
});
