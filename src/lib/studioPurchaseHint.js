// Presentation only: Studio and checkout always verify the server-side purchase.
// No token, personal details or allowance is stored here.
const key = 'santa-studio-paid-hint-v1';
export function hasStudioPurchaseHint() {
  try { return typeof window !== 'undefined' && localStorage.getItem(key) === '1'; }
  catch { return false; }
}
export function rememberStudioPurchase(paid) {
  try { if (paid) localStorage.setItem(key, '1'); else localStorage.removeItem(key); }
  catch { /* Storage may be unavailable in private browsing. */ }
}
