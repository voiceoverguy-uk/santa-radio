import { useEffect, useRef, useState } from 'react';
import CertificateName from '../components/CertificateName.jsx';
import '../components/SantaStudioGifts.css';

function CertificateArt({ name, naughty, days }) {
  const daysText = `${days} ${days === 1 ? 'DAY' : 'DAYS'} TO GO`;
  return <div className="studio-certificate" role="img"
    aria-label={`Head Elf’s very unofficial ${naughty ? 'Naughty' : 'Nice'} List certificate for ${name}${naughty ? `. ${daysText}. THERE IS STILL TIME` : ''}`}>
    <img src={`/certificates/checker/${naughty ? 'naughty' : 'nice'}-master.webp`}
      alt="" width="1684" height="1191" draggable={false} />
    <CertificateName name={name}>
      {text => <span className="studio-script-reveal">{text}</span>}
    </CertificateName>
    {naughty && <p className="nn-certificate-stamp" aria-hidden="true">
      <span className="nn-stamp-days">{daysText}</span>
      <span className="nn-stamp-message">THERE IS STILL TIME</span>
    </p>}
  </div>;
}

export default function CheckerCertificate({ name, result, days }) {
  const naughty = result === 'naughty';
  const [expanded, setExpanded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const trigger = useRef(null);
  const dialog = useRef(null);
  const backdropPress = useRef(false);
  const download = useRef(null);
  const downloadUrl = useRef(null);
  useEffect(() => () => {
    download.current?.abort();
    if (downloadUrl.current) {
      clearTimeout(downloadUrl.current.timer);
      URL.revokeObjectURL(downloadUrl.current.url);
    }
  }, []);
  useEffect(() => {
    if (!expanded) return;
    const modal = dialog.current;
    const overflow = document.body.style.overflow;
    modal.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      if (modal.open) modal.close();
      document.body.style.overflow = overflow;
    };
  }, [expanded]);
  const savePdf = async () => {
    if (download.current) return;
    const controller = new AbortController();
    download.current = controller;
    setDownloading(true); setError('');
    try {
      const { exportCheckerCertificate } = await import('./exportNaughtyCertificate.js');
      if (controller.signal.aborted) return;
      const blob = await exportCheckerCertificate(name, result, days, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (downloadUrl.current) {
        clearTimeout(downloadUrl.current.timer);
        URL.revokeObjectURL(downloadUrl.current.url);
      }
      const url = URL.createObjectURL(blob);
      downloadUrl.current = { url, timer: setTimeout(() => {
        URL.revokeObjectURL(url); downloadUrl.current = null;
      }, 60000) };
      const link = document.createElement('a');
      link.href = url; link.download = `Head-Elf-${naughty ? 'Naughty' : 'Nice'}-List-Certificate.pdf`;
      document.body.append(link); link.click(); link.remove();
    } catch (failure) {
      if (!controller.signal.aborted)
        setError('The PDF could not be created. Please try downloading again.');
    } finally {
      if (!controller.signal.aborted) {
        download.current = null; setDownloading(false);
      }
    }
  };
  const previewClass = `nn-certificate-preview${naughty ? ' nn-certificate-preview--naughty' : ''}`;
  const pdfControl = <div className="nn-certificate-download">
    <button type="button" className="nn-secondary" disabled={downloading} onClick={savePdf}>
      {downloading ? 'Creating PDF…' : `Download ${naughty ? 'Naughty' : 'Nice'} certificate PDF`}
    </button>
    {downloading && <p role="status">Creating your PDF in this browser…</p>}
    {error && <p role="alert" className="nn-error">{error}</p>}
  </div>;
  return <div className="nn-certificate-gift">
    <div className={previewClass}>
      <CertificateArt name={name} naughty={naughty} days={days} />
      <button ref={trigger} type="button" className="nn-certificate-enlarge"
        aria-label={`Enlarge ${naughty ? 'Naughty' : 'Nice'} List certificate`} aria-haspopup="dialog"
        onClick={() => setExpanded(true)}><span>Enlarge certificate</span></button>
    </div>
    {pdfControl}
    <dialog ref={dialog} className={`nn-certificate-dialog${naughty ? ' nn-certificate-dialog--naughty' : ''}`}
      aria-label={`${naughty ? 'Naughty' : 'Nice'} List certificate preview`}
      onKeyDown={event => {
        if (event.key !== 'Tab') return;
        const controls = [...event.currentTarget.querySelectorAll('button:not(:disabled)')];
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first?.focus();
        }
      }}
      onClose={() => { setExpanded(false); trigger.current?.focus({ preventScroll: true }); }}
      onPointerDown={event => { backdropPress.current = event.target === event.currentTarget; }}
      onClick={event => {
        if (backdropPress.current && event.target === event.currentTarget) dialog.current.close();
        backdropPress.current = false;
      }}>
      {expanded && <>
        <div className="nn-certificate-dialog-toolbar">
          <h2>{naughty ? 'Naughty' : 'Nice'} List certificate</h2>
          <button type="button" className="nn-secondary" autoFocus onClick={() => dialog.current.close()}
            aria-label="Close certificate preview">Close</button>
        </div>
        <div className="nn-certificate-dialog-artwork">
          <div className={previewClass}><CertificateArt name={name} naughty={naughty} days={days} /></div>
        </div>
        {pdfControl}
      </>}
    </dialog>
  </div>;
}
