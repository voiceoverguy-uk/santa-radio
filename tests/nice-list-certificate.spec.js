// Retain browser-side generation coverage without exposing a free UI download.
import { test, expect } from '@playwright/test';
import { PDFDocument, decodePDFRawStream } from 'pdf-lib';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/santa-names?*', route => route.fulfill({
    json: { records: [], hostedCount: 1, warning: null },
  }));
  await page.goto('/free-santa-message');
});

test('browser filename handling preserves accents and removes unsafe characters', async ({ page }) => {
  const filenames = await page.evaluate(async () => {
    const { certificateDownloadFilename } = await import('/src/lib/niceListCertificate.js');
    return ["  Élodie   O’Neill-Sáenz  ", "Jean-Luc D'Ávila", '../Olivia\\Rose', 'Olivia\u0000\u202e', 'É'.repeat(300)]
      .map(certificateDownloadFilename);
  });
  expect(filenames.slice(0, 4)).toEqual([
    'Santa-Radio-Nice-List-Certificate-Élodie O’Neill-Sáenz.pdf',
    "Santa-Radio-Nice-List-Certificate-Jean-Luc D'Ávila.pdf",
    'Santa-Radio-Nice-List-Certificate--Olivia-Rose.pdf',
    'Santa-Radio-Nice-List-Certificate-Olivia.pdf',
  ]);
  for (const filename of filenames) {
    expect(filename).not.toMatch(/[<>:"/\\|?*\p{Cc}\p{Cf}]/u);
    expect(Buffer.byteLength(filename)).toBeLessThan(255);
  }
});

for (const name of ['Olivia', 'Alexandria-Catherine Elizabeth Montgomery-Worthington', 'Élodie O’Neill-Sáenz']) {
  test(`reusable browser generator preserves the A4 certificate for ${name}`, async ({ page }) => {
    const requests = [];
    page.on('request', request => requests.push({ url: request.url(), body: request.postData() }));
    const bytes = await page.evaluate(async name => {
      const { personaliseNiceListCertificate } = await import('/src/lib/niceListCertificate.js');
      const blob = await personaliseNiceListCertificate(name);
      return [...new Uint8Array(await blob.arrayBuffer())];
    }, name);
    const pdf = await PDFDocument.load(Uint8Array.from(bytes), { updateMetadata: false });
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getPage(0).getWidth()).toBeCloseTo(297 * 72 / 25.4, 2);
    expect(pdf.getPage(0).getHeight()).toBeCloseTo(210 * 72 / 25.4, 2);
    expect(pdf.getTitle()).toBe('Official Nice List Certificate — Santa Radio');
    for (const request of requests) {
      expect(decodeURIComponent(request.url)).not.toContain(name);
      expect(request.body || '').not.toContain(name);
    }
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain(name);
  });
}

test('reusable generation rolls a fresh Nice status for each certificate', async ({ page }) => {
  for (const [roll, score] of [[0, 75], [1 - Number.EPSILON, 95]]) {
    const bytes = await page.evaluate(async roll => {
      Math.random = () => roll;
      const { personaliseNiceListCertificate } = await import('/src/lib/niceListCertificate.js');
      return [...new Uint8Array(await (await personaliseNiceListCertificate('Olivia')).arrayBuffer())];
    }, roll);
    const pdf = await PDFDocument.load(Uint8Array.from(bytes), { updateMetadata: false });
    const content = pdf.getPage(0).node.Contents().asArray().map(ref =>
      Buffer.from(decodePDFRawStream(pdf.context.lookup(ref)).decode()).toString()).join('\n');
    expect(content).toContain(`Based on behaviour this year, you are awarded ${score}% Nice status!`);
  }
});

for (const corrupt of [false, true]) {
  test(`reusable generation recovers after ${corrupt ? 'corrupt' : 'unavailable'} assets`, async ({ page }) => {
    let requests = 0;
    await page.route('**/certificates/nice-list/master.pdf', route => {
      if (++requests === 1) return route.fulfill({ status: corrupt ? 200 : 503, body: 'unavailable' });
      return route.continue();
    });
    const result = await page.evaluate(async () => {
      const { personaliseNiceListCertificate } = await import('/src/lib/niceListCertificate.js');
      let failed = false;
      try { await personaliseNiceListCertificate('Olivia'); } catch { failed = true; }
      const blob = await personaliseNiceListCertificate('Olivia');
      return { failed, size: blob.size, type: blob.type };
    });
    expect(result.failed).toBe(true);
    expect(result.size).toBeGreaterThan(0);
    expect(result.type).toBe('application/pdf');
    expect(requests).toBe(2);
  });
}
