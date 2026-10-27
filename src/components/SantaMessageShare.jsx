import { useRef, useState, useEffect } from 'react';
import { ORIGIN } from '../seo/catalogue.js';

const shareUrl = `${ORIGIN}/free-santa-message`;
const shareData = {
  title: 'Free personalised Santa message | Santa Radio',
  text: 'Create a free personalised Santa audio message and enjoy Christmas music on Santa Radio.',
  url: shareUrl,
};

// File sharing is deliberately separate from the public-maker invitation.
// Keep this synchronous until navigator.share so the click's activation survives.
export function SantaGreetingShare({ message }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [failed, setFailed] = useState(false);
  const sharing = useRef(false);

  const share = async () => {
    if (sharing.current) return;
    sharing.current = true;
    setBusy(true);
    setStatus('');
    setFailed(false);
    try {
      const file = new File([message.blob], message.downloadName, { type: 'audio/mpeg' });
      const data = { files: [file] };
      if (typeof navigator.share !== 'function' ||
          typeof navigator.canShare !== 'function' || !navigator.canShare(data)) {
        setStatus('This browser can’t share MP3 files directly. Use the download link above, then attach the MP3 in your messaging app.');
        return;
      }
      await navigator.share(data);
      setStatus('Greeting passed to your chosen sharing app.');
    } catch (error) {
      if (error.name !== 'AbortError') {
        setFailed(true);
        setStatus('Your greeting couldn’t be shared. Please try again, or use the download link above and attach the MP3 in your messaging app.');
      }
    } finally {
      sharing.current = false;
      setBusy(false);
    }
  };

  return <div className="message-share">
    <button className="message-share-icon" type="button" onClick={share} disabled={busy}
      aria-label={busy ? 'Opening greeting share options…' : 'Share this greeting'}
      title="Share this greeting" aria-busy={busy}>
      <svg aria-hidden="true" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 15V3m-4 4 4-4 4 4M7 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-2" />
      </svg>
    </button>
    {status && <p className="message-share-status" role={failed ? 'alert' : 'status'}>{status}</p>}
  </div>;
}

export default function SantaMessageShare() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [manual, setManual] = useState(false);
  const input = useRef(null);
  useEffect(() => { if (manual) input.current?.select(); }, [manual]);

  const share = async () => {
    setBusy(true);
    setStatus('');
    setManual(false);
    try {
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share(shareData);
          setStatus('Sharing options opened.');
          return;
        } catch (error) {
          if (error.name === 'AbortError') return;
          // If native sharing fails, offer the same safe, name-free link.
        }
      }
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(shareUrl);
      setStatus('Link copied. Paste it into a message to tell your friends.');
    } catch {
      setManual(true);
      setStatus('Copy this link to tell your friends:');
    } finally {
      setBusy(false);
    }
  };

  return <div className="message-share">
    <button className="message-retry" type="button" onClick={share} disabled={busy}>
      {busy ? 'Opening share options…' : 'Share with friends'}
    </button>
    {status && <p className="message-share-status" role="status">{status}</p>}
    {manual && <label className="message-share-link">
      Link to share
      <input ref={input} type="text" readOnly value={shareUrl} onFocus={event => event.target.select()} />
    </label>}
  </div>;
}
