import { useEffect, useId, useRef, useState } from 'react';
import './WorkshopSpellingSuggestion.css';
import { normaliseRequestedName } from '../lib/santaNameRequests.js';

const REQUEST_TIMEOUT_MS = 20000;

export default function WorkshopSpellingSuggestion({ name, recordingId, recordedName }) {
  const instanceId = useId();
  const pairKey = JSON.stringify([name, recordingId]);
  const pairKeyRef = useRef(pairKey);
  pairKeyRef.current = pairKey;
  const requestIds = useRef(new Map());
  const inFlight = useRef(new Map());
  const mounted = useRef(false);
  const [pairStatuses, setPairStatuses] = useState({});
  const status = pairStatuses[pairKey] || { state: 'idle', message: '' };

  const setPairStatus = (key, nextStatus) => {
    setPairStatuses(current => ({ ...current, [key]: nextStatus }));
  };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      inFlight.current.forEach(controller => controller.abort());
    };
  }, []);

  useEffect(() => () => {
    inFlight.current.get(pairKey)?.abort();
  }, [pairKey]);

  const sendSuggestion = async () => {
    if (status.state === 'pending' || status.state === 'success' || inFlight.current.has(pairKey)) return;
    const requested = normaliseRequestedName(name);
    if (!requested || recordingId == null || String(recordingId).trim() === '') {
      setPairStatus(pairKey, {
        state: 'error',
        message: 'This spelling cannot be sent until a recorded name has been selected.',
      });
      return;
    }

    let requestId;
    try {
      requestId = requestIds.current.get(pairKey);
      if (!requestId) {
        requestId = window.crypto.randomUUID();
        requestIds.current.set(pairKey, requestId);
      }
    } catch {
      setPairStatus(pairKey, {
        state: 'error',
        message: 'This browser could not prepare a safe request. Please try again in a supported browser.',
      });
      return;
    }

    const controller = new AbortController();
    inFlight.current.set(pairKey, controller);
    setPairStatus(pairKey, { state: 'pending', message: '' });
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch('/api/name-requests', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: requested.name, recordingId, requestId }),
        signal: controller.signal,
      });
      let result;
      try {
        result = await response.json();
      } catch {
        if (response.status === 429) {
          throw new Error('Santa’s list is busy right now. Please wait a moment and retry; this spelling was not confirmed.');
        }
        if (!response.ok) {
          throw new Error(`Santa’s list could not confirm this request (status ${response.status}). Please retry.`);
        }
        throw new Error('Santa’s list returned an unreadable reply. Please retry safely.');
      }

      if (!response.ok) {
        const message = response.status === 429
          ? 'Santa’s list is busy right now. Please wait a moment and retry; this spelling was not confirmed.'
          : typeof result?.error === 'string' && result.error.trim()
            ? `${result.error.trim()} Please retry if you still want to send it.`
            : `Santa’s list could not confirm this request (status ${response.status}). Please retry.`;
        throw new Error(message);
      }
      if (!result || result.saved !== true || normaliseRequestedName(result.name)?.key !== requested.key) {
        throw new Error('Santa’s list did not confirm that this spelling was saved. Please retry.');
      }

      if (!mounted.current) return;
      if (pairKeyRef.current !== pairKey) {
        setPairStatus(pairKey, {
          state: 'error',
          message: 'The selected spelling or recording changed before confirmation. Retry this pair if you still want to send it.',
        });
        return;
      }
      setPairStatus(pairKey, {
        state: 'success',
        message: result.duplicate === true
          ? 'This spelling and recording are already on Santa’s list. No duplicate request was added.'
          : 'Sent for Santa’s team to review. This is a suggestion, not a promise of a new recording.',
      });
    } catch (error) {
      if (!mounted.current) return;
      setPairStatus(pairKey, {
        state: 'error',
        message: timedOut
          ? 'The request timed out before Santa’s list confirmed it. It may have arrived; retry safely with the same request ID.'
          : error.name === 'AbortError'
            ? 'The request was interrupted before confirmation. Retry safely with the same request ID.'
            : error instanceof Error
              ? error.message
              : 'Santa’s list could not confirm this request. Please retry.',
      });
    } finally {
      window.clearTimeout(timeout);
      if (inFlight.current.get(pairKey) === controller) inFlight.current.delete(pairKey);
    }
  };

  const isPending = status.state === 'pending';
  const isSuccess = status.state === 'success';

  return (
    <section className="smw-spelling-suggestion" aria-labelledby={`${instanceId}-heading`}>
      <h3 className="smw-spelling-suggestion-heading" id={`${instanceId}-heading`}>
        Optional: suggest this spelling
      </h3>
      <p className="smw-spelling-suggestion-disclosure" id={`${instanceId}-disclosure`}>
        Only if you send it, we save this written spelling and selected recording in Santa’s private
        request list, with dates and counts, for the team to review. No email address or other message
        choices are included. There is no guarantee a new recording will be made.
        Changing the spelling above never sends anything. <a href="/privacy-policy">Privacy details</a>.
      </p>
      <p className="smw-spelling-suggestion-pair">
        <span>Written spelling</span> <strong>{name}</strong>
        <span>Selected recording</span> <strong>{recordedName}</strong>
      </p>
      <button
        className="smw-spelling-suggestion-button"
        type="button"
        onClick={sendSuggestion}
        disabled={isPending || isSuccess}
        aria-describedby={`${instanceId}-disclosure`}
        aria-busy={isPending}
      >
        {isPending
          ? 'Sending spelling…'
          : isSuccess
            ? status.message.startsWith('This spelling and recording are already')
              ? 'Already on Santa’s list'
              : 'Sent to Santa’s list'
            : status.state === 'error'
              ? 'Retry sending this spelling'
              : 'Send this spelling to Santa’s list'}
      </button>
      {status.message && (
        <p
          className={`smw-spelling-suggestion-status${status.state === 'error' ? ' is-error' : ''}`}
          role={status.state === 'error' ? 'alert' : 'status'}
          aria-live={status.state === 'error' ? 'assertive' : 'polite'}
        >
          {status.message}
        </p>
      )}
    </section>
  );
}
