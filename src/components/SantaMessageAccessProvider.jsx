import { createContext, useContext, useEffect, useState } from 'react';
import { MESSAGE_ACCESS_KEY } from '../lib/santaMessageAccess.js';

const MessageAccessContext = createContext(null);

// The browser flag is presentation only; the server verifies its own HttpOnly
// email-verified grant and allowance. Older unverified grants are rejected.
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
  const [marketingStatus, setMarketingStatus] = useState('');
  const revokeAccess = () => {
    setHasAccess(false);
    try { sessionStorage.removeItem(MESSAGE_ACCESS_KEY); } catch { /* Not an authority. */ }
  };
  const grantAccess = (firstName, status = '') => {
    setMarketingStatus(status);
    setGreetingName(typeof firstName === 'string' ? firstName.trim() : '');
    try { sessionStorage.setItem(MESSAGE_ACCESS_KEY, 'granted'); }
    catch { setSessionRemembered(false); }
    setHasAccess(true);
  };
  return <MessageAccessContext.Provider value={{ hasAccess, grantAccess, revokeAccess, greetingName, sessionRemembered }}>
    {marketingStatus === 'suppressed' && <p role="status" style={{ padding: '12px', textAlign: 'center' }}>Your free message is unlocked. Your existing email opt-out has been kept, so you have not been subscribed to Santa Radio news.</p>}
    {children}
  </MessageAccessContext.Provider>;
}

export function useSantaMessageAccess() {
  const access = useContext(MessageAccessContext);
  if (!access) throw new Error('Santa message access provider is missing.');
  return access;
}
