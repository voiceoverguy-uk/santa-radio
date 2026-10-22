import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PDFDocument, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { certificateDownloadFilename, fitCertificateName, personaliseNiceListCertificate } from '../src/lib/niceListCertificate.js';

const master = await readFile('public/certificates/nice-list/master.pdf');
const fontBytes = await readFile('public/certificates/nice-list/GreatVibes-Regular.ttf');
const metrics = fontkit.create(fontBytes);
const mm = n => n * 72 / 25.4;

for (const name of ['Olivia', 'Alexandria-Catherine Elizabeth Montgomery-Worthington',
  "Élodie O’Neill-Sáenz", "Jean-Luc D'Ávila", 'A\u0301ine', 'gjpqy', '  Olivia   Rose  ']) {
  test(`fits actual glyph bounds without distorting ${name}`, () => {
    const fit = fitCertificateName(name, metrics);
    assert.ok(fit.size <= mm(22.6));
    assert.ok(fit.bounds.left >= mm(38) - .001);
    assert.ok(fit.bounds.right <= mm(259) + .001);
    assert.ok(fit.bounds.bottom >= mm(109) - .001);
    assert.ok(fit.bounds.top <= mm(133) + .001);
    assert.ok(Math.abs((fit.bounds.left + fit.bounds.right) / 2 - mm(148.5)) < .001);
    assert.ok(Number.isFinite(fit.y));
  });
}

test('long names shrink proportionally; normal names keep nominal size', () => {
  assert.equal(fitCertificateName('Olivia', metrics).size, mm(22.6));
  assert.ok(fitCertificateName('Alexandria-Catherine Elizabeth Montgomery-Worthington', metrics).size < mm(22.6));
});

test('download filenames preserve readable names and remove unsafe characters', () => {
  for (const [name, expected] of [
    ['Olivia', 'Olivia'], ['  Olivia   Rose  ', 'Olivia Rose'],
    ["Élodie O’Neill-Sáenz", "Élodie O’Neill-Sáenz"],
    ["Jean-Luc D'Ávila", "Jean-Luc D'Ávila"], ['E\u0301lodie', 'Élodie'],
    ['../Olivia\\Rose:<>"|?*', '-Olivia-Rose-------'],
    ['Olivia\u0000\u001f\u007f\u202e', 'Olivia'],
    ['...', 'Recipient'], ['', 'Recipient'], ['CON', 'CON'],
  ]) {
    assert.equal(certificateDownloadFilename(name), `Santa-Radio-Nice-List-Certificate-${expected}.pdf`);
  }
  const long = certificateDownloadFilename('É'.repeat(300));
  assert.ok(Buffer.byteLength(long) < 255);
  assert.ok(long.endsWith('.pdf'));
  assert.ok(!long.includes('\uFFFD'));
});

test('unsupported glyphs, controls and blank names fail explicitly', () => {
  for (const name of [' ', '', 'Olivia\nErin', 'Olivia\tErin', 'Olivia 🎅']) {
    assert.throws(() => fitCertificateName(name, metrics));
  }
});

test('one A4 page retains original content streams and generic metadata, appending embedded vector text only', async () => {
  const original = await PDFDocument.load(master, { updateMetadata: false });
  const blob = await personaliseNiceListCertificate("Élodie O’Neill-Sáenz", [master, fontBytes]);
  const pdf = await PDFDocument.load(await blob.arrayBuffer(), { updateMetadata: false });
  assert.equal(blob.type, 'application/pdf');
  assert.equal(pdf.getPageCount(), 1);
  assert.ok(Math.abs(pdf.getPage(0).getWidth() - mm(297)) < .1);
  assert.ok(Math.abs(pdf.getPage(0).getHeight() - mm(210)) < .1);
  for (const getter of ['getTitle', 'getAuthor', 'getSubject', 'getKeywords', 'getCreator', 'getProducer']) {
    assert.equal(pdf[getter](), original[getter]());
  }
  // Original compressed content survives byte-for-byte, rather than a raster
  // reconstruction of the certificate's lettering, signature and seal.
  const originalStream = original.context.lookup(original.getPage(0).node.Contents());
  const streams = pdf.getPage(0).node.Contents().asArray().map(ref => pdf.context.lookup(ref));
  assert.ok(streams.some(stream => Buffer.from(stream.getContents())
    .equals(Buffer.from(originalStream.getContents()))));
  assert.ok(pdf.context.enumerateIndirectObjects().some(([, object]) =>
    object instanceof PDFRawStream &&
    Buffer.from(decodePDFRawStream(object).decode()).equals(fontBytes)),
  'the complete supplied font must remain embedded; subsetting lost visible glyphs');
});
