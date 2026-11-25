import StudioMiniDash from './StudioMiniDash.jsx';
import StudioAccountSave from './StudioAccountSave.jsx';
import { useEffect, useRef, useState } from 'react';
import { useRadio } from './RadioProvider.jsx';
import StudioBundleDownload from './StudioBundleDownload.jsx';
import SantaVideoPlayer from './SantaVideoPlayer.jsx';
import { SantaGreetingShare } from './SantaMessageShare.jsx';
import { createStudioVideo, createStudioVideoPoster, studioVideoFilename, STUDIO_VIDEO_ARTWORK } from '../lib/studioVideo.js';
import './SantaFreeVideo.css';

const ENCODING_STATUS = 'Adding Santa’s voice to your video…';
const RECORDING_MESSAGES = [
  'Hang on, the Head Elf keeps interrupting Santa’s recording…',
  'Oh no, Rudolph blew his nose. Santa’s starting again…',
  'Santa’s beard just brushed the microphone. One more take…',
  'An elf has mistaken the recording light for a doorbell…',
  'Mrs Claus brought in mince pies. The microphone heard every crumb…',
  'Rudolph tried whispering. It came out as a full-volume snort…',
  'Santa’s just sat on a squeaky toy. The elves are blaming the chair…',
  'A tiny elf shouted ‘Ho ho ho!’ before Santa got his turn…',
  'The sleigh bells came in early. They’re very keen…',
  'Santa turned the page and found an elf’s shopping list…',
  'One of the reindeer is tap-dancing outside the sound booth…',
  'Santa’s looking for his glasses. They’re on top of his hat…',
  'An elf opened a bag of sweets directly into the microphone…',
  'Santa tried his quiet ho ho ho. It shook the windows…',
  'The workshop cat has walked across the sound desk…',
  'An elf pressed the big red button. It was the kettle…',
  'A snowball just hit the studio window. Everyone’s looking at Rudolph…',
  'The elves are wrapping presents in the sound booth. That tape is very loud…',
  'Santa’s warm-up accidentally turned into a full verse of Jingle Bells…',
  'An elf has labelled the microphone ‘Do not gift-wrap’. Too late…',
];

