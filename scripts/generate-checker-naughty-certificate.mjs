// Rework only the checker derivative. Never modify the Studio's paid master.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { PDFDocument, PDFName, PDFArray, PDFDict, PDFNumber, decodePDFRawStream } from 'pdf-lib';

const pdf = await PDFDocument.load(await readFile('public/certificates/nice-list/master.pdf'));
const page = pdf.getPages()[0];
const font = page.node.Resources().lookup(PDFName.of('Font'), PDFDict)
  .lookup(PDFName.of('F2+0'), PDFDict);
const widths = font.lookup(PDFName.of('Widths'), PDFArray);
const first = font.lookup(PDFName.of('FirstChar'), PDFNumber).asNumber();
const width = (text, size) => [...text].reduce((sum, character) =>
  sum + widths.lookup(character.charCodeAt(0) - first, PDFNumber).asNumber(), 0) * size / 1000;
const replacements = new Map([
  ['Official Nice List Certificate', 'Official Naughty List Certificate'],
  ['Santa Claus and Santa Radio proudly certify that', 'Santa Claus and Santa Radio have checked and found that'],
  ['has earned their place on the Nice List!', 'is currently on the Naughty List!'],
  ['Thank you for spreading kindness, sharing smiles', 'Everyone has tricky days. A little kindness can change things.'],
  ["and keeping the Christmas spirit alive. I'm very proud of you!", 'Help someone, share a smile and have another go!'],
  ['NICE LIST', 'NAUGHTY LIST'],
  ['APPROVED', 'FOR NOW'],
]);
const updated = new Map();
const contents = page.node.get(PDFName.of('Contents'));
for (const ref of contents instanceof PDFArray ? contents.asArray() : [contents]) {
  const stream = pdf.context.lookup(ref);
  const original = Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1');
  const revised = original.replace(
    /BT 1 0 0 1 ([\d.]+) ([\d.]+) Tm \/F2\+0 ([\d.]+) Tf ([\d.]+) TL \(([^()]*)\) Tj T\* ET/g,
    (match, x, y, size, leading, text) => {
      if (!replacements.has(text)) return match;
      updated.set(text, (updated.get(text) || 0) + 1);
      const replacement = replacements.get(text);
      const centre = Number(x) + width(text, Number(size)) / 2;
      const fittedSize = text === 'NICE LIST' ? Math.min(Number(size), 78 / width(replacement, 1)) : Number(size);
      const left = centre - width(replacement, fittedSize) / 2;
      return `BT 1 0 0 1 ${left.toFixed(4)} ${y} Tm /F2+0 ${fittedSize} Tf ${leading} TL (${replacement}) Tj T* ET`;
    });
  pdf.context.assign(ref, pdf.context.flateStream(Buffer.from(revised, 'latin1')));
}
assert.deepEqual([...updated.keys()].sort(), [...replacements.keys()].sort(), 'Master text changed; inspect before regenerating.');
for (const [text, count] of updated) {
  // The embossed seal has shadow, highlight and foreground lettering.
  assert.equal(count, ['NICE LIST', 'APPROVED'].includes(text) ? 3 : 1, `Unexpected text count: ${text}`);
}
const work = 'generated-artifacts/checker-certificate';
await mkdir(work, { recursive: true });
await mkdir('public/certificates/checker', { recursive: true });
await writeFile(`${work}/naughty-master.pdf`, await pdf.save());
execFileSync('pdftoppm', ['-singlefile', '-scale-to-x', '1684', '-scale-to-y', '1191',
  '-png', `${work}/naughty-master.pdf`, `${work}/naughty-master`]);
execFileSync('cwebp', ['-quiet', '-q', '90', `${work}/naughty-master.png`,
  '-o', 'public/certificates/checker/naughty-master.webp']);
console.log('Created checker-only Naughty certificate; Studio master unchanged.');
