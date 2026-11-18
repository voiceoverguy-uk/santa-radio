import { useEffect, useState } from 'react';
import { createSantaVideo } from '../lib/createSantaVideo.js';
import { trackMessageAction } from '../lib/messageEngagement.js';
import './SantaFreeVideo.css';

export default function SantaFreeVideo({ message, onDownload, onPlay, onEnded }) {
  const [url, setUrl] = useState('');
  const [progress, setProgress] = useState(null);
  const [status, setStatus] = useState('Preparing your Christmas video…');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [cancelled, setCancelled] = useState(false);
  useEffect(() => {
    if (cancelled) return;
    const controller = new AbortController();
    let objectUrl;
    setUrl(''); setError(''); setStatus('Preparing your Christmas video…');
    createSantaVideo({ audio: message.blob, name: message.name, signal: controller.signal, onProgress: value => { if (!controller.signal.aborted) setProgress(value); }, onStatus: text => { if (!controller.signal.aborted) setStatus(text); } })
      .then(blob => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); setStatus('Your Christmas video is ready.');
      }).catch(() => {
        if (!controller.signal.aborted) { setError('Your video could not be prepared on this device. Try again, or keep your audio recording below.'); setStatus(''); }
      });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [message.blob, message.name, attempt, cancelled]);
  const filename = `Santa-message-for-${message.name.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'you'}.mp4`;
  return <div className="santa-free-video">
    {!error && !cancelled && <div className="santa-free-video__progress"><progress aria-label="MP4 creation progress" max="1" value={progress ?? undefined} /><span>{progress === null ? 'Preparing…' : `${Math.floor(progress * 100)}%`}</span></div>}
    <p role="status" aria-live="polite">{cancelled ? 'Video preparation cancelled. Your audio is still available below.' : status}</p>
    {url && !cancelled && <>
      <video controls playsInline preload="metadata" src={url} aria-label={`Santa’s video message for ${message.name}`} onPlay={onPlay} onEnded={onEnded} onPlaying={() => trackMessageAction(message.statisticsReceipt, 'listen')} />
      <a className="message-download" href={url} download={filename} onClick={() => {
        trackMessageAction(message.statisticsReceipt, 'mp4-download');
        trackMessageAction(message.statisticsReceipt, 'download');
        onDownload?.();
      }}>Download your MP4 video</a>
    </>}
    {!url && !error && !cancelled && <button type="button" onClick={() => setCancelled(true)}>Cancel video preparation</button>}
    {error && <p role="alert">{error}</p>}
    {(error || cancelled) && <button type="button" onClick={() => { setCancelled(false); setAttempt(value => value + 1); }}>Prepare video again</button>}
    <p className="santa-free-video__note">Your name and Santa’s voice are included in the video. Save it to your device to keep and share.</p>
  </div>;
}
