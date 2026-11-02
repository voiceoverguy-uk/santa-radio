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

// Mounted only for this review/selection. Editing or leaving destroys the
// request and page-local URL. Spelling is display-only, never an audio identity.
export default function WorkshopMessageAudio({ record, choices, spelling, complete }) {
  const radio = useRadio();
  const requestRef = useRef(null);
  const urlRef = useRef(null);
  const audioRef = useRef(null);
  const resumeRef = useRef(null);
  const [phase, setPhase] = useState('idle');
  const [preparationMessage, setPreparationMessage] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const writtenName = getWorkshopWrittenName(record?.name || '', spelling);
  const busy = phase === 'preparing' || phase === 'receiving';

  const finishPlayback = () => {
    const resume = resumeRef.current;
    resumeRef.current = null;
    resume?.();
  };
  useEffect(() => {
    const otherPlayback = event => {
      if (event.target !== audioRef.current) {
        // Another player/radio now owns playback; do not resume over it.
        resumeRef.current = null;
        audioRef.current?.pause();
      }
    };
    const stop = () => {
      audioRef.current?.pause();
      finishPlayback();
    };
    const leaveDocument = () => {
      // Browsers can retain the whole document in back/forward cache without
      // React unmounting. Explicitly discard private audio on pagehide too.
      resumeRef.current = null;
      requestRef.current?.abort();
      requestRef.current = null;
      audioRef.current?.pause();
      audioRef.current?.removeAttribute('src');
      audioRef.current?.load();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
      setUrl('');
      setPhase('idle');
      setError('');
    };
    document.addEventListener('play', otherPlayback, true);
    document.addEventListener('studio-stop-audio', stop);
    window.addEventListener('pagehide', leaveDocument);
    return () => {
      document.removeEventListener('play', otherPlayback, true);
      document.removeEventListener('studio-stop-audio', stop);
      window.removeEventListener('pagehide', leaveDocument);
      requestRef.current?.abort();
      requestRef.current = null;
      audioRef.current?.pause();
      audioRef.current?.removeAttribute('src');
      audioRef.current?.load();
      finishPlayback();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  const cancel = () => {
    requestRef.current?.abort();
    requestRef.current = null;
    setPhase('idle');
    setError('');
  };

  const create = async () => {
    if (requestRef.current || !complete) return;
    document.dispatchEvent(new Event('studio-stop-audio'));
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setUrl('');
    setError('');
    const controller = new AbortController();
    requestRef.current = controller;
    setPreparationMessage(PREPARATION_MESSAGES[Math.floor(Math.random() * PREPARATION_MESSAGES.length)]);
    setPhase('preparing');
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 115000);
    try {
      const response = await fetch('/api/santa-studio-message', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({ name: record.id, ...Object.fromEntries(
          ['age', 'activity', 'achievement', 'treat', 'place'].map(key => [key, choices[key]]),
        ), talent: choices.talent, ...(choices.region ? { region: choices.region } : {}) }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (response.status === 403) window.dispatchEvent(new Event('santa-workshop-access-change'));
        throw new Error(data.error || 'Santa could not prepare your message. Please try again.');
      }
      if (!/^audio\/mpeg(?:;|$)/i.test(response.headers.get('content-type') || '')
        || Number(response.headers.get('content-length')) > MAX_BYTES || !response.body) {
        throw new Error('The message service did not return a valid MP3. Please try again.');
      }
      if (requestRef.current !== controller) return;
      setPhase('receiving');
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
      if (requestRef.current !== controller || controller.signal.aborted) return;
      const objectUrl = URL.createObjectURL(new Blob(chunks, { type: 'audio/mpeg' }));
      urlRef.current = objectUrl;
      setUrl(objectUrl);
      setPhase('ready');
    } catch (failure) {
      if (requestRef.current === controller) {
        setPhase('error');
        setError(timedOut ? 'Preparation took too long. Please try again.'
          : failure.message || 'Santa could not create your message. Please try again.');
      }
    } finally {
      clearTimeout(timeout);
      if (requestRef.current === controller) requestRef.current = null;
    }
  };

  return <>
    <button className="smw-button smw-button-next" type="button" onClick={create}
      disabled={!complete || busy} aria-busy={busy}>
      {busy ? 'Preparing message…' : phase === 'error' ? 'Retry message' : 'Create message'}
      <span aria-hidden="true">→</span>
    </button>
    {busy && <div className="smw-message-result" role="status" aria-live="polite">
      <p>{phase === 'receiving' ? 'Receiving your finished MP3…'
        : preparationMessage}</p>
      <progress aria-label="Preparing your message" />
      <button className="smw-change" type="button" onClick={cancel}>Cancel preparation</button>
    </div>}
    {error && <div className="smw-message-result" role="alert"><p>{error}</p></div>}
    {url && <section className="smw-message-result" aria-label="Your finished Santa message">
      <h4>Santa’s message for {writtenName}</h4>
      <p role="status">Your extended message is ready to play and download.</p>
      <audio ref={node => { if (node) audioRef.current = node; }} src={url} controls preload="metadata"
        aria-label={`Play Santa’s message for ${writtenName}`}
        onPlay={event => {
          const resume = radio?.pauseForMessage?.();
          if (resume) resumeRef.current = resume;
          for (const other of document.querySelectorAll('audio')) {
            if (other !== event.currentTarget) other.pause();
          }
        }}
        onPause={finishPlayback} onEnded={finishPlayback}
        onError={() => {
          finishPlayback();
          setError('Your browser could not play this MP3. Try the download, or press Retry message to prepare it again.');
          setPhase('error');
        }} />
      <a className="smw-button smw-button-back" href={url}
        download={getWorkshopDownloadName(record.name, spelling)}>Download MP3 <span aria-hidden="true">↓</span></a>
      <p className="smw-catalogue-review-note">Keep your download. This recording is held only while this review stays open; editing the audio choices or leaving Studio clears it.</p>
    </section>}
  </>;
}
