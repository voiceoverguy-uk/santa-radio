import { useSyncExternalStore } from 'react';

// Deliberate selections live only in this open tab, including SPA navigation.
// A full reload clears them. Never persist child names or derive them from input.
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
  listeners.forEach(listener => listener());
}

export default function useSantaRecipient() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
