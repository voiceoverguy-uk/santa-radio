import { useRef, useState, useEffect } from 'react';
import { ORIGIN } from '../seo/catalogue.js';

const shareUrl = `${ORIGIN}/free-santa-message`;
const shareData = {
  title: 'Free personalised Santa message | Santa Radio',
  text: 'Create a free personalised Santa audio message and enjoy Christmas music on Santa Radio.',
  url: shareUrl,
};

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
