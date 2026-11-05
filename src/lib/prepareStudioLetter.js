import { PDFDocument } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { LETTER_SERIF, layoutStudioLetter } from './studioGiftExports.js';
import { LETTER_WIDTH, LETTER_HEIGHT, studioLetterLayout, fitStudioLetterLines } from './studioLetterLayout.js';

let fontPromise;
function pdfFont() {
  if (!fontPromise) fontPromise = (async () => {
    const response = await fetch(LETTER_SERIF, { credentials: 'omit' });
    if (!response.ok) throw new Error('Letter font unavailable');
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    return pdf.embedFont(await response.arrayBuffer(), {
      subset: false, features: { calt: false, liga: false, clig: false },
    });
  })().catch(error => { fontPromise = null; throw error; });
  return fontPromise;
}

// The visible sheet uses this exact, canonical HTML coordinate system inside an
// SVG viewport. Resizing scales it; it never causes another browser line wrap.
export function measureBrowserLetter(letter) {
  const sheet = document.createElement('div');
  sheet.className = 'studio-letter__paper';
  sheet.style.cssText = `position:fixed;left:-10000px;top:0;width:${LETTER_WIDTH}px;height:${LETTER_HEIGHT}px;visibility:hidden;pointer-events:none`;
  const text = document.createElement('div');
  text.className = 'studio-letter__text';
  text.style.fontSize = `${LETTER_WIDTH * studioLetterLayout.body}px`;
  text.style.lineHeight = String(studioLetterLayout.leading);
  sheet.append(text);
  const add = (value, parent) => {
    const p = document.createElement('p');
    p.textContent = value;
    parent.append(p);
    return p;
  };
  const paragraphs = letter.paragraphs.map(value => add(value, text));
  const closing = document.createElement('div');
  closing.className = 'studio-letter__closing';
  text.append(closing);
  paragraphs.push(...letter.closing.map(value => add(value, closing)));
  document.body.append(sheet);
  try {
    const size = LETTER_WIDTH * studioLetterLayout.body;
    const lines = paragraphs.reduce((sum, p) =>
      sum + Math.round(p.getBoundingClientRect().height / (size * studioLetterLayout.leading)), 0);
    return fitStudioLetterLines(lines, paragraphs.length);
  } finally { sheet.remove(); }
}

export async function prepareStudioLetter(letter) {
  if (letter.browserLayout) return letter;
  // Explicit loads also cover an initially offscreen letter; fonts.ready alone
  // does not request a font that has not yet been used.
  await Promise.all([
    document.fonts.load(`13.4px Georgia`, letter.paragraphs.join(' ')),
    document.fonts.load(`28.6px "Great Vibes"`, 'Santa Claus'),
    document.fonts.ready,
  ]);
  const font = await pdfFont();
  let lastError;
  const alternatives = [letter.paragraphs];
  if (letter.compactParagraphs) alternatives.push(letter.compactParagraphs);
  for (const [index, paragraphs] of alternatives.entries()) {
    const candidate = { ...letter, paragraphs };
    try {
      // A single wording decision must satisfy BOTH actual fonts before any
      // animation, enlargement, accessible copy or download can use it.
      layoutStudioLetter(candidate, font);
      return { ...candidate, compact: index > 0, browserLayout: measureBrowserLetter(candidate) };
    } catch (error) { lastError = error; }
  }
  throw lastError;
}
