import { createContext, useContext, useEffect, useState } from 'react';
import { MESSAGE_ACCESS_KEY } from '../lib/santaMessageAccess.js';

const MessageAccessContext = createContext(null);

// The browser flag is presentation only; the server verifies its own HttpOnly
// signup grant and allowance. This still does not verify email ownership.
export function SantaMessageAccessProvider({ children }) {
  const [hasAccess, setHasAccess] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/santa-message-access', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(response => response.ok ? response.json() : null).then(data => {
        if (!controller.signal.aborted && data?.authorized === true) {
          if (data.availableAt > Date.now()) {
            try { localStorage.setItem('santa-message-allowance', JSON.stringify({
              used: 1, availableAt: data.availableAt, cooldownMs: 2 * 3600000,
            })); } catch { /* Server enforcement is independent of browser storage. */ }
          }
          setHasAccess(true);
        }
      }).catch(() => {});
    return () => controller.abort();
  }, []);
  const [sessionRemembered, setSessionRemembered] = useState(true);
  const [greetingName, setGreetingName] = useState('');
  const revokeAccess = () => {
    setHasAccess(false);
    try { sessionStorage.removeItem(MESSAGE_ACCESS_KEY); } catch { /* Not an authority. */ }
  };
  const grantAccess = firstName => {
    setGreetingName(typeof firstName === 'string' ? firstName.trim() : '');
    try { sessionStorage.setItem(MESSAGE_ACCESS_KEY, 'granted'); }
    catch { setSessionRemembered(false); }
    setHasAccess(true);
  };
  return <MessageAccessContext.Provider value={{ hasAccess, grantAccess, revokeAccess, greetingName, sessionRemembered }}>
    {children}
  </MessageAccessContext.Provider>;
}

export function useSantaMessageAccess() {
  const access = useContext(MessageAccessContext);
  if (!access) throw new Error('Santa message access provider is missing.');
  return access;
}
