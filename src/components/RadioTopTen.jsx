import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import SongArtwork from './SongArtwork.jsx';
import './RadioTopTen.css';

const TopTenContext = createContext(null);
const REQUEST_TIMEOUT = 12000;
const TOP_TEN_PANEL_ID = 'radio-yesterday-top-ten';

function formattedDate(date) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}

export function useRadioTopTen() {
  const context = useContext(TopTenContext);
  if (!context) throw new Error('useRadioTopTen must be used within RadioTopTenProvider');
  return context;
}

export function RadioTopTenProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [feed, setFeed] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const openerRef = useRef(null);
  const expandDockRef = useRef(null);
  const focusCloseRef = useRef(null);
  const requestRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const openRef = useRef(false);
  openRef.current = isOpen;

  const load = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    setLoading(true);
    setFeed(null);
    setError('');
    try {
      const response = await fetch('/api/radio-top-ten', {
        method: 'GET', cache: 'no-store', signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error('Yesterday’s listening report is temporarily unavailable.');
      const result = await response.json();
      if (!Array.isArray(result.songs) || !['inactive', 'initial', 'partial', 'complete', 'empty'].includes(result.state) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(result.date) ||
          !result.songs.every(song => typeof song.artist === 'string' && typeof song.title === 'string' &&
            Number.isInteger(song.count) && song.count > 0)) throw new Error('The listening report could not be read.');
      if (requestRef.current !== controller || controller.signal.aborted || !openRef.current) return;
      setFeed(result);
    } catch (cause) {
      if (requestRef.current === controller && openRef.current) {
        setError(cause.name === 'AbortError'
          ? 'That took too long. Please try again.' : cause.message || 'Could not load yesterday’s songs.');
      }
    } finally {
      window.clearTimeout(timeout);
      if (openRef.current && requestRef.current === controller) setLoading(false);
    }
  }, []);

  const open = useCallback((trigger, options = {}) => {
    if (options.expandDock) expandDockRef.current?.();
    openerRef.current = trigger || document.activeElement;
    if (openRef.current) {
      focusCloseRef.current?.();
      return;
    }
    openRef.current = true;
    setFeed(null);
    setError('');
    setIsOpen(true);
  }, []);

  const close = useCallback((options = {}) => {
    openRef.current = false;
    setIsOpen(false);
    requestRef.current?.abort();
    window.clearTimeout(refreshTimerRef.current);
    if (options.returnFocus === false) return;
    requestAnimationFrame(() => {
      const opener = openerRef.current;
      const isVisible = opener?.isConnected && opener.getClientRects().length > 0 &&
        getComputedStyle(opener).visibility !== 'hidden' && !opener.closest('[hidden]');
      if (isVisible) opener.focus();
      else document.querySelector('.radio-size-toggle')?.focus();
    });
  }, []);

  const registerDock = useCallback(actions => {
    if (actions && Object.hasOwn(actions, 'expand')) expandDockRef.current = actions.expand;
    if (actions && Object.hasOwn(actions, 'focusClose')) focusCloseRef.current = actions.focusClose;
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    load();
    return () => {
      requestRef.current?.abort();
      window.clearTimeout(refreshTimerRef.current);
    };
  }, [isOpen, load]);

  useEffect(() => {
    if (!isOpen || !feed?.nextRefreshAt) return undefined;
    const refreshAt = Date.parse(feed.nextRefreshAt);
    if (!Number.isFinite(refreshAt)) return undefined;
    const schedule = () => {
      window.clearTimeout(refreshTimerRef.current);
      const wait = Math.max(0, refreshAt - Date.now());
      refreshTimerRef.current = window.setTimeout(load, Math.min(wait, 2147480000));
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (Date.now() >= refreshAt) load();
        else schedule();
      }
    };
    schedule();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearTimeout(refreshTimerRef.current);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [feed, isOpen, load]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = event => {
      if (event.key === 'Escape' && !event.defaultPrevented && !event.target.closest?.('dialog[open]')) {
        event.preventDefault();
        close();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [close, isOpen]);

  const value = { open, close, isOpen, registerDock, panelId: TOP_TEN_PANEL_ID, feed, loading, error, load };

  return (
    <TopTenContext.Provider value={value}>
      {children}
    </TopTenContext.Provider>
  );
}

export function RadioTopTenPanel() {
  const { close, isOpen, registerDock, panelId, feed, loading, error, load } = useRadioTopTen();
  const closeRef = useRef(null);

  useEffect(() => {
    registerDock({ focusClose: () => closeRef.current?.focus() });
    return () => registerDock({ focusClose: null });
  }, [registerDock]);

  useEffect(() => {
    if (isOpen) requestAnimationFrame(() => closeRef.current?.focus());
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <section id={panelId} className="top-ten-panel" role="region" aria-label="Yesterday’s Top Ten Songs">
      <header className="top-ten-header">
        <div className="top-ten-heading">
          <h2 className="top-ten-title">Yesterday’s Top Ten</h2>
          <p className="top-ten-subtitle">Most played on Santa Radio yesterday</p>
          {feed?.date && <p className="top-ten-date">{formattedDate(feed.date)}</p>}
        </div>
        <button ref={closeRef} type="button" className="top-ten-close" onClick={() => close()} aria-label="Close yesterday’s top ten">
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
      </header>
      <div className="top-ten-content" aria-live="polite" aria-busy={loading}>
        {loading && !feed && (
          <div className="top-ten-loading" role="status" aria-label="Loading yesterday’s songs">
            {[1, 2, 3, 4, 5].map(item => <div className="top-ten-skeleton" key={item}><i /><span /><b /></div>)}
          </div>
        )}
        {error && (
          <div className="top-ten-message top-ten-error" role="alert">
            <p>{error}</p><button type="button" onClick={load}>Try again</button>
          </div>
        )}
        {!error && feed && <FeedContent feed={feed} />}
      </div>
      {feed && <p className="top-ten-footnote">Observed broadcasts, not an authoritative play count.</p>}
    </section>
  );

}

function FeedContent({ feed }) {
  const { state, songs } = feed;
  if (state === 'inactive') return <div className="top-ten-message"><h3>Not tuned in just yet</h3><p>Yesterday’s chart hasn’t been activated. We can’t promise when it will be ready.</p></div>;
  if (state === 'initial') return <div className="top-ten-message"><h3>The first notes are still gathering</h3><p>There isn’t enough listening history yet to put together a chart.</p></div>;
  if (state === 'empty' || !songs.length) return <div className="top-ten-message"><h3>No songs to report</h3><p>{state === 'partial' ? 'Only partial coverage is available, with no confirmed song transitions recorded. This is not a complete chart.' : 'There were no observed song transitions in the reporting period.'}</p></div>;
  return (
    <>
      {state === 'partial' && <p className="top-ten-partial">A partial listening record is available. This is not a complete chart.</p>}
      <ol className="top-ten-list">
        {songs.slice(0, 10).map((song, index) => (
          <li className="top-ten-row" key={`${song.artist}-${song.title}-${index}`}>
            <span className="top-ten-rank">{String(index + 1).padStart(2, '0')}</span>
            <SongArtwork song={{ artist: song.artist, song: song.title }} className="top-ten-artwork" width="40" height="40" loading="lazy" />
            <span className="top-ten-song-copy"><strong>{song.title}</strong><span>{song.artist}</span></span>
            <span className="top-ten-count" aria-label={`${song.count} observed broadcasts`}><b>{song.count}</b><small>observed</small></span>
          </li>
        ))}
      </ol>
    </>
  );
}
