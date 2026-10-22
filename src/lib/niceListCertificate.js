// Loaded only on a certificate click. No recipient data leaves this module.
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

export const CERTIFICATE_MASTER = '/certificates/nice-list/master.pdf';
export const CERTIFICATE_FONT = '/certificates/nice-list/CertificateSerif.ttf';
const mm = value => value * 72 / 25.4;
let assets;

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
  const { glyphs } = font.layout(name);
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
  // Baseline is 96 mm from the top, within the 77–101 mm safe area.
  const size = Math.min(mm(11.3),
    mm(221) * font.unitsPerEm / (maxX - minX),
    maxY > 0 ? mm(19) * font.unitsPerEm / maxY : Infinity,
    minY < 0 ? mm(5) * font.unitsPerEm / -minY : Infinity);
  const scale = size / font.unitsPerEm;
  return {
    size,
    x: mm(148.5) - (minX + maxX) * scale / 2,
    y: mm(210 - 96),
    bounds: {
      left: mm(148.5) - (maxX - minX) * scale / 2,
      right: mm(148.5) + (maxX - minX) * scale / 2,
      bottom: mm(210 - 96) + minY * scale,
      top: mm(210 - 96) + maxY * scale,
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
  // This supplied static instance has composite glyphs that fontkit's subset
  // writer does not preserve reliably. Embed it whole so every letter renders.
  const font = await pdf.embedFont(fontBytes, { subset: false });
  page.drawText(name, {
    x: fitted.x, y: fitted.y, size: fitted.size, font,
    color: rgb(241 / 255, 217 / 255, 149 / 255),
  });
  // Keep the master's generic metadata; never set a recipient title/author.
  return new Blob([await pdf.save()], { type: 'application/pdf' });
}
