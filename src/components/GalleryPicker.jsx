import { useEffect, useMemo, useRef, useState } from 'react';
import songs from '../data/songs.json';
import { artistGalleryImages } from '../data/artistGalleryImages.js';
import { gallerySelection, managedArtistGallery } from '../data/managedArtistGallery.js';
import { fallbackArtwork } from '../data/artistArtwork.js';
import { songArtworkCandidates } from '../data/songArtwork.js';
import { fetchCatalogueArtwork } from '../hooks/useCatalogueArtwork.js';
import './GalleryPicker.css';

function Thumbnail({ sources, name, enlarge }) {
  const [index, setIndex] = useState(0);
  return <button type="button" className="gallery-picker__image" aria-label={`Enlarge ${name}`} onClick={() => enlarge(sources[index], name)}>
    <img src={sources[index]} alt={name} loading="lazy" width="200" height="200"
      onError={() => setIndex(n => Math.min(n + 1, sources.length - 1))} />
  </button>;
}

export default function GalleryPicker({ ownerToken }) {
  const [data, setData] = useState(null), [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0), [query, setQuery] = useState(''), [filter, setFilter] = useState('all');
  const [limit, setLimit] = useState(36), [pending, setPending] = useState(new Set()), [notice, setNotice] = useState('');
  const locks = useRef(new Set()), dialog = useRef(null), trigger = useRef(null);
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    let active = true;
    setError('');
    fetchCatalogueArtwork(true).then(value => { if (active) setData(value); }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [attempt]);
  const rows = useMemo(() => {
    if (!data) return [];
    const selected = new Map(managedArtistGallery(data).map(image => [image.galleryId ?? image.songId, image]));
    const originals = new Map(artistGalleryImages.map(image => [image.galleryId ?? image.songId, image]));
    const recordings = songs.map(song => ({ id: song.id, artist: song.artist, title: song.song, song }));
    for (const image of artistGalleryImages.filter(image => image.galleryId)) recordings.push({ id: image.galleryId, artist: image.artist, title: image.title ? image.title + (image.songId ? ' (alternate picture)' : '') : 'Artist picture' });
    return recordings.map(row => {
      const original = originals.get(row.id);
      const sources = [...new Set([selected.get(row.id)?.src, data.recordings?.[row.id]?.path, original?.src,
        ...(row.song ? songArtworkCandidates(row.song, undefined, data) : [fallbackArtwork])].filter(Boolean))];
      return { ...row, sources, included: gallerySelection(row.id, data) };
    }).filter(row => row.sources[0] !== fallbackArtwork)
      .sort((a,b) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title));
  }, [data]);
  const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const visible = rows.filter(row => (filter === 'all' || row.included === (filter === 'selected')) &&
    terms.every(term => `${row.artist} ${row.title}`.toLocaleLowerCase().includes(term)));
  async function toggle(row, enabled) {
    if (locks.current.has(row.id)) return;
    locks.current.add(row.id); setPending(new Set(locks.current)); setError(''); setNotice('');
    const scope = data.gallery?.[row.id]?.scope || 'song';
    try {
      const response = await fetch('/api/catalogue-artwork', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer studio-owner.' + ownerToken },
        body: JSON.stringify({ id: row.id, scope, includeInGallery: enabled }), signal: AbortSignal.timeout(20000),
      });
      const result = await response.json();
      if (!response.ok || !result.gallery) throw new Error(result.error || 'Selection could not be saved.');
      setData(previous => {
        const gallery = { ...previous.gallery };
        for (const alternate of artistGalleryImages.filter(image => image.galleryId && image.songId === row.id)) {
          gallery[alternate.galleryId] ??= { enabled: gallerySelection(alternate.galleryId, previous), scope: 'song' };
        }
        gallery[row.id] = result.gallery;
        return { ...previous, gallery };
      });
      setNotice(`${row.artist} — ${row.title}: ${enabled ? 'added to' : 'removed from'} gallery.`);
    } catch (err) { setError(`${row.artist}: ${err.name === 'TimeoutError' ? 'Save timed out. Reopen the picker to check before retrying.' : err.message}`); }
    finally { locks.current.delete(row.id); setPending(new Set(locks.current)); }
  }
  if (!data) return <div>{error ? <p role="alert">{error} <button type="button" onClick={() => setAttempt(n=>n+1)}>Try again</button></p> : <p role="status">Loading gallery choices…</p>}</div>;
  return <div className="gallery-picker">
    <p>Tick the pictures you want in the gallery. Existing choices are already ticked. Each change saves immediately. Song titles help you choose the right recording.</p>
    <label htmlFor="gallery-picker-search">Find artist or song</label>
    <input id="gallery-picker-search" type="search" value={query} onChange={e=>{setQuery(e.target.value);setLimit(36);}} />
    <label htmlFor="gallery-picker-filter">Show</label>
    <select id="gallery-picker-filter" value={filter} onChange={e=>{setFilter(e.target.value);setLimit(36);}}>
      <option value="all">All pictures</option><option value="selected">In gallery</option><option value="unselected">Not in gallery</option>
    </select>
    <p>{rows.filter(row=>row.included).length} selected · {visible.length} matching choices</p>
    <p role="status">{pending.size ? `Saving ${pending.size} change${pending.size === 1 ? '' : 's'}…` : notice}</p>
    {error && <p role="alert">{error}</p>}
    <div className="gallery-picker__grid">{visible.slice(0,limit).map(row => <article key={row.id} className={`gallery-picker__card${row.included ? ' gallery-picker__card--selected' : ''}`}>
      <Thumbnail key={row.sources.join('|')} sources={row.sources} name={`${row.artist} — ${row.title}`} enlarge={(src,name)=>{trigger.current=document.activeElement;setPreview({src,name});dialog.current.showModal();}} />
      <strong>{row.artist}</strong><span>{row.title}</span>
      <label><input type="checkbox" checked={row.included} disabled={pending.has(row.id)} aria-label={`Include ${row.artist} — ${row.title} in gallery`} onChange={e=>toggle(row,e.target.checked)} />{pending.has(row.id) ? 'Saving…' : 'In gallery'}</label>
    </article>)}</div>
    {!visible.length && <p>No matching artwork.</p>}
    {visible.length > limit && <button type="button" onClick={()=>setLimit(n=>n+36)}>Show more pictures</button>}
    <dialog ref={dialog} className="gallery-picker__zoom" aria-label="Artwork preview" onClose={()=>trigger.current?.focus()} onClick={e=>{if(e.target===e.currentTarget)dialog.current.close();}}>
      <button type="button" onClick={()=>dialog.current.close()}>Close ×</button>
      {preview && <><img src={preview.src} alt={preview.name} /><p>{preview.name}</p></>}
    </dialog>
  </div>;
}
