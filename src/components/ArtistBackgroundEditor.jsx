import { useEffect, useRef, useState } from 'react';
import { publishArtistBackground } from '../hooks/useArtistBackground.js';
import './ArtistBackgroundEditor.css';
const searchable = value => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();

export default function ArtistBackgroundEditor({ ownerToken }) {
  const [artists, setArtists] = useState([]);
  const [selected, setSelected] = useState('');
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const mounted = useRef(false);
  const position = artists.findIndex(artist => artist.key === selected);
  const artist = artists[position];
  const dirty = !!artist && draft !== artist.text;
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    setLoading(true); setError('');
    fetch('/api/artist-backgrounds?edit=1', { headers: { Authorization: `Bearer studio-owner.${ownerToken}` },
      cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) }).then(async response => {
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.artists)) throw Error(data.error || 'Could not load artist backgrounds.');
      if (controller.signal.aborted) return;
      setArtists(data.artists);
      setSelected(data.artists[0]?.key || ''); setDraft(data.artists[0]?.text || '');
    }).catch(error => { if (!controller.signal.aborted) setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { mounted.current = false; controller.abort(); };
  }, [ownerToken, retry]);
  useEffect(() => {
    if (!dirty) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function choose(next) {
    if (!next || busy || next.key === selected) return;
    if (dirty && !window.confirm('Discard your unsaved background changes?')) return;
    setSelected(next.key); setDraft(next.text); setQuery(''); setNotice(''); setError('');
  }
  async function save(event) {
    event.preventDefault();
    if (!artist || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/artist-backgrounds', { method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer studio-owner.${ownerToken}` },
        signal: AbortSignal.timeout(15000), body: JSON.stringify({ key: artist.key, text: draft, revision: artist.revision }) });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'Could not save. Your text is still here.');
      if (!mounted.current) return;
      setArtists(rows => rows.map(row => row.key === artist.key ? { ...row, text: data.text, revision: data.revision } : row));
      setDraft(data.text); publishArtistBackground(artist.key, data.text);
      setNotice(`Saved for ${artist.artist} across ${artist.songCount} song ${artist.songCount === 1 ? 'page' : 'pages'}.`);
    } catch (error) { if (mounted.current) setError(error.message); }
    finally { if (mounted.current) setBusy(false); }
  }
  async function reloadSaved() {
    if (dirty && !window.confirm('Replace your unsaved changes with the latest saved background?')) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/artist-backgrounds?edit=1', { headers: { Authorization: `Bearer studio-owner.${ownerToken}` }, cache: 'no-store', signal: AbortSignal.timeout(15000) });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'Could not reload.');
      if (!mounted.current) return;
      const latest = data.artists.find(row => row.key === selected);
      setArtists(data.artists); setDraft(latest?.text || ''); setNotice('Saved background reloaded.');
    } catch (error) { if (mounted.current) setError(error.message); }
    finally { if (mounted.current) setBusy(false); }
  }
  const matches = query.trim() ? artists.filter(row => searchable(row.artist).includes(searchable(query.trim()))) : [];
  return <section className="artist-background-editor" aria-labelledby="artist-background-title">
    <h2 id="artist-background-title">Artist backgrounds</h2>
    <p>Edit the background shown on an artist’s song pages.</p>
    {loading && <p role="status">Loading artists…</p>}
    {error && <p role="alert">{error}</p>}
    {!loading && !artists.length && <button onClick={() => setRetry(value => value + 1)}>Try again</button>}
    {!!artists.length && <>
      <label htmlFor="background-search">Find an artist</label>
      <input id="background-search" type="search" autoComplete="off" value={query} disabled={busy}
        placeholder="Start typing an artist name" onChange={event => setQuery(event.target.value)} />
      {query.trim() && <div className="artist-background-editor__results">
        <p role="status">{matches.length} {matches.length === 1 ? 'artist' : 'artists'} found{matches.length > 30 ? ' — showing the first 30; keep typing to narrow the list' : ''}.</p>
        <ul aria-label="Matching artists">{matches.slice(0, 30).map(row => <li key={row.key}>
          <button type="button" onClick={() => choose(row)} disabled={busy}>{row.artist}</button>
        </li>)}</ul>
      </div>}
      {artist && <form onSubmit={save}>
        <div className="artist-background-editor__navigation">
          <button type="button" disabled={busy || position <= 0} onClick={() => choose(artists[position - 1])}>← Previous artist</button>
          <span>{position + 1} of {artists.length}</span>
          <button type="button" disabled={busy || position >= artists.length - 1} onClick={() => choose(artists[position + 1])}>Next artist →</button>
        </div>
        <h3>{artist.artist}</h3>
        <label htmlFor="artist-background-text">Artist background</label>
        <textarea id="artist-background-text" value={draft} disabled={busy} maxLength={8000} rows={9}
          onChange={event => { setDraft(event.target.value); setNotice(''); }} required />
        <p className="artist-background-editor__hint">{draft.length.toLocaleString()} / 8,000 characters{dirty ? ' · Unsaved changes' : ''}</p>
        <div className="artist-background-editor__actions">
          <button type="submit" disabled={busy || !dirty || !draft.trim()}>{busy ? 'Saving…' : 'Save background'}</button>
          <button type="button" disabled={busy} onClick={reloadSaved}>Reload saved text</button>
        </div>
        <p role="status">{notice}</p>
      </form>}
    </>}
  </section>;
}
