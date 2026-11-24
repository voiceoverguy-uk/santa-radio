import StudioScenePicker from './StudioScenePicker.jsx';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import StudioCompletedRecording from './StudioCompletedRecording.jsx';
import { StudioAccessContext, StudioVoucherContext } from '../lib/studioAccessContext.js';
import { getWorkshopWrittenName } from '../lib/workshopNameSpelling.js';

const MAX_BYTES = 4_400_000;


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
  record, choices, spelling, ageLabel, complete, generation, correction, tester = false, onCorrection, visible, onPhaseChange, onReady,
  reviewActionTarget = null, deliveryTarget = null, onStartAgain, remainingNotice, keepsakes,
  giftsRequested = false, giftExportPending = false, giftWrittenName, onBundlePreparing, onBundleRequested, deliveryStep, onDeliveryStep,
}) {
  const accessKind = useContext(StudioAccessContext);
  const voucherContext = useContext(StudioVoucherContext);
  const voucher = accessKind.startsWith('paid-') ? null : voucherContext;
  const requestRef = useRef(null);
  const urlRef = useRef(null);
  const triggerRef = useRef(null);
  const finishedRef = useRef(null);
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
  const [scene, setScene] = useState(null);
  const [resetConfirmation, setResetConfirmation] = useState(false);
  const resetDialogRef = useRef(null);
  const operationRef = useRef(null);
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
  // Share readiness only after the entire video message has been received, never merely
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
      throw new Error('The message service did not return a valid recording. Please try again.');
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
    const result = { archiveId: response.headers.get('X-Studio-Archive'), url: objectUrl, audioBlob, clipStarts: completed.clipStarts, clipEnds: completed.clipEnds, record: { ...completed.record }, spelling: completedSpelling,
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
    const preserve = results.length === 1;
    if (onStartAgain?.({ preserve }) === false) return;
    setResetConfirmation(false);
    if (preserve) {
      // Keep the first creation available when the next message is ready.
      urlRef.current = null;
      setUrl('');
      setPhase('idle');
      setError('');
    } else clearRecording();
    operationRef.current = null;
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
    if (deliveryStep !== 'scene') setScene(null);
    onDeliveryStep('scene');
    document.dispatchEvent(new Event('studio-stop-audio'));
    setError('');
    const controller = new AbortController();
    requestRef.current = controller;
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
      type="button" onClick={create} disabled={disabled}>
      {deliveryStep === 'scene' ? 'Retry recording' : 'Choose picture'} <span aria-hidden="true">→</span>
    </button>
  );
  const finishScene = () => {
    if (!scene || phase !== 'ready' || !urlRef.current) return;
    const next = resultsRef.current.map(result => result.url === urlRef.current
      ? { ...result, artwork: scene } : result);
    resultsRef.current = next;
    setResults(next);
    onDeliveryStep('result');
  };
  const finalMessageAvailable = deliveryStep === 'result' && limited && status.remaining === 1;
  const startAction = () => <button className={`smw-button ${finalMessageAvailable ? 'smw-button-next smw-button-final-message' : 'smw-button-back'}`} type="button"
    aria-disabled={exhausted || undefined}
    aria-haspopup={exhausted || url ? 'dialog' : undefined}
    disabled={busy || giftExportPending || !!status?.pending
      || (!exhausted && results.length === 1 && resetBlocked)}
    onClick={event => {
      if (exhausted || url) {
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
    {finalMessageAvailable ? <>Click to make your final message <span aria-hidden="true">→</span></>
      : <><span aria-hidden="true">←</span> Start Again</>}
  </button>;
  const voucherNotice = voucher?.unlimited && <p className="smw-voucher-entitlement">
    Voucher access: you can create messages while your access remains valid, subject to request limits.
  </p>;
  const delivery = (
    <div className="smw-delivery" tabIndex={-1} role="group" aria-label="Message preparation and recording">
    {busy && <div className="smw-message-result smw-message-preparing">
      <p role="status" aria-live="polite">Santa is preparing your recording…</p>
      <div className="smw-preparation-row">
        <div className="smw-preparation-controls">
          <button className="smw-change" type="button" onClick={cancel}>Cancel preparation</button>
        </div>
        <div className="santa-free-video__progress"><progress aria-label="Premium MP4 creation progress" max="1" /><span>Preparing…</span></div>
      </div>
    </div>}
    {error && <div className="smw-message-result" role="alert"><p>{error}</p>
    </div>}
    {deliveryStep === 'scene' && <>
      <StudioScenePicker selected={scene} onSelect={setScene}
        recipientCaption={writtenName && ageLabel ? `${writtenName} - aged ${ageLabel.replace(/\s+old$/i, '')}` : writtenName} />
      {!busy && phase !== 'ready' && <div className="smw-actions">{messageAction()}</div>}
      {reviewActionTarget ? createPortal(
        <button type="button" className="smw-button smw-button-next"
          disabled={!scene || phase !== 'ready'} onClick={finishScene} style={{ whiteSpace: 'nowrap' }}>Create Message <span aria-hidden="true">→</span></button>,
        reviewActionTarget
      ) : <button type="button" className="smw-button smw-button-next"
        disabled={!scene || phase !== 'ready'} onClick={finishScene} style={{ whiteSpace: 'nowrap' }}>Create Message <span aria-hidden="true">→</span></button>}
    </>}
    {/* Reverse presentation only: ordinals and the latest target stay chronological. */}
    {deliveryStep === 'result' && results.filter(result => result.artwork).map((result, index) => <StudioCompletedRecording key={result.url} result={result}
      keepsakes={index === results.length - 1 ? keepsakes : null}
      footer={index === results.length - 1 && url ? <div className="smw-finished-footer">
        {!finalMessageAvailable && remainingNotice}
        {startAction()}
      </div> : null}
      ordinal={index + 1} visible={visible}
      onVideoReady={videoBlob => {
        const next = resultsRef.current.map(item => item.url === result.url ? { ...item, videoBlob } : item);
        resultsRef.current = next; setResults(next);
      }}
      onBundlePreparing={pending => onBundlePreparing?.(result.url, pending)}
      onBundleRequested={() => onBundleRequested?.(result.gift)}
      onDownloadRequested={() => {
        resultsRef.current = resultsRef.current.map(saved => saved.url === result.url ? { ...saved, requested: true } : saved);
        setResults(resultsRef.current);
      }}
      sectionRef={index === results.length - 1 ? finishedRef : undefined} />).reverse()}
    </div>
  );
  return <>
    {deliveryStep === 'review' && (() => {
      const actions = <div className="smw-review-header-buttons smw-review-action-pair">
        {startAction()}
        {messageAction()}
      </div>;
      return reviewActionTarget ? createPortal(actions, reviewActionTarget) : actions;
    })()}
    {deliveryStep === 'review' && voucherNotice}
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
    {deliveryTarget && createPortal(delivery, deliveryTarget)}
    {deliveryStep === 'result' && url && messageAction()}
    {resetConfirmation && <dialog ref={resetDialogRef} className="smw-confirmation"
      aria-labelledby="smw-reset-title" aria-describedby="smw-reset-warning"
      onKeyDown={trapDialogFocus}
      onCancel={event => { event.preventDefault(); cancelReset(); }}>
      <h3 id="smw-reset-title">Have you saved everything?</h3>
      <p id="smw-reset-warning">{exhausted
        ? 'You’ve used both message credits. Save your videos and gifts before leaving this page.'
        : results.length === 1
          ? 'Save your video and gifts before starting your next message.'
          : 'Check that you have saved all your video messages and gifts on your device before continuing. Starting again clears all retained recordings and their gifts; they cannot be recovered. A download request does not confirm that a file reached your device.'}</p>
      {!giftsRequested && <p>You haven’t requested all the gifts for {giftWrittenName || finishedWrittenName}. You can still request them before starting again.</p>}
      {!exhausted && resetBlocked && <p role="status">Another creation cannot be started until your Studio access and remaining creations have been confirmed. Your current recording and gifts have not been cleared. Close this dialog to retry the recording check.</p>}
      <div className="smw-actions">
        <button type="button" className="smw-button smw-button-back" onClick={() => cancelReset(true)}>Back to downloads</button>
        {!exhausted && <button type="button" className="smw-button smw-button-next"
          disabled={giftExportPending || busy || resetBlocked}
          onClick={reset}>{results.length === 1 ? 'Start next message' : 'Discard recordings and start again'}</button>}
      </div>
    </dialog>}

  </>;
}
