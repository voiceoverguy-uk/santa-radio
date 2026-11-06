// Rework only the checker derivatives (Nice and Naughty). Never modify the Studio's paid master.
// Text is replaced inside the PDF content streams (no painted blocks). Strings that need glyphs
// outside the master's 0-127 subsets (the curly apostrophe) use freshly embedded copies of the
// same CertificateSerif / Great Vibes fonts shipped beside the master (embedded whole: fontkit
// subsetting drops CertificateSerif glyphs under Poppler).
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, PDFName, PDFArray, PDFDict, PDFNumber, PDFRawStream, decodePDFRawStream } from 'pdf-lib';

const MASTER = 'public/certificates/nice-list/master.pdf';
const FONTS = 'public/certificates/nice-list';
const TITLE = 'HEAD ELF\u2019S VERY UNOFFICIAL CERTIFICATE';
const INTRO = 'Head Elf in is limited ability, sort of certifies that'; // owner's wording, verbatim
const SIGNATURE = 'Head Elf';
const TITLE_MAX_WIDTH = 560; // inner width available between the festive borders, in points

const shared = {
  'Santa Claus and Santa Radio proudly certify that': { text: INTRO }, // plain ASCII: stays in the master's own subset (avoids fi-ligature spacing)
  'Santa Claus': { text: SIGNATURE, font: 'script' },
};
const variants = {
  nice: {
    'Official Nice List Certificate': { text: TITLE, font: 'serif', maxWidth: TITLE_MAX_WIDTH },
    ...shared,
  },
  naughty: {
    'Official Nice List Certificate': { text: TITLE, font: 'serif', maxWidth: TITLE_MAX_WIDTH },
    ...shared,
    'has earned their place on the Nice List!': { text: 'is currently on the Naughty List!' },
    'Thank you for spreading kindness, sharing smiles': { text: 'Everyone has tricky days. A little kindness can change things.' },
    "and keeping the Christmas spirit alive. I'm very proud of you!": { text: 'Help someone, share a smile and have another go!' },
    'NICE LIST': { text: 'NAUGHTY LIST', maxWidth: 78, count: 3 },
    'APPROVED': { text: 'FOR NOW', count: 3 },
  },
};

const masterBytes = await readFile(MASTER);
const serifBytes = await readFile(`${FONTS}/CertificateSerif.ttf`);
const scriptBytes = await readFile(`${FONTS}/GreatVibes-Regular.ttf`);
const work = 'generated-artifacts/checker-certificate';
await mkdir(work, { recursive: true });
await mkdir('public/certificates/checker', { recursive: true });

const escape = text => text.replace(/[\\()]/g, '\\$&');

for (const [variant, replacements] of Object.entries(variants)) {
  const pdf = await PDFDocument.load(masterBytes);
  pdf.registerFontkit(fontkit);
  const page = pdf.getPages()[0];
  const fontDict = page.node.Resources().lookup(PDFName.of('Font'), PDFDict);
  // Widths of the master's own simple fonts, used to keep original centring.
  const simpleWidth = key => {
    const font = fontDict.lookup(PDFName.of(key), PDFDict);
    const widths = font.lookup(PDFName.of('Widths'), PDFArray);
    const first = font.lookup(PDFName.of('FirstChar'), PDFNumber).asNumber();
    return (text, size) => [...text].reduce((sum, c) =>
      sum + widths.lookup(c.charCodeAt(0) - first, PDFNumber).asNumber(), 0) * size / 1000;
  };
  const masterWidth = { 'F2+0': simpleWidth('F2+0'), 'F3+0': simpleWidth('F3+0') };
  const embedded = {
    serif: await pdf.embedFont(serifBytes, { subset: false }),
    script: await pdf.embedFont(scriptBytes, { subset: false }),
  };
  const resourceName = {
    serif: page.node.newFontDictionary('CheckerSerif', embedded.serif.ref).asString().slice(1),
    script: page.node.newFontDictionary('CheckerScript', embedded.script.ref).asString().slice(1),
  };

  const updated = new Map();
  const contents = page.node.get(PDFName.of('Contents'));
  for (const ref of contents instanceof PDFArray ? contents.asArray() : [contents]) {
    const stream = pdf.context.lookup(ref);
    // newFontDictionary() wraps the page in q/Q PDFContentStreams; only the raw master streams carry text.
    if (!(stream instanceof PDFRawStream)) continue;
    const original = Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1');
    const revised = original.replace(
      /BT 1 0 0 1 ([\d.]+) ([\d.]+) Tm \/(F[23]\+0) ([\d.]+) Tf ([\d.]+) TL \(([^()]*)\) Tj T\* ET/g,
      (match, x, y, key, size, leading, text) => {
        const rule = replacements[text];
        if (!rule) return match;
        updated.set(text, (updated.get(text) || 0) + 1);
        const centre = Number(x) + masterWidth[key](text, Number(size)) / 2;
        if (rule.font) {
          const font = embedded[rule.font];
          const natural = font.widthOfTextAtSize(rule.text, 1);
          const fitted = Math.min(Number(size), rule.maxWidth ? rule.maxWidth / natural : Infinity);
          const left = centre - natural * fitted / 2;
          const lead = (Number(leading) * fitted / Number(size)).toFixed(4);
          return `BT 1 0 0 1 ${left.toFixed(4)} ${y} Tm /${resourceName[rule.font]} ${fitted.toFixed(4)} Tf ${lead} TL ${font.encodeText(rule.text).toString()} Tj T* ET`;
        }
        const natural = masterWidth[key](rule.text, 1);
        const fitted = Math.min(Number(size), rule.maxWidth ? rule.maxWidth / natural : Infinity);
        const left = centre - natural * fitted / 2;
        return `BT 1 0 0 1 ${left.toFixed(4)} ${y} Tm /${key} ${fitted} Tf ${leading} TL (${escape(rule.text)}) Tj T* ET`;
      });
    pdf.context.assign(ref, pdf.context.flateStream(Buffer.from(revised, 'latin1')));
  }
  assert.deepEqual([...updated.keys()].sort(), Object.keys(replacements).sort(),
    `Master text changed; inspect before regenerating (${variant}).`);
  for (const [text, count] of updated)
    // The embossed seal has shadow, highlight and foreground lettering.
    assert.equal(count, replacements[text].count || 1, `Unexpected text count: ${text}`);

  const base = `${work}/${variant}-master`;
  await writeFile(`${base}.pdf`, await pdf.save());
  execFileSync('pdftoppm', ['-singlefile', '-scale-to-x', '1684', '-scale-to-y', '1191',
    '-png', `${base}.pdf`, base]);
  execFileSync('cwebp', ['-quiet', '-q', '90', `${base}.png`,
    '-o', `public/certificates/checker/${variant}-master.webp`]);
  console.log(`Created checker-only ${variant} certificate.`);
}
console.log('Studio master unchanged.');
