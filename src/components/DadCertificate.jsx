import {useEffect, useId, useState} from 'react';
import './DadCertificate.css';

export default function DadCertificate({name = 'Dad', downloadable = false}) {
  const id = useId();
  const [style, setStyle] = useState('dad');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const recipient = name.trim() || 'Dad';
  useEffect(() => {
    if (!downloadable) return;
    let cancelled = false, objectURL;
    setUrl(''); setError('');
    (async () => {
      const image = new Image();
      image.src = `/certificates/dad/${style === 'dad' ? 'dad-hand-drawn' : 'name-template'}.webp`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      if (style === 'name') {
        await document.fonts.load('700 200px "DadHandwriting"');
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
      objectURL = URL.createObjectURL(blob); setUrl(objectURL);
    })().catch(() => {if (!cancelled) setError('The certificate could not load. Please switch the name option to retry.');});
    return () => {cancelled = true; if (objectURL) URL.revokeObjectURL(objectURL);};
  }, [downloadable, style, recipient]);
  return <section className="dad-certificate" aria-labelledby={`${id}-title`}>
    <h3 id={`${id}-title`}>His Nice-ish List certificate</h3>
    {downloadable && <fieldset><legend>What name would you like on your certificate?</legend>
      <label><input type="radio" name={id} checked={style === 'dad'} onChange={() => setStyle('dad')}/> Dad</label>
      <label><input type="radio" name={id} checked={style === 'name'} onChange={() => setStyle('name')}/> {recipient}</label>
      {url && <a className="dad-primary" href={url} download={`Santa-certificate-${style === 'dad' ? 'Dad' : recipient.replace(/[^\p{L}\p{N}-]/gu, '-')}.png`}>Download his certificate ↓</a>}
    </fieldset>}
    {!downloadable ? <img src="/certificates/dad/dad-hand-drawn.webp" alt="Nice-ish List certificate for Dad" width="1491" height="1055"/> : url ? <img src={url} alt={`Nice-ish List certificate for ${style === 'dad' ? 'Dad' : recipient}`} width="1491" height="1055"/> : <p role="status">{error || 'Preparing his certificate…'}</p>}
  </section>;
}
