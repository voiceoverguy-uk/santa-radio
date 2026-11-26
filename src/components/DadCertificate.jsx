import {useEffect, useId, useState} from 'react';
import './DadCertificate.css';

export default function DadCertificate({name = 'Dad', downloadable = false, onReady}) {
  const id = useId();
  const [style, setStyle] = useState('dad');
  const [urls, setUrls] = useState({});
  const [blobs, setBlobs] = useState({});
  const [attempt, setAttempt] = useState(0);
  const url = urls[style];
  const [error, setError] = useState('');
  const recipient = name.trim() || 'Dad';
  useEffect(() => {
    if (!downloadable) return;
    let cancelled = false; const objectURLs = []; const prepared = {};
    setUrls({}); setError('');
    Promise.all(['dad', 'name'].map(async variant => {
      const image = new Image();
      image.src = `/certificates/dad/${variant === 'dad' ? 'dad-hand-drawn' : 'name-template'}.webp`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      if (variant === 'name') {
        await document.fonts.load('700 200px "DadHandwriting"');
        ctx.font = `700 ${canvas.height * .06}px "DadHandwriting"`;
        ctx.fillStyle = '#18563d';
        ctx.textBaseline = 'middle';
        ctx.fillText('Dad', canvas.width * .766, canvas.height * .17);
        let size = canvas.height * .26;
        ctx.font = `700 ${size}px "DadHandwriting"`;
        while (ctx.measureText(recipient).width > canvas.width * .44 && size > 20) {
          size -= 2; ctx.font = `700 ${size}px "DadHandwriting"`;
        }
        ctx.fillStyle = '#bd161c'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(recipient, canvas.width * .49, canvas.height * .355);
      }
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw Error('Could not prepare the certificate.');
      if (cancelled) return;
      prepared[variant] = blob;
      const objectURL = URL.createObjectURL(blob); objectURLs.push(objectURL);
      const preview = new Image(); preview.src = objectURL; await preview.decode();
      return [variant, objectURL];
    })).then(entries => { if (!cancelled) {setUrls(Object.fromEntries(entries));setBlobs(prepared);} }).catch(() => {if (!cancelled) setError('The certificates could not load. Please retry.');});
    return () => {cancelled = true; objectURLs.forEach(url => URL.revokeObjectURL(url));};
  }, [downloadable, recipient, attempt]);
  useEffect(()=>{onReady?.(blobs[style] || null);},[blobs,style,onReady]);
  return <section className="dad-certificate" aria-labelledby={`${id}-title`}>
    <div className="dad-certificate-heading"><h3 id={`${id}-title`}>His Nice-ish List certificate</h3>
    {downloadable && <fieldset aria-label="Name on the certificate">
      <label><input type="radio" disabled={!urls.dad || !urls.name} name={id} checked={style === 'dad'} onChange={() => setStyle('dad')}/> Dad</label>
      <label><input type="radio" disabled={!urls.dad || !urls.name} name={id} checked={style === 'name'} onChange={() => setStyle('name')}/> {recipient}</label>
    </fieldset>}</div>
    <div className="dad-certificate-preview">
      {!downloadable ? <img src="/certificates/dad/dad-hand-drawn.webp" alt="Nice-ish List certificate for Dad" width="1491" height="1055"/> : urls.dad && urls.name ? ['dad','name'].map(variant => <img key={variant} src={urls[variant]} hidden={style!==variant} alt={`Nice-ish List certificate for ${variant === 'dad' ? 'Dad' : recipient}`} width="1491" height="1055"/>) : <div role="status"><p>{error || 'Preparing his certificates…'}</p>{error && <button type="button" onClick={()=>setAttempt(value=>value+1)}>Retry certificates</button>}</div>}
    </div>
    <div className="dad-certificate-download">{url && <a className="dad-primary" href={url} download={`Santa-certificate-${style === 'dad' ? 'Dad' : recipient.replace(/[^\p{L}\p{N}-]/gu, '-')}.png`}>Download {style === 'dad' ? 'Dad' : recipient}’s certificate ↓</a>}</div>
  </section>;
}
