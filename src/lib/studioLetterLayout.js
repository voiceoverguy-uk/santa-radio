// Shared print coordinates: previews scale these with the sheet, never the UI.
// Keep the closing line box above the letterhead's lower ornaments (85.3% of A4).
// Glyph ink is checked separately against the artwork's 85% safe edge.
export const studioLetterLayout = Object.freeze({
  body: .0225,
  leading: 1.15,
  paragraphGap: .12,
  maxLeading: 1.65,
  maxParagraphGap: .8,
  inset: .06,
  closingInset: .1,
  top: .24,
  bottom: .853,
  signature: .048,
  pdfSignatureClearance: 8,
});

export const LETTER_WIDTH = 595.2756;
export const LETTER_HEIGHT = 841.8898;

// Leave a little clearance for glyph descenders and fractional renderer rounding.
// Spend spare space on both leading and paragraph rhythm, with capped gaps.
export function fitStudioLetterLines(lines, paragraphs, bottom = studioLetterLayout.bottom,
  signatureClearance = 0) {
  if (!Number.isSafeInteger(lines) || !Number.isSafeInteger(paragraphs) || lines < 1 || paragraphs < 1) {
    throw new Error('Cannot fit an incomplete letter layout');
  }
  if (!Number.isFinite(bottom) || bottom <= studioLetterLayout.top || bottom > 1 ||
    !Number.isFinite(signatureClearance) || signatureClearance < 0) {
    throw new Error('Cannot fit an invalid letter boundary');
  }
  const type = studioLetterLayout;
  const size = LETTER_WIDTH * type.body;
  const signatureHeight = LETTER_WIDTH * type.signature * 1.5 + signatureClearance;
  const available = LETTER_HEIGHT * (bottom - type.top) - 3;
  const height = (leading, gap) => lines * size * leading + paragraphs * size * gap + signatureHeight;
  const minimum = height(type.leading, type.paragraphGap);
  if (minimum > available) {
    throw new Error(`The complete letter cannot fit readably on one page (${minimum.toFixed(1)}pt required; ${available.toFixed(1)}pt available)`);
  }
  const maximum = height(type.maxLeading, type.maxParagraphGap);
  const fraction = Math.min(1, (available - minimum) / (maximum - minimum));
  const leading = type.leading + fraction * (type.maxLeading - type.leading);
  const paragraphGap = type.paragraphGap + fraction * (type.maxParagraphGap - type.paragraphGap);
  return { leading, paragraphGap, contentHeight: height(leading, paragraphGap) };
}
