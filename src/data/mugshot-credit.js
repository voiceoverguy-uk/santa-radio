// Correct only the observed Bruce Davis variants. Do not guess photographers
// from missing credits, social handles or the standalone "Celebrity Stalker".
export function normalizePhotoCredit(credit) {
  if (typeof credit !== 'string') return '';
  const name = credit.trim().replace(/^(?:photo(?:\s+credit)?\s*:\s*)+/i, '').trim();
  const isBruce = /^br(?:u)?ce\s+davis(?:\s+e)?(?:\s*[-–—]\s*celebrity stalker)?$/i.test(name);
  return isBruce ? 'Bruce Davis' : credit;
}
