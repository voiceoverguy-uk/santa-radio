import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import MessageCreationIndicator from './MessageCreationIndicator.jsx';
import StudioCompletedRecording from './StudioCompletedRecording.jsx';
import { StudioVoucherContext } from '../lib/studioAccessContext.js';
import { getWorkshopWrittenName } from '../lib/workshopNameSpelling.js';

const MAX_BYTES = 4_400_000;
const PREPARATION_MESSAGES = [
  'Santa is recording. Give him a moment — the elves keep distracting him.',
  'Santa is busy recording, although the smell of cookies isn’t helping. Hang on a moment…',
  'Santa is recording your message. An elf just sneezed halfway through, so we’re going again.',
  'Santa is at the microphone. We’re just waiting for Rudolph to stop chewing.',
  'Your message is coming. Santa said “ho ho ho” so loudly, his headphones fell off.',
  'Santa is recording. The elves have promised to be quiet. We’ll believe it when we hear it.',
  'One moment — Santa is finishing your message. Someone opened a biscuit tin and we lost him briefly.',
  'Santa is recording your message. Mrs Claus has reminded him this is not the time for a nap.',
  'Hang on a moment — Santa’s checking his lines. Twice, obviously.',
  'Santa is busy recording. We’ve hidden the mince pies until he’s finished.',
];

function trapDialogFocus(event) {
  if (event.key !== 'Tab') return;
  const controls = [...event.currentTarget.querySelectorAll('button:not(:disabled)')];
  const target = event.shiftKey ? controls.at(-1) : controls[0];
  if ((event.shiftKey && document.activeElement === controls[0])
    || (!event.shiftKey && document.activeElement === controls.at(-1))) {
    event.preventDefault();
    target?.focus();
  }
}

