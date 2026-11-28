import { useEffect, useRef, useState } from 'react';
import songs from '../data/songs.json';
import { fallbackArtwork, normalizeArtistName } from '../data/artistArtwork.js';
import { artistArtworkCandidates, songArtworkCandidates } from '../data/songArtwork.js';
import { fetchCatalogueArtwork } from '../hooks/useCatalogueArtwork.js';
import { gallerySelection } from '../data/managedArtistGallery.js';
import { prepareCatalogueArtwork } from '../lib/prepareCatalogueArtwork.js';
import './CatalogueArtworkManager.css';

const searchText = text => normalizeArtistName(text).replace(/[’‘']/g, '');
const catalogue = songs.map(({id, artist, song}) => ({ id, artist, song, search: searchText(artist + ' ' + song) }))
  .sort((a, b) => a.artist.localeCompare(b.artist, 'en') || a.song.localeCompare(b.song, 'en') || a.id - b.id);
const labels = new Set(), duplicateLabels = new Set();
for (const row of catalogue) {
  if (labels.has(row.search)) duplicateLabels.add(row.search);
  labels.add(row.search);
}
function title(row) {
  return row.song + (duplicateLabels.has(row.search) ? ' (#' + row.id + ')' : '');
}

function ArtworkPreview({ src, alt, caption, onError }) {
  const dialog = useRef(null);
  const trigger = useRef(null);
  return <figure>
    {src ? <>
      <button type="button" ref={trigger} className="catalogue-art__thumbnail" aria-haspopup="dialog"
        aria-label={'Enlarge ' + alt} onClick={() => dialog.current.showModal()}>
        <img src={src} alt={alt} width="180" height="180" onError={onError} />
      </button>
      <dialog ref={dialog} className="catalogue-art__zoom" aria-label={alt}
        onClose={() => trigger.current?.focus({ preventScroll: true })}
        onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
        <button className="catalogue-art__close" type="button" aria-label="Close enlarged artwork"
          onClick={() => dialog.current.close()}>Close ×</button>
        <button className="catalogue-art__zoom-image" type="button" aria-label="Return to thumbnail"
          onClick={() => dialog.current.close()}>
          <img src={src} alt={alt} width="540" height="540" />
        </button>
      </dialog>
    </> : <p>Image unavailable</p>}
    <figcaption>{caption}</figcaption>
  </figure>;
}

function ArtworkUpload({ song, scope, ownerToken, candidates, caption, initialIncluded, initialGalleryScope, onSaved, busy, setBusy }) {
  const input = useRef(null);
  const [preview, setPreview] = useState('');
  const [included, setIncluded] = useState(initialIncluded);
  const [savedIncluded, setSavedIncluded] = useState(initialIncluded);
  const [failedImages, setFailedImages] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const current = candidates.find(src => !failedImages.includes(src));
  const target = scope === 'song' ? title(song) : song.artist;

  async function choose(file) {
    setNotice(''); setError(''); setPreview('');
    if (!file) return;
    setBusy(true);
    try { setPreview(await prepareCatalogueArtwork(file)); }
    catch (err) { setError(err.message); input.current.value = ''; }
    finally { setBusy(false); }
  }
  async function publish() {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/catalogue-artwork', {
        method:'POST', headers:{'Content-Type':'application/json', Authorization:'Bearer studio-owner.' + ownerToken},
        body:JSON.stringify({ id:song.id, scope, includeInGallery:included, ...(preview ? { jpeg:preview.split(',')[1] } : {}) }), signal:AbortSignal.timeout(45000),
      });
      const result = await response.json();
      if (!response.ok || (!result.path && !result.gallery)) throw new Error(result.error || 'The changes were not saved.');
      onSaved(result);
      setSavedIncluded(included);
      setFailedImages([]); setPreview(''); input.current.value = '';
      setNotice((result.path ? 'Artwork saved. ' : '') + (included ? 'This song’s picture is included in the gallery.' : 'This song’s picture is not included in the gallery.'));
    } catch (err) { setError(err.name === 'TimeoutError' ? 'The upload timed out. Select the song again to check its artwork.' : err.message); }
    finally { setBusy(false); }
  }
  return <>
    <div className="catalogue-art__previews">
      <ArtworkPreview src={current} alt={'Current artwork for ' + target} caption={caption}
        onError={() => setFailedImages(previous => [...previous, current])} />
      {preview && <ArtworkPreview src={preview} alt={'Replacement artwork for ' + target} caption="New artwork preview" />}
    </div>
    <label>Choose new artwork <small>JPG, PNG or WebP · up to 20 MB · square centre crop</small>
      <input type="file" ref={input} disabled={busy} accept="image/jpeg,image/png,image/webp" onChange={event => choose(event.target.files[0])} />
    </label>
    <label className="catalogue-art__gallery"><input type="checkbox" checked={included} disabled={busy}
      onChange={event => setIncluded(event.target.checked)} />Include in gallery</label>
    <small>The gallery will show this picture with {song.artist} — {song.song}.</small>
    <button type="button" disabled={busy || (!preview && included === savedIncluded && (!included || scope === initialGalleryScope))} onClick={publish}>{busy ? 'Working…' : !preview ? 'Save gallery setting' : scope === 'song' ? 'Save song artwork' : 'Save artist default'}</button>
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
  </>;
}

