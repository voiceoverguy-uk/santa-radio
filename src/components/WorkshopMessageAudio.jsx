import { useEffect, useRef, useState } from 'react';
import { useRadio } from './RadioProvider.jsx';
import { getWorkshopDownloadName, getWorkshopWrittenName } from '../lib/workshopNameSpelling.js';

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

export default function WorkshopMessageAudio({
  record, choices, spelling, complete, generation, correction, onCorrection, visible, onPhaseChange, onReady,
}) {
  const radio = useRadio();
  const requestRef = useRef(null);
  const urlRef = useRef(null);
  const audioRef = useRef(null);
  const resumeRef = useRef(null);
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);
  const operationRef = useRef(null);
  const loadedSequence = useRef(0);
  const readyCallbackRef = useRef(onReady);
  // Spelling can be corrected while bytes are arriving. It is display-only;
  // commit the latest spelling without restarting the audio request.
  readyCallbackRef.current = onReady;
  const [phase, setPhase] = useState('idle');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [recoveryAttempt, setRecoveryAttempt] = useState(0);
  const [preparationMessage, setPreparationMessage] = useState('');
  const writtenName = getWorkshopWrittenName(record?.name || '', spelling);
  const busy = phase === 'preparing' || phase === 'receiving';
  const status = generation.state;
  const disabled = !complete || busy || !status || !!generation.error || status.pending
    || status.remaining === 0 || ((url || status.successes > 0) && !correction);
  // Share readiness only after the entire MP3 has been received, never merely
  // on a successful HTTP header or a promotional preview.
  useEffect(() => { onPhaseChange?.(error ? 'error' : phase); }, [phase, error, onPhaseChange]);

  const finishPlayback = () => {
    const resume = resumeRef.current;
    resumeRef.current = null;
    resume?.();
  };
  useEffect(() => {
    const otherPlayback = event => {
      if (event.target !== audioRef.current) {
        resumeRef.current = null;
        audioRef.current?.pause();
      }
    };
    const stop = () => { audioRef.current?.pause(); finishPlayback(); };
    document.addEventListener('play', otherPlayback, true);
    document.addEventListener('studio-stop-audio', stop);
    window.addEventListener('pagehide', stop);
    return () => {
      document.removeEventListener('play', otherPlayback, true);
      document.removeEventListener('studio-stop-audio', stop);
      window.removeEventListener('pagehide', stop);
      requestRef.current?.abort();
      audioRef.current?.pause();
      finishPlayback();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);
  useEffect(() => {
    const audio = audioRef.current;
    if (!visible) { audio?.pause(); finishPlayback(); }
    return () => { audio?.pause(); finishPlayback(); };
  }, [visible]);

  const receive = async (response, signal) => {
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
    const objectUrl = URL.createObjectURL(new Blob(chunks, { type: 'audio/mpeg' }));
    audioRef.current?.pause();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = objectUrl;
    setUrl(objectUrl);
    setPhase('ready');
    setError('');
    return Number(response.headers.get('x-studio-generation')) || null;
  };

  // Recover completed audio after refresh/remount or another tab's success.
  useEffect(() => {
    if (!complete || !status?.successes || loadedSequence.current >= status.successes || requestRef.current) return;
    const controller = new AbortController();
    const sequence = status.successes;
    fetch('/api/santa-studio-message?audio=1', {
      credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
    }).then(response => receive(response, controller.signal)).then(() => {
      loadedSequence.current = sequence;
      readyCallbackRef.current?.({ record: status.record, choices: status.choices });
    })
      .catch(failure => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [complete, status?.successes, phase, recoveryAttempt, url]);

  useEffect(() => {
    if (!confirming) return;
    const dialog = dialogRef.current;
    dialog.showModal();
    dialog.querySelector('button')?.focus();
    return () => dialog.close();
  }, [confirming]);
  const closeConfirmation = () => {
    setConfirming(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };
  const cancel = () => {
    requestRef.current?.abort();
    requestRef.current = null;
    setPhase(urlRef.current ? 'ready' : 'idle');
    setError('Preparation cancelled. If it had already finished, your recording will be available when the allowance is checked.');
    generation.refresh();
  };
  const create = async () => {
    closeConfirmation();
    if (requestRef.current || disabled) return;
    document.dispatchEvent(new Event('studio-stop-audio'));
    setError('');
    const controller = new AbortController();
    requestRef.current = controller;
    setPreparationMessage(PREPARATION_MESSAGES[Math.floor(Math.random() * PREPARATION_MESSAGES.length)]);
    setPhase('preparing');
    const payload = { name: record.id, ...Object.fromEntries(
      ['age', 'activity', 'achievement', 'treat', 'place'].map(key => [key, choices[key]]),
    ), talent: choices.talent, ...(choices.region ? { region: choices.region } : {}) };
    const fingerprint = JSON.stringify(payload);
    if (operationRef.current?.fingerprint !== fingerprint) {
      operationRef.current = { fingerprint, key: crypto.randomUUID() };
    }
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 115000);
    try {
      const response = await fetch('/api/santa-studio-message', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Accept: 'audio/mpeg',
          'Idempotency-Key': operationRef.current.key },
        body: JSON.stringify(payload),
      });
      if (requestRef.current !== controller) return;
      setPhase('receiving');
      const sequence = await receive(response, controller.signal);
      // Refresh will restore the authoritative choices and end correction mode.
      loadedSequence.current = sequence || (status?.successes || 0) + 1;
      operationRef.current = null;
      readyCallbackRef.current?.({ record, choices });
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
  return <>
    <button ref={triggerRef} className={`smw-button smw-button-next${disabled ? ' smw-create-disabled' : ''}`}
      type="button" onClick={() => setConfirming(true)} disabled={disabled} aria-busy={busy}>
      {busy ? 'Preparing message…' : phase === 'error' && complete ? 'Retry message' : 'Create message'} <span aria-hidden="true">→</span>
    </button>
    {status?.successes === 1 && !correction && <button className="smw-button smw-button-back"
      type="button" disabled={busy || status.pending || !!generation.error} onClick={() => {
        operationRef.current = null;
        onCorrection();
      }}>Edit and regenerate once</button>}
    <p className="smw-allowance" role="status" aria-live="polite">
      {!status ? 'Checking your message allowance…' : status.remaining === 0
        ? 'Both messages have been created. No further generation is available. Repeat downloads are still available.'
        : status.pending ? 'A message is being prepared for this access. Your allowance will update when it finishes.'
          : status.successes === 1
            ? 'Your recorded name and full destination are locked. One correction remains for the other audio choices.'
            : 'You can create one message, then make one correction. The recorded name and full destination lock after the first successful message.'}
    </p>
    {generation.error && <p role="alert">{generation.error} <button type="button" className="smw-change"
      onClick={generation.refresh}>Check allowance again</button></p>}
    {busy && <div className="smw-message-result" role="status" aria-live="polite">
      <p>{phase === 'receiving' ? 'Receiving your finished MP3…' : preparationMessage}</p>
      <progress aria-label="Preparing your message" />
      <button className="smw-change" type="button" onClick={cancel}>Cancel preparation</button>
    </div>}
    {error && <div className="smw-message-result" role="alert"><p>{error}</p>
      {status?.successes > 0 && !url && <button className="smw-change" type="button"
        onClick={() => { setRecoveryAttempt(value => value + 1); generation.refresh(); }}>Retrieve recording again</button>}
    </div>}
    {url && <section className="smw-message-result" aria-label="Your finished Santa message">
      <h4>Santa’s message for {writtenName}</h4>
      <p role="status">{correction ? 'Your previous recording remains available until your correction succeeds.' : 'Your extended message is ready to play and download.'}</p>
      <audio ref={audioRef} src={url} controls preload="metadata" aria-label={`Play Santa’s message for ${writtenName}`}
        onPlay={event => {
          const resume = radio?.pauseForMessage?.();
          if (resume) resumeRef.current = resume;
          for (const other of document.querySelectorAll('audio')) if (other !== event.currentTarget) other.pause();
        }} onPause={finishPlayback} onEnded={finishPlayback}
        onError={() => { finishPlayback(); setError('Your browser could not play this MP3. You can still try downloading it.'); }} />
      <div className="smw-download-actions"><a className="smw-button smw-button-download" href={url}
        download={getWorkshopDownloadName(record?.name || '', spelling)}>Download MP3 <span aria-hidden="true">↓</span></a></div>
      <p className="smw-catalogue-review-note">Download and keep your MP3. You can download it repeatedly, including after refresh while this same authorised Studio access remains valid. A download click cannot confirm that your browser saved the file.</p>
    </section>}
    {confirming && <dialog ref={dialogRef} className="smw-confirmation" aria-labelledby="smw-confirm-title"
      aria-describedby="smw-confirm-description" onCancel={event => { event.preventDefault(); closeConfirmation(); }}
      onKeyDown={event => {
        if (event.key !== 'Tab') return;
        const controls = [...event.currentTarget.querySelectorAll('button:not(:disabled)')];
        const target = event.shiftKey ? controls.at(-1) : controls[0];
        if ((event.shiftKey && document.activeElement === controls[0])
          || (!event.shiftKey && document.activeElement === controls.at(-1))) {
          event.preventDefault();
          target?.focus();
        }
      }}>
      <h3 id="smw-confirm-title">Are you happy with your selection?</h3>
      <p id="smw-confirm-description">{status?.successes
        ? 'This is your one remaining correction. Your recorded name and full destination stay locked. After this succeeds, no further message generation is available.'
        : 'After your first successful message, the exact recorded name and full destination, including any county or state, will be locked. You will have one remaining correction for the other audio choices. Written spelling does not change the spoken recording.'}</p>
      <div className="smw-actions">
        <button type="button" className="smw-button smw-button-back" onClick={closeConfirmation}>Go back</button>
        <button type="button" className="smw-button smw-button-next" disabled={disabled} onClick={create}>Create message</button>
      </div>
    </dialog>}
  </>;
}
