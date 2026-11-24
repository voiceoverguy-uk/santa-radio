import { useEffect, useRef, useState } from 'react';
import { drawStitcherImage, selectStitcherFiles, stitcherArguments } from '../lib/bigStitcher.js';
import './BigStitcher.css';
import { audioDuration, encodingProgress } from '../lib/videoProgress.js';

function useMediaUrl(file) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!file) { setUrl(''); return; }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

async function prepareArtwork(file, name) {
  const image = new Image();
  const url = file ? URL.createObjectURL(file) : '/images/big-stitcher-christmas-v3.png';
  try {
    image.src = url;
    try {
      await image.decode();
    } catch {
      throw new Error('This image could not be opened. Please choose another image.');
    }
    const canvas = document.createElement('canvas');
    drawStitcherImage(canvas, image, name, !file);
    const png = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!png) throw new Error('Unable to prepare the image. Please try another image.');
    return png;
  } finally {
    if (file) URL.revokeObjectURL(url);
  }
}

export default function BigStitcher() {
  const [files, setFiles] = useState({});
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [output, setOutput] = useState(null);
  const picker = useRef(null), dropButton = useRef(null), encoder = useRef(null), run = useRef(0);
  const audioUrl = useMediaUrl(files.audio);
  const outputUrl = useMediaUrl(output?.video);
  const posterUrl = useMediaUrl(output?.artwork);
  useEffect(() => () => { run.current++; encoder.current?.terminate(); }, []);

  function closeResult() {
    setOutput(null);
    setFiles({});
    setName('');
    setProgress(null);
    setStatus('');
    setError('');
    setDragging(false);
    dropButton.current?.focus();
  }

  function choose(incoming) {
    if (busy) return;
    try {
      const next = selectStitcherFiles(Array.from(incoming));
      setFiles(previous => ({ ...previous, ...next }));
      setOutput(null); setStatus(''); setError('');
    } catch (e) { setError(e.message); }
  }
  function cancel() {
    run.current++; encoder.current?.terminate(); encoder.current = null;
    setBusy(false); setStatus('Cancelled. Your files are ready to try again.');
  }
  async function stitch() {
    if (busy || !files.audio) return;
    const version = ++run.current;
    setBusy(true); setProgress(null); setError(''); setOutput(null); setStatus('Loading the video maker…');
    let ffmpeg;
    try {
      const png = await prepareArtwork(files.image, name);
      if (version !== run.current) return;
      const [{ FFmpeg }, { default: coreURL }, { default: wasmURL }] = await Promise.all([
        import('@ffmpeg/ffmpeg'), import('@ffmpeg/core?url'), import('@ffmpeg/core/wasm?url'),
      ]);
      if (version !== run.current) return;
      const duration = await audioDuration(files.audio);
      if (version !== run.current) return;
      ffmpeg = new FFmpeg(); encoder.current = ffmpeg;
      ffmpeg.on('progress', ({ time }) => { if (version === run.current) setProgress(encodingProgress(time, duration)); });
      await ffmpeg.load({ coreURL, wasmURL });
      if (version !== run.current) return;
      setProgress(duration > 0 ? 0 : null); setStatus('Stitching your MP4… Keep this tab open.');
      await ffmpeg.writeFile('image.png', new Uint8Array(await png.arrayBuffer()));
      await ffmpeg.writeFile('audio.mp3', new Uint8Array(await files.audio.arrayBuffer()));
      const result = await ffmpeg.exec(stitcherArguments);
      if (result !== 0) throw new Error('The MP3 could not be converted. Check that it plays correctly and try again.');
      if (version === run.current) { setProgress(0.97); setStatus('Finishing your MP4…'); }
      const data = await ffmpeg.readFile('output.mp4');
      if (version !== run.current) return;
      setOutput({ video: new Blob([data], { type: 'video/mp4' }), artwork: png });
      setProgress(1); setStatus('Your MP4 is ready to preview and download.');
    } catch (e) {
      if (version === run.current) { setError(e.message || 'The video maker could not finish. Try a smaller file or reload and try again.'); setStatus(''); }
    } finally {
      ffmpeg?.terminate();
      if (version === run.current) { encoder.current = null; setBusy(false); }
    }
  }
  const filename = `${(name.trim() || files.audio?.name.replace(/\.mp3$/i, '') || 'the-big-stitcher').replace(/[^a-z0-9 _-]/gi, '').trim() || 'the-big-stitcher'}.mp4`;
  return <section className="big-stitcher" aria-labelledby="big-stitcher-title">
    <header><p>IMAGE + NAME + AUDIO</p><h2 id="big-stitcher-title">The Big Stitcher</h2></header>
    <p>Add an MP3 and a name to our festive Santa Radio image, or drop in your own image to replace it.</p>
    <button ref={dropButton} type="button" className={`big-stitcher__drop${dragging ? ' is-dragging' : ''}`} disabled={busy}
      onClick={() => picker.current.click()} onDragOver={e => { e.preventDefault(); if (!busy) setDragging(true); }}
      onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); choose(e.dataTransfer.files); }}>
      <strong>Drop your MP3 and optional image here</strong><span>Both together or one at a time · or click to choose</span>
      <small>JPG, PNG or WebP up to 20 MB · MP3 up to 100 MB</small>
    </button>
    <input ref={picker} type="file" hidden multiple accept=".mp3,.jpg,.jpeg,.png,.webp" onChange={e => { choose(e.target.files); e.target.value = ''; }} />
    <div className="big-stitcher__files">{['image', 'audio'].map(kind => <div key={kind}><strong>{kind === 'image' ? 'Image' : 'MP3'}:</strong> {files[kind]?.name || (kind === 'image' ? 'Santa Radio Christmas · 16:9 (default)' : 'Not selected')} {files[kind] && <button type="button" disabled={busy} onClick={() => { setFiles(previous => ({ ...previous, [kind]: null })); setOutput(null); setStatus(''); setError(''); }}>{kind === 'image' ? 'Use Santa Radio image' : 'Remove audio'}</button>}</div>)}</div>
    <label htmlFor="stitcher-name">Name on the image (optional)</label>
    <input id="stitcher-name" value={name} maxLength={80} disabled={busy} placeholder="e.g. Oliver" onChange={e => { setName(e.target.value); setOutput(null); setStatus(''); }} />
    {audioUrl && <audio controls src={audioUrl} aria-label="Selected MP3 preview" />}
    <div className="big-stitcher__actions"><button type="button" disabled={busy || !files.audio} onClick={stitch}>{busy ? 'Making your MP4…' : 'Create MP4'}</button>{busy && <button type="button" onClick={cancel}>Cancel</button>}</div>
    <p className="big-stitcher__note">Your files stay in this browser. The first conversion downloads the video maker (about 32 MB). Large recordings take longer; keep this tab open.</p>
    {(busy || output) && <div className="big-stitcher__progress"><progress aria-label="MP4 creation progress" max="1" value={progress ?? undefined} /><span>{progress === null ? 'Loading video maker…' : `${Math.floor(progress * 100)}%`}</span></div>}
    <p role="status" aria-live="polite">{status}</p>{error && <p role="alert">{error}</p>}
    {output && outputUrl && posterUrl && <div className="big-stitcher__result">
      <div className="big-stitcher__preview">
        <video controls playsInline src={outputUrl} poster={posterUrl} aria-label="Finished MP4 preview" />
        <button type="button" className="big-stitcher__close" onClick={closeResult} aria-label="Close preview and reset Big Stitcher" title="Close preview and reset Big Stitcher">×</button>
      </div>
      <a href={outputUrl} download={filename}>Download MP4</a>
    </div>}
  </section>;
}