function ArtworkEditor({ song, ownerToken, busy, setBusy }) {
  const [scope, setScope] = useState('song');
  const [data, setData] = useState(null), [error, setError] = useState(false), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError(false);
    fetchCatalogueArtwork(true).then(value => { if (active) setData(value); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [attempt]);
  if (!data) return error
    ? <p role="alert">Could not load the current artwork. <button type="button" onClick={() => setAttempt(n => n+1)}>Try again</button></p>
    : <p role="status">Loading current artwork…</p>;
  const key = normalizeArtistName(song.artist);
  const artistImages = artistArtworkCandidates(song.artist, data);
  const candidates = scope === 'artist' ? artistImages : songArtworkCandidates(song, undefined, data);
  const caption = candidates[0] === fallbackArtwork ? 'Current artwork · Santa Radio default'
    : candidates[0] === artistImages[0] ? 'Current artwork · artist default' : 'Current artwork · song-specific';
  function saved(result) {
    setData(previous => ({ ...previous,
      ...(result.path && scope === 'song' ? { recordings: { ...previous.recordings, [song.id]: { artist:song.artist, title:song.song, path:result.path } } } : {}),
      ...(result.path && scope === 'artist' ? { artists: { ...previous.artists, [key]:result.path } } : {}),
      ...(result.gallery ? { gallery: { ...previous.gallery, [song.id]: result.gallery } } : {}),
    }));
  }
  return <>
    <h3>{song.artist} — {title(song)}</h3>
    <fieldset disabled={busy} className="catalogue-art__scope">
      <legend>Apply artwork to</legend>
      {['song','artist'].map(value => <label key={value}><input type="radio" name={'artwork-scope-' + song.id}
        checked={scope === value} onChange={() => setScope(value)} />{value === 'song' ? 'This song only' : 'Artist default'}</label>)}
    </fieldset>
    {scope === 'artist' && <p>Songs by {song.artist} with their own artwork keep it.</p>}
    <ArtworkUpload key={scope} {...{song, scope, ownerToken, candidates, caption, busy, setBusy}} initialIncluded={gallerySelection(song.id, data)} initialGalleryScope={data.gallery?.[song.id]?.scope || 'song'} onSaved={saved} />
  </>;
}

export default function CatalogueArtworkManager({ ownerToken }) {
  const [query, setQuery] = useState(''), [selected, setSelected] = useState(null);
  const [limit, setLimit] = useState(8), [busy, setBusy] = useState(false);
  const terms = searchText(query).split(/\s+/).filter(Boolean);
  const matches = terms.length && !selected ? catalogue.filter(row => terms.every(term => row.search.includes(term))) : [];
  return <section id="catalogue-artwork" className="catalogue-art" aria-labelledby="catalogue-art-title">
    <h2 id="catalogue-art-title">Artist &amp; song artwork</h2>
    <label htmlFor="catalogue-art-search">Search by artist or song</label>
    <input id="catalogue-art-search" type="search" placeholder="e.g. Michael Bublé or Last Christmas" autoComplete="off"
      value={query} disabled={busy} onChange={e => { setQuery(e.target.value); setSelected(null); setLimit(8); }} />
    {!selected && terms.length > 0 && <>
      <p role="status">{matches.length ? matches.length + (matches.length === 1 ? ' recording' : ' recordings') : 'No matching recordings.'}</p>
      <ul className="catalogue-art__results">{matches.slice(0,limit).map(row =>
        <li key={row.id}><button type="button" onClick={() => setSelected(row)}><strong>{row.artist}</strong><span>{title(row)}</span></button></li>
      )}</ul>
      {matches.length > limit && <button type="button" onClick={() => setLimit(n => n+8)}>Show more songs</button>}
    </>}
    {selected && <>
      <button className="catalogue-art__back" type="button" disabled={busy} onClick={() => setSelected(null)}>Back to results</button>
      <ArtworkEditor key={selected.id} song={selected} ownerToken={ownerToken} busy={busy} setBusy={setBusy} />
    </>}
  </section>;
}
