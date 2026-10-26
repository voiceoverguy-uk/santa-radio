// Loaded only on a certificate click. No recipient data leaves this module.
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFNumber, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

export const CERTIFICATE_MASTER = '/certificates/nice-list/master.pdf';
export const CERTIFICATE_FONT = '/certificates/nice-list/GreatVibes-Regular.ttf';
const mm = value => value * 72 / 25.4;
// Great Vibes' contextual ligatures collide with unrelated Unicode entries in
// pdf-lib's full-font character map. Keep individual script letters so PDF
// extraction/accessibility preserves the actual name as well as its appearance.
const fontFeatures = { calt: false, liga: false, clig: false };
let assets;

export function niceStatusPercentage(random = Math.random) {
  // Inclusive whole-number range: all 21 scores are equally likely.
  return 75 + Math.floor(random() * 21);
}

function addNiceStatus(pdf, page) {
  const text = `Based on behaviour this year, you are awarded ${niceStatusPercentage()}% Nice status!`;
  // Reuse the master's actual embedded serif and its ASCII width table:
  // no extra font fetch, replacement font, or recipient-dependent metadata.
  const serif = page.node.Resources().lookup(PDFName.of('Font'), PDFDict)
    .lookup(PDFName.of('F2+0'), PDFDict);
  const widths = serif.lookup(PDFName.of('Widths'), PDFArray);
  const first = serif.lookup(PDFName.of('FirstChar'), PDFNumber).asNumber();
  const size = 14.5;
  const width = [...text].reduce((sum, character) =>
    sum + widths.lookup(character.charCodeAt(0) - first, PDFNumber).asNumber(), 0) * size / 1000;
  const x = (page.getWidth() - width) / 2;
  // Between the enlarged title and its existing decorative divider.
  const stream = pdf.context.flateStream(
    `q\n0.945098 0.85098 0.584314 rg\nBT /F2+0 ${size} Tf 1 0 0 1 ${x} 450 Tm (${text}) Tj ET\nQ\n`);
  page.node.addContentStream(pdf.context.register(stream));
}

export function certificateDownloadFilename(name) {
  // Only the local download label uses this value, never a URL or metadata.
  const safe = String(name ?? '').normalize('NFC')
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/gu, ' ').trim().replace(/^[. ]+|[. ]+$/g, '');
  // Leave room for the fixed prefix/extension under common 255-byte limits.
  let recipient = '';
  const encoder = new TextEncoder();
  for (const character of safe) {
    if (encoder.encode(recipient + character).length > 160) break;
    recipient += character;
  }
  recipient = recipient.replace(/[. ]+$/g, '');
  return `Santa-Radio-Nice-List-Certificate-${recipient || 'Recipient'}.pdf`;
}

async function loadAssets() {
  if (!assets) {
    assets = Promise.all([CERTIFICATE_MASTER, CERTIFICATE_FONT].map(async url => {
      const response = await fetch(url, { credentials: 'omit' });
      if (!response.ok) throw new Error('Certificate asset unavailable');
      return new Uint8Array(await response.arrayBuffer());
    })).catch(error => {
      assets = undefined; // A failed asset fetch must be retryable.
      throw error;
    });
  }
  return assets;
}

export function fitCertificateName(name, font) {
  if (typeof name !== 'string' || !name.trim() || /[\r\n\t\p{Cc}]/u.test(name)) {
    throw new Error('Invalid certificate name');
  }
  // Match pdf-lib's actual glyph placement: glyph advances, without GPOS
  // kerning/offsets. Measure ink bounds (not just font-wide ascent/descent).
  const { glyphs } = font.layout(name, { ...fontFeatures });
  let advance = 0;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const glyph of glyphs) {
    if (!glyph.id) throw new Error('Unsupported certificate character');
    const box = glyph.bbox;
    if (box.maxX > box.minX && box.maxY > box.minY) {
      minX = Math.min(minX, advance + box.minX);
      maxX = Math.max(maxX, advance + box.maxX);
      minY = Math.min(minY, box.minY);
      maxY = Math.max(maxY, box.maxY);
    }
    advance += glyph.advanceWidth;
  }
  if (!Number.isFinite(minX) || maxX <= minX) throw new Error('Empty certificate name');
  // Double the original nominal size. Fit ink uniformly, including script
  // flourishes and accents, within the unchanged 77–101 mm name area.
  const size = Math.min(mm(22.6),
    mm(221) * font.unitsPerEm / (maxX - minX),
    mm(24) * font.unitsPerEm / (maxY - minY));
  const scale = size / font.unitsPerEm;
  // Retain the approved baseline where possible; move it only enough to
  // contain tall accents or deep script descenders.
  const y = Math.max(mm(109) - minY * scale,
    Math.min(mm(114), mm(133) - maxY * scale));
  return {
    size,
    x: mm(148.5) - (minX + maxX) * scale / 2,
    y,
    bounds: {
      left: mm(148.5) - (maxX - minX) * scale / 2,
      right: mm(148.5) + (maxX - minX) * scale / 2,
      bottom: y + minY * scale,
      top: y + maxY * scale,
    },
  };
}

export async function personaliseNiceListCertificate(name, suppliedAssets) {
  try {
    return await buildCertificate(name, suppliedAssets || await loadAssets());
  } catch (error) {
    // An HTTP 200 can still contain a corrupt PDF/font. Retry must refetch
    // those bytes too, not retain a permanently broken asset promise.
    assets = undefined;
    throw error;
  }
}

async function buildCertificate(name, [master, fontBytes]) {
  const metrics = fontkit.create(fontBytes);
  const fitted = fitCertificateName(name, metrics);
  const pdf = await PDFDocument.load(master, { updateMetadata: false });
  if (pdf.getPageCount() !== 1) throw new Error('Unexpected certificate master');
  const page = pdf.getPage(0);
  if (Math.abs(page.getWidth() - mm(297)) > .1 ||
      Math.abs(page.getHeight() - mm(210)) > .1) throw new Error('Unexpected certificate size');
  pdf.registerFontkit(fontkit);
  // Keep the supplied script font whole, including composite accented glyphs.
  const font = await pdf.embedFont(fontBytes, { subset: false, features: { ...fontFeatures } });
  page.drawText(name, {
    x: fitted.x, y: fitted.y, size: fitted.size, font,
    color: rgb(241 / 255, 217 / 255, 149 / 255),
  });
  addNiceStatus(pdf, page);
  // Keep the master's generic metadata; never set a recipient title/author.
  return new Blob([await pdf.save()], { type: 'application/pdf' });
}
