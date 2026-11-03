// Separate roles: changing recipient lettering must never alter Santa's signature.
export const RECIPIENT_FONT = '/certificates/nice-list/Lora-Italic.ttf';
export const SIGNATURE_FONT = '/certificates/nice-list/GreatVibes-Regular.ttf';
export const recipientCanvasFont = size => `italic 400 ${size}px "Lora"`;
export const RECIPIENT_FONT_READY = 'studio-recipient-font-ready';
// Canonically equivalent glyphs keep decomposed accents over the right letter.
// PDF ActualText separately preserves the exact original Unicode spelling.
export const recipientDisplayName = name => name.normalize('NFC');
// Use individual glyphs in PDFs: ligature substitutions can corrupt ToUnicode.
export const recipientFontFeatures = { calt: false, liga: false, clig: false, ccmp: false };

let recipientFont;
export async function loadRecipientFont(suppliedBytes) {
  if (!recipientFont) {
    recipientFont = (async () => {
      let data = suppliedBytes;
      if (!data) {
        const response = await fetch(RECIPIENT_FONT, { credentials: 'omit' });
        if (!response.ok) throw new Error('Recipient font unavailable');
        data = await response.arrayBuffer();
      }
      const face = await new FontFace('Lora', data, { style: 'italic', weight: '400',
        featureSettings: '"calt" 0, "liga" 0, "clig" 0, "ccmp" 0' }).load();
      document.fonts.add(face);
      window.dispatchEvent(new Event(RECIPIENT_FONT_READY));
      return face;
    })().catch(error => { recipientFont = undefined; throw error; });
  }
  return recipientFont;
}
