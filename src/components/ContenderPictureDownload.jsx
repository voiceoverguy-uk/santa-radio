import { useEffect, useRef, useState } from 'react';

export default function ContenderPictureDownload({ entry }) {
  const dialog = useRef(null);
  const attempt = useRef(0);
  const [preview, setPreview] = useState(null);
  const [message, setMessage] = useState('');
  useEffect(() => () => { attempt.current++; }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function download() {
    const modal = dialog.current;
    modal.showModal();
    const ticket = ++attempt.current;
    setMessage('Preparing your voting image…');
    try {
      const rendererUrl = '/contenders/render-picture.js';
      const { votingPicture } = await import(/* @vite-ignore */ rendererUrl);
      const blob = await votingPicture(entry);
      if (ticket !== attempt.current || !modal.open) return;
      const url = URL.createObjectURL(blob);
      setPreview(url);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'Santa-Radio-' + entry.id + '.png';
      modal.appendChild(link);
      link.click();
      link.remove();
      setMessage('Your voting image is ready. Download started.');
    } catch {
      if (ticket === attempt.current) setMessage('The image could not be prepared. Close this preview and try again.');
    }
  }

  return <>
    <button className="contender-share" type="button" onClick={download}>Download voting image</button>
    <dialog ref={dialog} aria-label={'Voting image for ' + entry.title}
      style={{width:'min(90vw, 480px)',boxSizing:'border-box',border:'1px solid #cfad67',borderRadius:16,background:'#10382a',color:'#fff6db',textAlign:'center'}}
      onClose={() => { attempt.current++; setPreview(null); }}>
      <form method="dialog" style={{textAlign:'right'}}><button type="submit" autoFocus>Close</button></form>
      <p role="status">{message}</p>
      {preview && <>
        <img src={preview} alt={'Up vote ' + entry.title + ' by ' + entry.artist}
          style={{display:'block',width:'100%',height:'auto',maxHeight:'60dvh',objectFit:'contain'}} />
        <a href={preview} download={'Santa-Radio-' + entry.id + '.png'} style={{color:'#f5d58e'}}>Download again</a>
      </>}
    </dialog>
  </>;
}
