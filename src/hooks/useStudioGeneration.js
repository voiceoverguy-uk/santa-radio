import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { StudioVoucherContext } from '../lib/studioAccessContext.js';

export default function useStudioGeneration(onRestore) {
  const voucher = useContext(StudioVoucherContext);
  const [state, setState] = useState(null);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);
  const [accessExpired, setAccessExpired] = useState(false);
  const [retryable, setRetryable] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const attempts = useRef(0);
  const controllerRef = useRef(null);
  const restore = useRef(onRestore);
  restore.current = onRestore;
  const seen = useRef(-1);
  const alive = useRef(true);
  const latestRequest = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++latestRequest.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 10000);
    setChecking(true);
    setError('');
    setAccessExpired(false);
    let canRetry = true;
    try {
      const response = await fetch('/api/santa-studio-message', {
        credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!alive.current || request !== latestRequest.current) return null;
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          canRetry = false;
          setAccessExpired(true);
          throw new Error('Your Studio access needs checking. Reload Studio and enter your access code again.');
        }
        if (response.status === 429) {
          canRetry = false;
          throw new Error('Santa’s allowance checker is busy. Please wait a minute, then check again.');
        }
        throw new Error(voucher?.unlimited
          ? 'Your voucher is recognised, but Santa’s recording service is temporarily unavailable. Your unlimited-message access has not changed. Please try again.'
          : 'We can’t check how many messages you have left right now, so we can’t create your recording. Please try again.');
      }
      const data = await response.json();
      if (!Number.isInteger(data.successes) || data.successes < 0 || data.successes > 2
        || data.remaining !== 2 - data.successes) throw new Error('Your message allowance could not be checked.');
      if (!alive.current || request !== latestRequest.current || data.successes < seen.current) return null;
      if (data.successes > seen.current) {
        if (data.successes > 0) restore.current(data);
        seen.current = data.successes;
      }
      setState(data);
      setError('');
      setAccessExpired(false);
      setRetryable(false);
      attempts.current = 0;
      return data;
    } catch (failure) {
      if (alive.current && request === latestRequest.current) {
        setRetryable(canRetry);
        setError(failure.name === 'AbortError' || failure instanceof TypeError
          ? 'The allowance check could not connect. Please check your connection and try again.'
          : failure.message);
      }
      return null;
    } finally {
      clearTimeout(timeout);
      if (alive.current && request === latestRequest.current) setChecking(false);
    }
  }, [voucher?.unlimited]);
  useEffect(() => {
    alive.current = true;
    refresh();
    const visible = () => { if (!document.hidden) refresh(); };
    window.addEventListener('focus', visible);
    window.addEventListener('pageshow', visible);
    document.addEventListener('visibilitychange', visible);
    return () => {
      alive.current = false;
      controllerRef.current?.abort();
      window.removeEventListener('focus', visible);
      window.removeEventListener('pageshow', visible);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [refresh]);
  useEffect(() => {
    if (!error || !retryable || attempts.current >= 2) return;
    const timer = setTimeout(() => {
      attempts.current++;
      refresh();
    }, 2000 * (attempts.current + 1));
    return () => clearTimeout(timer);
  }, [error, retryable, refresh]);
  useEffect(() => {
    if (!state?.pending || checking) return;
    const timer = setInterval(refresh, 3000);
    return () => clearInterval(timer);
  }, [state?.pending, checking, refresh]);
  const startAnother = async () => {
    latestRequest.current++;
    controllerRef.current?.abort();
    setChecking(true);
    setError('');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch('/api/santa-workshop-access', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ another: true }), signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok || data.authorized !== true) throw new Error(data.error || 'Another test message could not be started.');
      seen.current = -1;
      setState(null);
      setEpoch(value => value + 1);
      const next = await refresh();
      return next?.successes === 0;
    } catch (failure) {
      setError(failure.name === 'AbortError' ? 'Starting another test message took too long. Please try again.' : failure.message);
      return false;
    } finally {
      clearTimeout(timeout);
      setChecking(false);
    }
  };
  return { state, epoch, error, checking, accessExpired, refresh, startAnother };
}
