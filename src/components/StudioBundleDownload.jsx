import { useEffect, useId, useRef, useState } from 'react';

export default function StudioBundleDownload({ result, onPreparing, onDownloadRequested }) {
  const id = useId();
  const [status, setStatus] = useState('idle');
  const operation = useRef(null);
  const urls = useRef(new Map());
  useEffect(() => {
    const clear = () => {
      operation.current?.abort();
      operation.current = null;
      for (const [url, timer] of urls.current) {
        clearTimeout(timer);
        URL.revokeObjectURL(url);
      }
      urls.current.clear();
      onPreparing?.(false);
    };
    window.addEventListener('pagehide', clear);
    return () => { window.removeEventListener('pagehide', clear); clear(); };
  }, []);
  const download = async () => {
    if (operation.current || !result.gift) return;
    const controller = new AbortController();
    operation.current = controller;
    onPreparing?.(true);
    setStatus('preparing');
    try {
      const { prepareStudioRecordingBundle, studioBundleFilename } = await import('../lib/studioRecordingBundle.js');
      controller.signal.throwIfAborted();
      const blob = await prepareStudioRecordingBundle(result, controller.signal);
      controller.signal.throwIfAborted();
      const url = URL.createObjectURL(blob);
      urls.current.set(url, setTimeout(() => {
        URL.revokeObjectURL(url);
        urls.current.delete(url);
      }, 60000));
      const link = document.createElement('a');
      link.href = url;
      link.download = studioBundleFilename(result.gift.writtenName);
      document.body.append(link);
      try { link.click(); } finally { link.remove(); }
      setStatus('requested');
      onDownloadRequested?.();
    } catch {
      if (!controller.signal.aborted) setStatus('error');
    } finally {
      if (operation.current === controller) {
        operation.current = null;
        onPreparing?.(false);
      }
    }
  };
  return <div className="smw-bundle-download">
    <button type="button" className="smw-button smw-button-download"
      onClick={download} disabled={!result.gift || status === 'preparing'}
      aria-busy={status === 'preparing'} aria-describedby={id}>
      {status === 'preparing' ? 'Preparing ZIP…' : status === 'error' ? 'Retry Download All' : 'Download All'}
      <span aria-hidden="true">↓</span>
    </button>
    <p id={id} role={status === 'error' ? 'alert' : 'status'}>
      {status === 'preparing' ? 'Preparing the MP3 and three gifts locally in your browser…'
        : status === 'error' ? 'Could not prepare the ZIP. Retry Download All; audio and individual gift downloads are unaffected. No creation allowance is used.'
          : status === 'requested' ? 'ZIP download requested. Check your browser’s downloads; this does not confirm it was saved.'
            : !result.gift ? 'Completed gifts are unavailable. You can still download your audio.'
              : 'Download All includes this MP3, certificate PDF, personalised letter PDF and Santa-picture PNG in one ZIP.'}
    </p>
  </div>;
}
