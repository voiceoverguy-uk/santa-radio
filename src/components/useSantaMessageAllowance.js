import { useSyncExternalStore } from 'react';
import { createMessageAllowance } from '../lib/santaMessageAllowance.js';

let allowance;
export default function useSantaMessageAllowance() {
  const store = typeof window === 'undefined'
    ? createMessageAllowance(undefined)
    : (allowance ||= createMessageAllowance(window));
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return { ...state, create: store.create };
}
