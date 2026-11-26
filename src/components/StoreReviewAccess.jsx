import { useId, useRef, useState } from 'react';
import { useSantaMessageAccess } from './SantaMessageAccessProvider.jsx';

export default function StoreReviewAccess({ onAccepted }) {
  const id = useId();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const { grantAccess } = useSantaMessageAccess();
  const submit = async event => {
    event.preventDefault();
    if (busy.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    busy.current = true; setPending(true); setError('');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch('/api/santa-message-access', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'error',
        headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ action: 'review-login', username: 'play-review', password: String(data.get('accessCode') || '').trim() }),
      });
      const result = await response.json();
      if (!response.ok || result.success !== true) throw new Error('That access code was not accepted. Check your code and try again.');
      form.reset();
      try { localStorage.removeItem('santa-message-allowance'); } catch { /* Server controls allowance. */ }
      grantAccess('Guest');
      onAccepted?.();
    } catch (failure) {
      setError(failure.name === 'AbortError' ? 'Sign-in took too long. Please try again.' : 'That access code was not accepted. Check your code and try again.');
    } finally { clearTimeout(timeout); busy.current = false; setPending(false); }
  };
  return <details style={{ margin: '16px 0', maxWidth: '100%' }}>
    <summary>Have an access code?</summary>
    <form onSubmit={submit} style={{ display: 'grid', gap: 12, paddingTop: 12 }}>
      <p>Enter your access code to open the free message maker.</p>
      <label htmlFor={`${id}-access-code`}>Access code</label>
      <input id={`${id}-access-code`} name="accessCode" type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} required maxLength={128} disabled={pending} style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', fontSize: 16 }} />
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={pending}>{pending ? 'Signing in…' : 'Continue with code'}</button>
    </form>
  </details>;
}
