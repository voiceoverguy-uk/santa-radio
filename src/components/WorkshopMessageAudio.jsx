import { useContext, useEffect, useRef, useState } from 'react';
import { useRadio } from './RadioProvider.jsx';
import { StudioVoucherContext } from '../lib/studioAccessContext.js';
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
  record, choices, spelling, complete, generation, correction, tester = false, onCorrection, visible, onPhaseChange, onReady,
  showGiftDownloadHint = false,
}) {
  const radio = useRadio();
  const voucher = useContext(StudioVoucherContext);
  const requestRef = useRef(null);
  const urlRef = useRef(null);
  const audioRef = useRef(null);
  const resumeRef = useRef(null);
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);
  const receivedSelection = useRef(null);
  const readyCallbackRef = useRef(onReady);
  // Spelling can be corrected while bytes are arriving. It is display-only;
  // commit the latest spelling without restarting the audio request.
  readyCallbackRef.current = onReady;
  const [phase, setPhase] = useState('idle');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [preparationMessage, setPreparationMessage] = useState('');
  const [finishedName, setFinishedName] = useState(null);
  const writtenName = getWorkshopWrittenName(record?.name || '', spelling);
  const finishedSpelling = finishedName?.id === record?.id ? spelling : finishedName?.spelling;
  const finishedWrittenName = finishedName
    ? getWorkshopWrittenName(finishedName.name, finishedSpelling) : writtenName;
  const busy = phase === 'preparing' || phase === 'receiving';
  const status = generation.state;
  const epoch = status?.accessEpoch || generation.epoch || 0;
  useEffect(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    receivedSelection.current = null;
  }, [epoch]);
  const disabled = !complete || busy || !status || !!generation.error || generation.checking;
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
    const objectUrl = URL.createObjectURL(new Blob(chunks, { type: 'audio/mpeg' }));
    audioRef.current?.pause();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = objectUrl;
    setUrl(objectUrl);
    setPhase('ready');
    setError('');
    setFinishedName({ id: record?.id, name: record?.name || '', spelling });
    return receivedSelection.current;
  };

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
    setError('Preparation cancelled. No recording has been saved. You can create a new message.');
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
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 115000);
    try {
      const response = await fetch('/api/santa-studio-message', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify(payload),
      });
      if (requestRef.current !== controller) return;
      setPhase('receiving');
      await receive(response, controller.signal);
      readyCallbackRef.current?.(receivedSelection.current || { record, choices });
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
    {url && <p className="smw-download-hint">
      Save your MP3 before leaving or refreshing this page. We do not keep a copy or recording history.
    </p>}
    <button ref={triggerRef} className={`smw-button smw-button-next${disabled ? ' smw-create-disabled' : ''}`}
      type="button" onClick={() => setConfirming(true)} disabled={disabled} aria-busy={busy}>
      {busy ? 'Recording message' : phase === 'error' && complete ? 'Retry message' : 'Create message'} <span aria-hidden="true">→</span>
    </button>
    {showGiftDownloadHint && <p className="smw-catalogue-review-note smw-gift-download-hint">
      Create your MP3 to unlock these three personalised gift downloads.
    </p>}
    {voucher?.unlimited && <p className="smw-voucher-entitlement">
      You used Voucher Code: {voucher.code}. You can create messages while your access remains valid, subject to request limits.
    </p>}
    {(generation.checking || generation.error || !status) && <p className="smw-allowance" role={generation.error ? 'alert' : 'status'} aria-live={generation.error ? 'assertive' : 'polite'}>
      {generation.checking ? 'Checking your Studio access…' : generation.error
        ? generation.error
        : 'Your Studio access has not been confirmed.'}
      {generation.error && generation.accessExpired && <> <button type="button" className="smw-change"
      onClick={() => window.location.reload()}>
      Reload Studio</button></>}
      {generation.error && !generation.accessExpired && voucher?.unlimited && <> <button type="button"
        className="smw-change" disabled={generation.checking} onClick={() => generation.refresh()}>
        Retry recording check</button></>}
    </p>}
    {busy && <div className="smw-message-result" role="status" aria-live="polite">
      <p>{phase === 'receiving' ? 'Receiving your finished MP3…' : preparationMessage}</p>
      <progress aria-label="Preparing your message" />
      <button className="smw-change" type="button" onClick={cancel}>Cancel preparation</button>
    </div>}
    {error && <div className="smw-message-result" role="alert"><p>{error}</p>
    </div>}
    {url && <section className="smw-message-result" aria-label="Your finished Santa message">
      <h4>Santa’s message for {finishedWrittenName}</h4>
      <p role="status">Your message is ready to play and download. It is only available on this open page.</p>
      <audio ref={audioRef} src={url} controls preload="metadata" aria-label={`Play Santa’s message for ${finishedWrittenName}`}
        onPlay={event => {
          const resume = radio?.pauseForMessage?.();
          if (resume) resumeRef.current = resume;
          for (const other of document.querySelectorAll('audio')) if (other !== event.currentTarget) other.pause();
        }} onPause={finishPlayback} onEnded={finishPlayback}
        onError={() => { finishPlayback(); setError('Your browser could not play this MP3. You can still try downloading it.'); }} />
      <div className="smw-download-actions"><a className="smw-button smw-button-download" href={url}
        download={getWorkshopDownloadName(finishedName?.name || record?.name || '',
          finishedSpelling ?? spelling)}>Download MP3 <span aria-hidden="true">↓</span></a></div>
      <p className="smw-catalogue-review-note">Save your MP3 now. Leaving or refreshing this page removes the temporary recording. A download click cannot confirm that your browser saved the file.</p>
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
      <p id="smw-confirm-description">Create a temporary MP3 using these details, then play and save it on this page. We do not keep a copy or message history. You can change your choices and create another message, subject to request limits.</p>
      <div className="smw-actions">
        <button type="button" className="smw-button smw-button-back" onClick={closeConfirmation}>Go back</button>
        <button type="button" className="smw-button smw-button-next" disabled={disabled} onClick={create}>Create message</button>
      </div>
    </dialog>}
  </>;
}
