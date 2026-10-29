import { createContext, useContext } from 'react';

// Keep identity independent of the provider's hot-reloaded implementation.
// Cached SSR consumers and a re-evaluated provider must share this same object.
export const RadioContext = createContext(null);

export function useRadio() {
  const radio = useContext(RadioContext);
  if (radio === null) throw new Error('useRadio must be used within RadioProvider');
  return radio;
}