// The captured recording and gift details own the name and age, never the next draft.
export default function StudioCompletedRecording({ result, keepsakes, footer, ordinal, visible, sectionRef, onDownloadRequested, onBundlePreparing, onBundleRequested, onVideoReady }) {
  const radio = useRadio();
  const section = useRef(null), resume = useRef(null), playingVideo = useRef(null);
  const callbacks = useRef({ onVideoReady, onBundlePreparing });
  callbacks.current = { onVideoReady, onBundlePreparing };
  const [poster, setPoster] = useState('');
  useEffect(() => {
    let active = true;
    createStudioVideoPoster(result)
      .then(image => { if (active) setPoster(image); })
      .catch(() => { if (active) setPoster(result.artwork || STUDIO_VIDEO_ARTWORK); });
    return () => { active = false; };
  }, [result.writtenName, result.gift, result.videoBlob, result.artwork]);
  const [url, setUrl] = useState('');
  const [progress, setProgress] = useState(null);
  const [status, setStatus] = useState('Preparing your premium Christmas video…');
  const [recordingMessage, setRecordingMessage] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [hideProgress, setHideProgress] = useState(false);
  const [gameDone, setGameDone] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const rotating = status === ENCODING_STATUS && !result.videoBlob && !error;
  useEffect(() => {
    if (!rotating) return;
    let remaining = [...RECORDING_MESSAGES];
    let previous;
    const next = () => {
      if (!remaining.length) remaining = [...RECORDING_MESSAGES];
      const choices = remaining.filter(message => message !== previous);
      previous = choices[Math.floor(Math.random() * choices.length)];
      remaining = remaining.filter(message => message !== previous);
      setRecordingMessage(previous);
    };
    next();
    const timer = setInterval(next, 10_000);
    return () => clearInterval(timer);
  }, [rotating]);

  const finish = () => { const restore = resume.current; resume.current = null; restore?.(); };
  useEffect(() => {
    if (result.videoBlob) return;
    const controller = new AbortController();
    setError(''); setProgress(null); setHideProgress(false); setGameDone(false);
    setStatus('Preparing your premium Christmas video…'); setRecordingMessage('');
    callbacks.current.onBundlePreparing?.(true);
    createStudioVideo(result, { signal: controller.signal, encodingStatus: ENCODING_STATUS, onProgress: value => { if (!controller.signal.aborted) setProgress(value === null ? null : 0.2 + value * 0.8); }, onStatus: text => { if (!controller.signal.aborted) setStatus(text); } })
      .then(blob => { if (!controller.signal.aborted) callbacks.current.onVideoReady?.(blob); })
      .catch(() => { if (!controller.signal.aborted) setError('Your video could not be prepared. Retry below — Santa’s recording is kept here and no extra message credit is used.'); })
      .finally(() => { if (!controller.signal.aborted) callbacks.current.onBundlePreparing?.(false); });
    return () => { controller.abort(); callbacks.current.onBundlePreparing?.(false); };
  }, [result.audioBlob, result.videoBlob, attempt]);
  useEffect(() => {
    if (!result.videoBlob) return;
    const objectUrl = URL.createObjectURL(result.videoBlob);
    setUrl(objectUrl); setProgress(1); setStatus('Your personalised Christmas video is ready.');
    return () => { URL.revokeObjectURL(objectUrl); };
  }, [result.videoBlob]);
  useEffect(() => { if (result.videoBlob && gameDone) setHideProgress(true); }, [result.videoBlob, gameDone]);
  useEffect(() => {
    const stop = () => { playingVideo.current?.pause(); finish(); };
    document.addEventListener('studio-stop-audio', stop);
    return () => { document.removeEventListener('studio-stop-audio', stop); stop(); };
  }, []);
  useEffect(() => { if (!visible) { section.current?.querySelector('video')?.pause(); finish(); } }, [visible]);
  return <section className="smw-message-result smw-message-finished" ref={node => {
    section.current = node;
    if (typeof sectionRef === 'function') sectionRef(node); else if (sectionRef) sectionRef.current = node;
  }} tabIndex={-1} aria-label={ordinal === 1 ? 'Your finished Santa message' : 'Your second finished Santa message'}>
    <h4>Your message from Santa to {result.writtenName}</h4>
    {!hideProgress && !error && <div className="smw-finished-preparation"><div className="santa-free-video__progress"><progress aria-label="Premium MP4 creation progress" max="1" value={progress ?? undefined} /><span>{progress === null ? 'Preparing…' : `${Math.floor(progress * 100)}%`}</span></div><p role="status">{rotating ? `${recordingMessage || 'The North Pole studio is recording…'} Keep this page open.` : status}</p>{<StudioMiniDash progress={progress} onFinish={() => setGameDone(true)} />}</div>}
    {error && <div className="smw-finished-preparation" role="alert"><p>{error}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>Retry video preparation</button></div>}
    {url && gameDone && <>
      <SantaVideoPlayer expandable={false} festiveControls="kids" poster={poster || result.artwork || STUDIO_VIDEO_ARTWORK} src={url} preload="auto" glow label={`Santa’s premium video message for ${result.writtenName}`} onPlay={event => {
        playingVideo.current = event.currentTarget;
        for (const other of document.querySelectorAll('audio, video')) if (other !== event.currentTarget) other.pause();
        resume.current = radio?.pauseForMessage?.() || null;
      }} onPause={finish} onEnded={finish} />
      <div className="smw-finished-tools"><div className="smw-download-actions">
        <div className="smw-download-control">
          <a className={`smw-button smw-button-download${result.requested ? '' : ' smw-button-download--pending'}`} href={url} download={studioVideoFilename(result)}
            onClick={() => { setDownloaded(true); onDownloadRequested(); }}>Download your message <span aria-hidden="true">↓</span></a>
          {downloaded && <span className="smw-download-status" role="status">Downloaded</span>}
        </div>
        <SantaGreetingShare message={{ name: result.writtenName, blob: result.videoBlob }} filename={studioVideoFilename(result)} />
        <StudioBundleDownload showReminder={false} result={result} onPreparing={onBundlePreparing} onDownloadRequested={() => { onDownloadRequested(); onBundleRequested?.(); }} />
      </div>
      {keepsakes && <div className="smw-finished-keepsakes" style={{ borderTop: 0, paddingTop: 0 }}>{keepsakes}</div>}
      </div>
      <div className="smw-finished-bottom"><div className="smw-finished-account"><p>Don't forget to download before leaving</p><StudioAccountSave result={result} /></div>
      {footer}</div>
    </>}
  </section>;
}
