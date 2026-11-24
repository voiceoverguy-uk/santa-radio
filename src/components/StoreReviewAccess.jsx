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
        body: JSON.stringify({ action: 'review-login', username: data.get('username'), password: data.get('password') }),
      });
      const result = await response.json();
      if (!response.ok || result.success !== true) throw new Error('Review sign-in was not accepted. Check your details and try again.');
      form.reset();
      try { localStorage.removeItem('santa-message-allowance'); } catch { /* Server controls allowance. */ }
      grantAccess('Reviewer');
      onAccepted?.();
    } catch (failure) {
      setError(failure.name === 'AbortError' ? 'Sign-in took too long. Please try again.' : 'Review sign-in was not accepted. Check your details and try again.');
    } finally { clearTimeout(timeout); busy.current = false; setPending(false); }
  };
  return <details style={{ margin: '16px 0', maxWidth: '100%' }}>
    <summary>App store reviewer sign-in</summary>
    <form onSubmit={submit} style={{ display: 'grid', gap: 12, paddingTop: 12 }}>
      <p>Use the review credentials supplied in the app store console. This opens the regular free message maker without an email code.</p>
      <label htmlFor={`${id}-username`}>Review username</label>
      <input id={`${id}-username`} name="username" autoComplete="username" required maxLength={80} disabled={pending} style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', fontSize: 16 }} />
      <label htmlFor={`${id}-password`}>Review password</label>
      <input id={`${id}-password`} name="password" type="password" autoComplete="current-password" required maxLength={128} disabled={pending} style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', fontSize: 16 }} />
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign in for app review'}</button>
    </form>
  </details>;
}
