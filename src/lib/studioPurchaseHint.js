// Presentation only: Studio and checkout always verify the server-side purchase.
// Cached remaining count is display-only; no token or personal details are stored.
const key = 'santa-studio-paid-hint-v1';
const countKey = 'santa-studio-remaining-hint-v1';
export function studioRemainingHint() {
  try { const value = localStorage.getItem(countKey); return value === '1' || value === '2' ? Number(value) : null; }
  catch { return null; }
}
export function hasStudioPurchaseHint() {
  try { return typeof window !== 'undefined' && localStorage.getItem(key) === '1'; }
  catch { return false; }
}
export function rememberStudioPurchase(paid, remaining) {
  try {
    if (paid && remaining !== 0) {
      localStorage.setItem(key, '1');
      if (remaining === 1 || remaining === 2) localStorage.setItem(countKey, String(remaining));
    } else { localStorage.removeItem(key); localStorage.removeItem(countKey); }
  }
  catch { /* Storage may be unavailable in private browsing. */ }
}
