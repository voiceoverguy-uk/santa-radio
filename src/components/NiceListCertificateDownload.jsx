import { useEffect, useId, useRef, useState } from 'react';

export default function NiceListCertificateDownload({ message }) {
  const [status, setStatus] = useState('idle');
  const busy = useRef(false);
  const active = useRef(true);
  const pendingUrls = useRef(new Map());
  const descriptionId = useId();
  useEffect(() => {
    active.current = true;
    const urls = pendingUrls.current;
    return () => {
      active.current = false;
      for (const [url, timer] of urls) {
        clearTimeout(timer);
        URL.revokeObjectURL(url);
      }
      urls.clear();
    };
  }, []);

  const download = async () => {
    if (busy.current) return;
    busy.current = true;
    setStatus('loading');
    try {
      const { personaliseNiceListCertificate, certificateDownloadFilename } = await import('../lib/niceListCertificate.js');
      // Generate afresh so every certificate download rolls a new Nice status.
      // The shared generic PDF/font assets remain cached by the builder.
      const blob = await personaliseNiceListCertificate(message.name);
      if (!active.current) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = certificateDownloadFilename(message.name);
      document.body.append(link);
      try { link.click(); } finally { link.remove(); }
      // Give browsers time to consume the download before revoking. Also
      // release immediately on result eviction / SPA unmount.
      const timer = setTimeout(() => {
        URL.revokeObjectURL(url);
        pendingUrls.current.delete(url);
      }, 60000);
      pendingUrls.current.set(url, timer);
      setStatus('ready');
    } catch {
      if (active.current) setStatus('error');
    } finally {
      busy.current = false;
    }
  };

  return <div className="message-certificate">
    <button className="message-download message-certificate-button" type="button"
      onClick={download} disabled={status === 'loading'} aria-busy={status === 'loading'}
      aria-describedby={descriptionId}>
      {status === 'loading' ? 'Preparing your Nice List certificate…'
        : status === 'error' ? 'Retry your Nice List certificate'
          : 'Download your Nice List certificate'} <span aria-hidden="true">↓</span>
    </button>
    <p className="message-name-hint" id={descriptionId}>A4 landscape PDF · personalised for {message.name}</p>
    {status === 'loading' && <p role="status">Preparing the certificate in your browser…</p>}
    {status === 'ready' && <p role="status">Your certificate download is ready.</p>}
    {status === 'error' && <p role="alert">Your certificate couldn’t be prepared. Retry the certificate above. Your audio is still available and retrying won’t use any message allowance.</p>}
  </div>;
}
