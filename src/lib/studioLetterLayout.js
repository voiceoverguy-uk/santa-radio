// Shared print coordinates: previews scale these with the sheet, never the UI.
// Keep the full letter above the letterhead's lower ornaments (88% of A4).
export const studioLetterLayout = Object.freeze({
  body: .0225,
  leading: 1.17,
  paragraphGap: .1,
  inset: .06,
  closingInset: .1,
  top: .24,
  bottom: .88,
  signature: .048,
});
