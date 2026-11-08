// A one-visit handoff, separate from the recipient used by Studio gift previews.
// Never put child names in history state, URLs or browser storage.
let pendingName = '';

export function offerFreeSantaMessageName(name) {
  pendingName = typeof name === 'string' ? name : '';
}

export function peekFreeSantaMessageName() {
  return pendingName;
}

export function clearFreeSantaMessageName() {
  pendingName = '';
}
