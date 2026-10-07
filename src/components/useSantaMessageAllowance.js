import { useSyncExternalStore } from 'react';
import { createMessageAllowance } from '../lib/santaMessageAllowance.js';

let allowance;
export default function useSantaMessageAllowance() {
  allowance ||= createMessageAllowance(window);
  const state = useSyncExternalStore(allowance.subscribe, allowance.getSnapshot);
  return { ...state, create: allowance.create };
}
