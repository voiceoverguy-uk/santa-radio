import { createContext, useContext, useState } from 'react';
import { MESSAGE_ACCESS_KEY } from '../lib/santaMessageAccess.js';

const MessageAccessContext = createContext(null);

// A signup-first convenience gate, not authentication or email verification.
export function SantaMessageAccessProvider({ children }) {
  const [hasAccess, setHasAccess] = useState(() => {
    try { return sessionStorage.getItem(MESSAGE_ACCESS_KEY) === 'granted'; }
    catch { return false; }
  });
  const [sessionRemembered, setSessionRemembered] = useState(true);
  const grantAccess = () => {
    try { sessionStorage.setItem(MESSAGE_ACCESS_KEY, 'granted'); }
    catch { setSessionRemembered(false); }
    setHasAccess(true);
  };
  return <MessageAccessContext.Provider value={{ hasAccess, grantAccess, sessionRemembered }}>
    {children}
  </MessageAccessContext.Provider>;
}

export function useSantaMessageAccess() {
  const access = useContext(MessageAccessContext);
  if (!access) throw new Error('Santa message access provider is missing.');
  return access;
}