export default function WorkshopMessageAudio({
  record, choices, spelling, complete, generation, correction, tester = false, onCorrection, visible, onPhaseChange, onReady,
  showGiftDownloadHint = false, reviewMessageTarget = null, onStartAgain, showReadyAction = true,
  giftsRequested = false, giftExportPending = false, giftWrittenName, onBundlePreparing, onBundleRequested,
}) {
  const voucher = useContext(StudioVoucherContext);
  const requestRef = useRef(null);
  const urlRef = useRef(null);
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);
  const deliveryRef = useRef(null);
  const finishedRef = useRef(null);
  const deliveryScrollPending = useRef(false);
  const receivedSelection = useRef(null);
  const readyCallbackRef = useRef(onReady);
  const spellingRef = useRef(spelling);
  // Spelling can be corrected while bytes are arriving. It is display-only;
  // commit the latest spelling without restarting the audio request.
  readyCallbackRef.current = onReady;
  spellingRef.current = spelling;
  const [phase, setPhase] = useState('idle');
  const [url, setUrl] = useState('');
  const [results, setResults] = useState([]);
  const resultsRef = useRef([]);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState(false);
  const resetDialogRef = useRef(null);
  const operationRef = useRef(null);
  const [preparationMessage, setPreparationMessage] = useState('');
  const [creationAttempt, setCreationAttempt] = useState(0);
  const writtenName = getWorkshopWrittenName(record?.name || '', spelling);
  const finishedWrittenName = results.at(-1)?.writtenName || writtenName;
  const busy = phase === 'preparing' || phase === 'receiving';
  const showRecording = () => {
    const finished = finishedRef.current;
    const download = finished?.querySelector('.smw-download-actions');
    if (!finished || !download) return;
    // Focus without native scrolling (or the builder's keyboard-control
    // scrolling), then make one explicit move for the whole playable result.
    finished.focus({ preventScroll: true });
    const bounds = finished.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportTop = viewport?.offsetTop || 0;
    const header = document.querySelector('.navbar')?.getBoundingClientRect();
    const topEdge = Math.max(viewportTop, header?.bottom || 0) + 16;
    const safeBottom = parseFloat(getComputedStyle(finished).getPropertyValue('--smw-safe-bottom')) || 0;
    let bottomEdge = Math.min(window.innerHeight, viewportTop + (viewport?.height || window.innerHeight))
      - safeBottom - 16;
    const dock = document.querySelector('.radio-dock')?.getBoundingClientRect();
    // Studio normally hides the dock. Only reserve its actual visible bounds
    // when it overlaps this recording horizontally.
    if (dock?.height && dock.right > bounds.left && dock.left < bounds.right && dock.bottom > topEdge) {
      bottomEdge = Math.min(bottomEdge, dock.top - 16);
    }
    const requiredHeight = download.getBoundingClientRect().bottom - bounds.top;
    const destinationTop = Math.max(topEdge, bottomEdge - requiredHeight);
    window.scrollTo({
      top: Math.max(0, window.scrollY + bounds.top - destinationTop),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  };
  useEffect(() => {
    if (!deliveryScrollPending.current) return;
    deliveryScrollPending.current = false;
    const frame = requestAnimationFrame(() => {
      const delivery = deliveryRef.current;
      if (!delivery) return;
      delivery.focus({ preventScroll: true });
      const headerBottom = Math.max(0, document.querySelector('.navbar')?.getBoundingClientRect().bottom || 0);
      const top = delivery.getBoundingClientRect().top + window.scrollY - headerBottom - 16;
      window.scrollTo({ top: Math.max(0, top),
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    });
    return () => cancelAnimationFrame(frame);
  }, [creationAttempt]);
  const status = generation.state;
  const epoch = status?.accessEpoch || generation.epoch || 0;
  useEffect(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    receivedSelection.current = null;
  }, [epoch]);
  const limited = status?.limit === 2;
  const exhausted = limited && status.remaining === 0 && !generation.error && !generation.checking;
  const resetBlocked = !status || generation.checking || !!generation.error || exhausted || !!status?.pending;
  const disabled = !complete || busy || !status || !!generation.error || generation.checking || status?.pending || exhausted;
  // Share readiness only after the entire MP3 has been received, never merely
  // on a successful HTTP header or a promotional preview.
  useEffect(() => { onPhaseChange?.(error ? 'error' : phase); }, [phase, error, onPhaseChange]);

  const clearRecording = useCallback((resetUI = true) => {
    requestRef.current?.abort();
    requestRef.current = null;
    receivedSelection.current = null;
    document.dispatchEvent(new Event('studio-stop-audio'));
    for (const result of resultsRef.current) URL.revokeObjectURL(result.url);
    resultsRef.current = [];
    urlRef.current = null;
    if (resetUI) {
      setResults([]);
      setUrl('');
      setPhase('idle');
      setError('');
    }
  }, []);
  useEffect(() => {
    if (generation.accessExpired) clearRecording();
  }, [generation.accessExpired, clearRecording]);
  useEffect(() => {
    // pagehide also covers a page kept in the browser's back/forward cache.
    // Pausing alone would leave its generated Blob available on return.
    const leave = () => clearRecording();
    window.addEventListener('pagehide', leave);
    return () => {
      window.removeEventListener('pagehide', leave);
      clearRecording(false);
    };
  }, [clearRecording]);

  const receive = async (response, signal, submittedSelection) => {
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      if (response.status === 403) window.dispatchEvent(new Event('santa-workshop-access-change'));
      throw new Error(data.error || 'Santa could not prepare your message. Please try again.');
    }
    if (!/^audio\/mpeg(?:;|$)/i.test(response.headers.get('content-type') || '')
      || Number(response.headers.get('content-length')) > MAX_BYTES || !response.body) {
      throw new Error('The message service did not return a valid MP3. Please try again.');
    }
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > MAX_BYTES) throw new Error('The recording was too large. Please try again.');
        chunks.push(value);
      }
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    if (!size) throw new Error('The recording was empty. Please try again.');
    signal.throwIfAborted();
    receivedSelection.current = null;
    const selectionHeader = response.headers.get('x-studio-selection');
    if (selectionHeader) {
      const selection = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(selectionHeader), char => char.charCodeAt(0))));
      if (!selection || typeof selection.record?.id !== 'string' || typeof selection.record?.name !== 'string'
        || selection.choices?.name !== selection.record.id) {
        throw new Error('The recording details could not be verified. Please create it again.');
      }
      receivedSelection.current = selection;
    }
    const completed = receivedSelection.current || submittedSelection;
    const completedSpelling = completed.record.id === record?.id ? spellingRef.current : '';
    const audioBlob = new Blob(chunks, { type: 'audio/mpeg' });
    const objectUrl = URL.createObjectURL(audioBlob);
    // Ordinary unlimited-voucher regeneration replaces only the current slot.
    // Beginning the second creation has already detached the first from urlRef.
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      resultsRef.current = resultsRef.current.filter(result => result.url !== urlRef.current);
    }
    const result = { url: objectUrl, audioBlob, record: { ...completed.record }, spelling: completedSpelling,
      writtenName: getWorkshopWrittenName(completed.record.name, completedSpelling) };
    result.gift = readyCallbackRef.current?.(completed) || null;
    resultsRef.current = [...resultsRef.current, result];
    setResults(resultsRef.current);
    urlRef.current = objectUrl;
    setUrl(objectUrl);
    setPhase('ready');
    setError('');
    return completed;
  };

  useEffect(() => {
    if (!confirming) return;
    const dialog = dialogRef.current;
    dialog.showModal();
    dialog.querySelector('button')?.focus();
    return () => { if (dialog.open) dialog.close(); };
  }, [confirming]);
  useEffect(() => {
    if (!resetConfirmation) return;
    resetDialogRef.current?.showModal();
    resetDialogRef.current?.querySelector('button')?.focus();
    return () => resetDialogRef.current?.close();
  }, [resetConfirmation]);
  const cancelReset = (downloads = false) => {
    setResetConfirmation(false);
    requestAnimationFrame(() => {
      if (downloads) showRecording();
      else triggerRef.current?.focus({ preventScroll: true });
    });
  };
  const reset = () => {
    if (giftExportPending || busy || resetBlocked) return;
    if (onStartAgain?.({ preserve: false }) === false) return;
    setResetConfirmation(false);
    clearRecording();
    operationRef.current = null;
  };
  const closeConfirmation = (restoreFocus = true) => {
    dialogRef.current?.close();
    setConfirming(false);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
  };
  const cancel = () => {
    requestRef.current?.abort();
    requestRef.current = null;
    setPhase(urlRef.current ? 'ready' : 'idle');
    setError('Preparation cancelled. No recording has been saved. You can create a new message.');
    generation.refresh();
  };
  const create = async () => {
    if (requestRef.current || disabled) return;
    closeConfirmation(false);
    deliveryScrollPending.current = true;
    setCreationAttempt(attempt => attempt + 1);
    document.dispatchEvent(new Event('studio-stop-audio'));
    setError('');
    const controller = new AbortController();
    requestRef.current = controller;
    setPreparationMessage(PREPARATION_MESSAGES[Math.floor(Math.random() * PREPARATION_MESSAGES.length)]);
    setPhase('preparing');
    const payload = { name: record.id, ...Object.fromEntries(
      ['age', 'activity', 'achievement', 'treat', 'place'].map(key => [key, choices[key]]),
    ), talent: choices.talent, ...(choices.region ? { region: choices.region } : {}) };
    const submittedSelection = { record: { ...record }, choices: structuredClone(payload) };
    // Keep the ID on ambiguous network failures/retries. A known failed
    // preparation releases its reservation server-side; a committed retry is
    // refused rather than rendered again. Deliberate reset mints a new ID.
    operationRef.current ||= crypto.randomUUID();
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 115000);
    try {
      const response = await fetch('/api/santa-studio-message', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Accept: 'audio/mpeg', 'Idempotency-Key': operationRef.current },
        body: JSON.stringify(payload),
      });
      if (requestRef.current !== controller) return;
      setPhase('receiving');
      await receive(response, controller.signal, submittedSelection);
    } catch (failure) {
      if (requestRef.current === controller) {
        setPhase(urlRef.current ? 'ready' : 'error');
        setError(timedOut ? 'Preparation took too long. Check your current recording before retrying.'
          : failure.message || 'Santa could not create your message. Please try again.');
      }
    } finally {
      clearTimeout(timeout);
      if (requestRef.current === controller) {
        requestRef.current = null;
        await generation.refresh();
      }
    }
  };

  // Keep request/recording state mounted, but do not leave hidden interactive
  // controls or detached playing media in earlier stages.
  if (!visible) return null;
  const messageAction = () => (limited && url) ? null : (
    <button className={`smw-button smw-button-next${disabled ? ' smw-create-disabled' : ''}`}
      type="button" onClick={event => {
        triggerRef.current = event.currentTarget;
        setConfirming(true);
      }} disabled={disabled} aria-busy={busy}>
      {busy ? 'Recording message' : phase === 'error' && complete ? 'Retry message' : 'Create message'} <span aria-hidden="true">→</span>
    </button>
  );
  const startAction = () => <button className="smw-button smw-button-back" type="button"
    disabled={busy || giftExportPending || !!status?.pending || (!url && exhausted)
      || (results.length === 1 && resetBlocked)}
    onClick={event => {
      if (url && results.length === 1) {
        if (resetBlocked || onStartAgain?.({ preserve: true }) === false) return;
        // Keep the result and its URL alive; only the editable operation resets.
        urlRef.current = null;
        setUrl('');
        setPhase('idle');
        setError('');
        operationRef.current = null;
      } else if (url && results.length === 2) {
        triggerRef.current = event.currentTarget;
        setResetConfirmation(true);
      } else {
        // A lost committed response has no local recording to reset. Starting
        // over deliberately begins a new operation using any remaining slot;
        // ordinary Retry must retain the old ID to avoid double consumption.
         if (onStartAgain?.({ preserve: true }) === false) return;
         operationRef.current = null;
         if (!results.length) clearRecording();
      }
    }}>
    <span aria-hidden="true">←</span> Start Again
  </button>;
  const voucherNotice = voucher?.unlimited && <p className="smw-voucher-entitlement">
    You used Voucher Code: {voucher.code}. You can create messages while your access remains valid, subject to request limits.
  </p>;
  return <>
    {/* Render a second trigger in the gifts row without duplicating recording
        state, requests or the confirmation dialog owned by this component. */}
    {reviewMessageTarget && createPortal(url && showReadyAction
      ? <button className="smw-button smw-button-next" type="button" onClick={showRecording}>READY</button>
      : messageAction(), reviewMessageTarget)}
    {!url && startAction()}
    {!url && messageAction()}
    {!url && showGiftDownloadHint && <p className="smw-catalogue-review-note smw-gift-download-hint">
      Create your MP3 to unlock these three personalised gift downloads.
    </p>}
    {!url && voucherNotice}
    {!url && exhausted && <p className="smw-allowance" role="status">Both creations have been used. Create message is unavailable for this access.</p>}
    {(generation.checking || generation.error || !status) && <p className="smw-allowance" role={generation.error ? 'alert' : 'status'} aria-live={generation.error ? 'assertive' : 'polite'}>
      {generation.checking ? 'Checking your Studio access…' : generation.error
        ? generation.error
        : 'Your Studio access has not been confirmed.'}
      {generation.error && generation.accessExpired && <> <button type="button" className="smw-change"
      onClick={() => window.location.reload()}>
      Reload Studio</button></>}
      {generation.error && !generation.accessExpired && <> <button type="button"
        className="smw-change" disabled={generation.checking} onClick={() => generation.refresh()}>
        Retry recording check</button></>}
    </p>}
    <div className="smw-delivery" ref={deliveryRef} tabIndex={-1} role="group" aria-label="Message preparation and recording">
    {busy && <div className="smw-message-result" role="status" aria-live="polite">
      <p>{phase === 'receiving' ? 'Receiving your finished MP3…' : preparationMessage}</p>
      <MessageCreationIndicator />
      <button className="smw-change" type="button" onClick={cancel}>Cancel preparation</button>
    </div>}
    {error && <div className="smw-message-result" role="alert"><p>{error}</p>
    </div>}
    {/* Reverse presentation only: ordinals and the latest target stay chronological. */}
    {results.map((result, index) => <StudioCompletedRecording key={result.url} result={result}
      ordinal={index + 1} visible={visible}
      onBundlePreparing={pending => onBundlePreparing?.(result.url, pending)}
      onBundleRequested={() => onBundleRequested?.(result.gift)}
      onDownloadRequested={() => {
        resultsRef.current = resultsRef.current.map(saved => saved.url === result.url ? { ...saved, requested: true } : saved);
        setResults(resultsRef.current);
      }}
      sectionRef={index === results.length - 1 ? finishedRef : undefined} />).reverse()}
    </div>
    {url && startAction()}
    {url && messageAction()}
    {resetConfirmation && <dialog ref={resetDialogRef} className="smw-confirmation"
      aria-labelledby="smw-reset-title" aria-describedby="smw-reset-warning"
      onKeyDown={trapDialogFocus}
      onCancel={event => { event.preventDefault(); cancelReset(); }}>
      <h3 id="smw-reset-title">Have you downloaded your MP3?</h3>
      <p id="smw-reset-warning">Check that you have saved all your MP3s and gifts on your device before continuing. Starting again clears all retained recordings and their gifts; they cannot be recovered. A download request does not confirm that a file reached your device.</p>
      {!giftsRequested && <p>You haven’t requested all the gifts for {giftWrittenName || finishedWrittenName}. You can still request them before starting again.</p>}
      {resetBlocked && <p role="status">{exhausted
        ? 'Both creations have been used. You cannot start another creation. Keep this page open to play and download your current MP3 and gifts.'
        : 'Another creation cannot be started until your Studio access and remaining creations have been confirmed. Your current recording and gifts have not been cleared. Close this dialog to retry the recording check.'}</p>}
      <div className="smw-actions">
        <button type="button" className="smw-button smw-button-back" onClick={() => cancelReset(true)}>Back to downloads</button>
        <button type="button" className="smw-button smw-button-next"
          disabled={giftExportPending || busy || resetBlocked}
          onClick={reset}>Discard recording and start again</button>
      </div>
    </dialog>}
    {url && voucher?.unlimited && <p className="smw-voucher-detail">Voucher: {voucher.code}</p>}
    {confirming && <dialog ref={dialogRef} className="smw-confirmation" aria-labelledby="smw-confirm-title"
      aria-describedby="smw-confirm-description" onCancel={event => { event.preventDefault(); closeConfirmation(); }}
      onKeyDown={trapDialogFocus}>
      <h3 id="smw-confirm-title">Ready to create your message?</h3>
      <p id="smw-confirm-description">Please check your choices, you can’t edit this message once it’s created. Play and save your MP3 before leaving this page. We don’t keep a copy.</p>
      <div className="smw-actions">
        <button type="button" className="smw-button smw-button-back" onClick={() => closeConfirmation()}>Go back and edit</button>
        <button type="button" className="smw-button smw-button-next" disabled={disabled} onClick={create}>Create message</button>
      </div>
    </dialog>}
  </>;
}
