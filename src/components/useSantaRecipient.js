import { useSyncExternalStore } from 'react';

// Deliberate selections live only in this open tab, including SPA navigation.
// A short-lived same-tab handoff supports the separate gift preview page.
let recipient = null;
const listeners = new Set();
const snapshot = () => recipient;
const serverSnapshot = () => null;
const subscribe = listener => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function selectSantaRecipient(name) {
  if (typeof name !== 'string' || !name.trim() || name === recipient) return;
  recipient = name;
  try { sessionStorage.setItem("santa-preview-recipient", JSON.stringify({ name, at: Date.now() })); } catch { /* Optional preview handoff. */ }
  listeners.forEach(listener => listener());
}

export default function useSantaRecipient() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
