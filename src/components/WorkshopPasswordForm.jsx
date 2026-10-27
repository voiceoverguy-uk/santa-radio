import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './WorkshopPasswordForm.css';

const ACCESS_URL = '/api/santa-workshop-access';
const WORKSHOP_PATH = '/santa-message-workshop';
const REQUEST_TIMEOUT = 15000;

export function WorkshopPasswordForm({ onAuthorized, compact = false, active = true, requestControlRef }) {
  const inputId = useId();
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const requestRef = useRef(null);

  useEffect(() => () => requestRef.current?.abort(), []);
  useEffect(() => {
    if (active) return;
    requestRef.current?.abort();
    requestRef.current = null;
    setPending(false);
    setPassword('');
    setError('');
  }, [active]);

  const submit = async event => {
    event.preventDefault();
    if (requestRef.current || pending || !password) return;
    const controller = new AbortController();
    requestRef.current = controller;
    if (requestControlRef) requestControlRef.current = controller;
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT);
    setPending(true);
    setError('');
    try {
      const response = await fetch(ACCESS_URL, {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (controller.signal.aborted) return;
      if (!response.ok || data.authorized !== true) {
        throw new Error(data.error || 'That password was not accepted. Please try again.');
      }
      setPassword('');
      onAuthorized();
    } catch (requestError) {
      if (requestRef.current !== controller || requestError.name === 'AbortError') {
        if (timedOut && requestRef.current === controller) {
          setError('That took too long. Please try again.');
        }
      } else {
        setError(requestError.message || 'The workshop could not be reached. Please try again.');
      }
    } finally {
      window.clearTimeout(timeout);
      if (requestRef.current === controller) {
        requestRef.current = null;
        if (requestControlRef?.current === controller) requestControlRef.current = null;
        setPending(false);
      }
    }
  };

  return <form className={`workshop-password-form${compact ? ' workshop-password-form--compact' : ''}`} onSubmit={submit}>
    <label htmlFor={inputId}>Workshop password</label>
    <input
      id={inputId}
      type="password"
      value={password}
      onChange={event => { setPassword(event.target.value); setError(''); }}
      autoComplete="current-password"
      required
      maxLength={1024}
      disabled={pending}
      aria-invalid={!!error}
      aria-describedby={error ? `${inputId}-error` : undefined}
    />
    {error && <p className="workshop-password-error" id={`${inputId}-error`} role="alert">{error}</p>}
    <button type="submit" disabled={pending || !password}>
      {pending ? 'Checking…' : 'Enter workshop'}
    </button>
  </form>;
}

export default function WorkshopPasswordDialog({ open, onClose }) {
  const dialogRef = useRef(null);
  const requestControlRef = useRef(null);
  const returnFocusRef = useRef(null);
  const navigate = useNavigate();

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    if (open && !dialog.open) {
      returnFocusRef.current = document.activeElement;
      dialog.showModal();
      dialog.querySelector('input')?.focus();
    }
    if (!open && dialog.open) dialog.close();
    return undefined;
  }, [open]);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) return undefined;
    const viewport = window.visualViewport;
    const syncViewport = () => {
      dialog.style.setProperty('--workshop-viewport-height', `${viewport?.height || window.innerHeight}px`);
      dialog.style.setProperty('--workshop-viewport-top', `${viewport?.offsetTop || 0}px`);
    };
    syncViewport();
    viewport?.addEventListener('resize', syncViewport);
    viewport?.addEventListener('scroll', syncViewport);
    window.addEventListener('resize', syncViewport);
    return () => {
      viewport?.removeEventListener('resize', syncViewport);
      viewport?.removeEventListener('scroll', syncViewport);
      window.removeEventListener('resize', syncViewport);
    };
  }, [open]);

  useEffect(() => () => {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    requestControlRef.current?.abort();
  }, []);

  const close = () => {
    requestControlRef.current?.abort();
    requestControlRef.current = null;
    if (dialogRef.current?.open) dialogRef.current.close();
    onClose();
    returnFocusRef.current?.focus?.({ preventScroll: true });
  };

  const containFocus = event => {
    if (event.key !== 'Tab') return;
    const controls = [...dialogRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled)')];
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  const authorized = () => {
    close();
    navigate(WORKSHOP_PATH);
  };

  return <dialog
    ref={dialogRef}
    className="workshop-password-dialog"
    aria-labelledby="workshop-password-title"
    aria-describedby="workshop-password-description"
    onKeyDown={containFocus}
    onCancel={event => { event.preventDefault(); close(); }}
  >
    <div className="workshop-dialog-heading">
      <p className="workshop-dialog-kicker">A private North Pole room</p>
      <button type="button" className="workshop-dialog-close" aria-label="Close workshop access" onClick={close}>×</button>
    </div>
    <h2 id="workshop-password-title">Santa’s message workshop</h2>
    <p id="workshop-password-description">Enter the workshop password to continue.</p>
    <WorkshopPasswordForm active={open} onAuthorized={authorized} requestControlRef={requestControlRef} />
  </dialog>;
}
