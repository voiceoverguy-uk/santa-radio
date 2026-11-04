import { useEffect, useId, useRef, useState } from 'react';

const labels = {
  certificate: 'Download certificate (PDF)',
  letter: 'Download letter (PDF)',
  picture: 'Download Santa picture (PNG)',
};

export default function StudioGiftDownload({ kind, ready, name, letter, picture, unavailableNotice, onDownloadRequested, onPreparing }) {
  const id = useId();
  const [status, setStatus] = useState('idle');
  const busy = useRef(false);
  const active = useRef(false);
  const urls = useRef(new Map());
  useEffect(() => {
    active.current = true;
    const pending = urls.current;
    return () => {
      active.current = false;
      onPreparing?.(kind, false);
      for (const [url, timer] of pending) { clearTimeout(timer); URL.revokeObjectURL(url); }
      pending.clear();
    };
  }, []);
  const download = async () => {
    if (!ready || busy.current) return;
    busy.current = true;
    onPreparing?.(kind, true);
    setStatus('preparing');
    try {
      let blob, filename;
      if (kind === 'certificate') {
        const exports = await import('../lib/niceListCertificate.js');
        blob = await exports.personaliseNiceListCertificate(name);
        filename = exports.certificateDownloadFilename(name);
      } else {
        const exports = await import('../lib/studioGiftExports.js');
        blob = kind === 'letter' ? await exports.exportStudioLetter(letter)
          : await exports.exportStudioPicture(name, picture);
        filename = exports.studioGiftFilename(kind, name);
      }
      if (!active.current) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.append(link);
      try { link.click(); } finally { link.remove(); }
      urls.current.set(url, setTimeout(() => {
        URL.revokeObjectURL(url); urls.current.delete(url);
      }, 60000));
      setStatus('requested');
      onDownloadRequested?.(kind);
    } catch {
      if (active.current) setStatus('error');
    } finally { busy.current = false; onPreparing?.(kind, false); }
  };
  return <div className="studio-gift-download">
    <button type="button" onClick={download} disabled={!ready || status === 'preparing'}
      aria-describedby={id} aria-busy={status === 'preparing'}>
      {status === 'preparing' ? `Preparing ${kind}…`
        : status === 'error' ? `Retry ${labels[kind].toLowerCase()}` : labels[kind]}
    </button>
    <p id={id} role={status === 'error' ? 'alert' : 'status'}>
      {!ready ? unavailableNotice || 'Available when your MP3 audio file has been downloaded.'
        : status === 'preparing' ? 'Preparing locally in your browser…'
          : status === 'error' ? 'Could not prepare this gift. Retry above; your audio and other gifts are unaffected. No message allowance is used.'
            : status === 'requested' ? 'Download requested. Check your browser’s downloads; keep your own copy.'
              : 'Ready. Repeat downloads do not use your message allowance.'}
    </p>
  </div>;
}
