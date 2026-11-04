import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { takeStudioReturnFragment } from '../lib/studioReturnFragment.js';

// Tokens stay in memory. Email-link scanners cannot redeem on a GET: the
// visitor explicitly chooses Open my Studio before the protected POST.
export default function StudioReturnAccess() {
  const id = useId(), navigate = useNavigate(), request = useRef(null);
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    const fragment = takeStudioReturnFragment();
    if (fragment) {
      if (fragment.valid) setToken(fragment.value);
      else setError('This private link is invalid. Request a fresh link using your purchase email.');
    }
    return () => request.current?.abort();
  }, []);
  const submit = async event => {
    event.preventDefault();
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/santa-studio-return', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(token ? { token } : { email: email.trim() }), signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 410) setToken('');
        throw new Error(data.error || 'Return access is temporarily unavailable.');
      }
      if (data.authorized === true) {
        setToken('');
        window.dispatchEvent(new CustomEvent('santa-workshop-access-change'));
        navigate('/santa-message-workshop', { replace: true });
      } else if (data.requested === true) {
        setMessage(data.message);
        setEmail('');
      } else throw new Error('Return access could not be confirmed.');
    } catch (failure) {
      setError(controller.signal.aborted ? 'The request took too long. Please try again.' : failure.message);
    } finally {
      window.clearTimeout(timeout);
      if (request.current === controller) request.current = null;
      setBusy(false);
    }
  };
  return <section aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`}>Already purchased?</h2>
    <form className="workshop-password-form" onSubmit={submit}>
      {token ? <p>Use your private, single-use email link to reopen your paid Studio.</p> : <>
        <label htmlFor={`${id}-email`}>Purchase email address</label>
        <input id={`${id}-email`} type="email" autoComplete="email" required maxLength={254}
          value={email} disabled={busy} onChange={event => setEmail(event.target.value)} />
      </>}
      <button type="submit" disabled={busy}>{busy ? 'Please wait…' : token ? 'Open my Studio' : 'Email a fresh access link'}</button>
      {token && <button type="button" disabled={busy} onClick={() => setToken('')}>Request a fresh link instead</button>}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </form>
    <p>Your £6.50 purchase includes two successful creations. Returning keeps your remaining allowance; it does not restore recordings. Download your MP3 and gifts before leaving Studio.</p>
  </section>;
}
