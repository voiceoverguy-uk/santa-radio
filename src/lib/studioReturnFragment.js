let captured = null;

// Called before React/analytics starts, and again on Studio entry. Fragments
// are not sent to the server, but third-party page-view scripts can read them.
export function captureStudioReturnFragment() {
  if (typeof window === 'undefined' || !window.location.hash.startsWith('#studio-return=')) return;
  const value = window.location.hash.slice('#studio-return='.length);
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`);
  captured = { valid: /^[A-Za-z0-9_-]{43}$/.test(value), value };
}

export function takeStudioReturnFragment() {
  captureStudioReturnFragment();
  const result = captured;
  captured = null;
  return result;
}
