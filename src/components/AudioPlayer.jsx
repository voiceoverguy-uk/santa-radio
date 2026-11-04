import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useRadio } from './RadioProvider.jsx';
import RadioTracks from './RadioTracks.jsx';
import LiveLyrics from './LiveLyrics.jsx';
import './AudioPlayer.css';
import { useRadioDockHidden } from './RadioDockVisibility.jsx';

const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function RadioButton({ className = 'btn-gold', onStart, iconOnly = false }) {
  const { status, togglePlay } = useRadio();
  const label = status === 'playing' ? 'Pause Radio'
    : status === 'loading' ? 'Cancel loading radio'
      : status === 'error' ? 'Try Again' : 'Listen Live';
  return <button type="button" className={className} data-radio-status={status} onClick={() => {
    if (status !== 'playing' && status !== 'loading') onStart?.();
    togglePlay();
  }} aria-label={iconOnly ? label : status === 'loading' ? 'Cancel loading radio' : undefined} aria-busy={iconOnly && status === 'loading' ? 'true' : undefined}>
    <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      {iconOnly && status === 'loading'
        ? <path className="radio-icon-loading" d="M12 3a9 9 0 1 0 8.5 6h-2.2A6.9 6.9 0 1 1 12 5.1V2l4 4-4 4V7.2A4.8 4.8 0 1 0 16.8 12H19a7 7 0 0 1-7 7 7 7 0 1 1 0-14z" />
        : iconOnly && status === 'error'
          ? <path d="M12 5V2L7.5 6.5 12 11V8a5 5 0 1 1-4.7 6.7H5.2A7 7 0 1 0 12 5z" />
          : status === 'playing' || status === 'loading' ? <path d="M6 4h4v16H6zm8 0h4v16h-4z" /> : <path d="m7 4 14 8-14 8z" />}
    </svg>
    {iconOnly
      ? <><span className="radio-icon-only-label">{label}</span>{(status === 'loading' || status === 'error') && <span className="radio-icon-only-status" aria-hidden="true" />}</>
      : status === 'playing' ? 'Pause Radio' : status === 'loading' ? 'Connecting…' : status === 'error' ? 'Try Again' : 'Listen Live'}
  </button>;
}
export default function AudioPlayer() {
  const hidden = useRadioDockHidden();
  const { pathname } = useLocation();
  const { status, volume, setVolume, error, metadata } = useRadio();
  const [upcomingOpen, setUpcomingOpen] = useState(false);
  const dockRef = useRef(null);
  const keyboardInteraction = useRef(false);
  // Every full load starts compact, regardless of device or an older saved
  // preference. This shared component still keeps its state across SPA routes.
  const [minimized, setMinimized] = useState(true);
  const toggleSize = () => {
    setMinimized(value => {
      try { sessionStorage.setItem('radio-minimized', String(!value)); } catch { /* Optional preference storage. */ }
      return !value;
    });
  };
  const expandPlayer = useCallback(event => {
    setMinimized(false);
    try { sessionStorage.setItem('radio-minimized', 'false'); } catch { /* Optional preference storage. */ }
    if (event?.detail === 0) {
      requestAnimationFrame(() => dockRef.current?.querySelector('.radio-size-toggle')?.focus());
    }
  }, []);
  useBrowserLayoutEffect(() => {
    if (!hidden) return;
    setUpcomingOpen(false);
    const hadDockFocus = dockRef.current?.contains(document.activeElement);
    dockRef.current?.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
    // Only relocate focus if it belonged to the disappearing dock. Never
    // restore dock focus later or interrupt someone already typing in the maker.
    if (hadDockFocus) {
      document.getElementById('page-content')?.focus({ preventScroll: true });
    }
  }, [hidden]);
  useEffect(() => {
    if (minimized || hidden) return;
    const dock = dockRef.current;
    let timer;
    const restart = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        // Never hide the reader or controls a keyboard user is focused on.
        if (dock.querySelector('dialog[open]') ||
            (keyboardInteraction.current && dock.contains(document.activeElement))) {
          restart();
          return;
        }
        setMinimized(true);
        try { sessionStorage.setItem('radio-minimized', 'true'); } catch { /* Optional storage. */ }
        if (dock.contains(document.activeElement)) dock.querySelector('.radio-size-toggle')?.focus();
      }, 10000);
    };
    const interact = event => {
      if (event.type === 'keydown' || event.type === 'focusin') keyboardInteraction.current = true;
      if (event.type === 'pointerdown' || (event.type === 'click' && event.detail > 0)) keyboardInteraction.current = false;
      restart();
    };
    const events = ['pointermove', 'pointerdown', 'click', 'keydown', 'input', 'focusin', 'focusout', 'wheel', 'close'];
    events.forEach(event => dock.addEventListener(event, interact, true));
    restart();
    return () => {
      clearTimeout(timer);
      events.forEach(event => dock.removeEventListener(event, interact, true));
    };
  }, [minimized, hidden]);
  const upcomingId = useId();
  return (
    <aside ref={dockRef} hidden={hidden} inert={hidden ? '' : undefined} aria-hidden={hidden || undefined} onPointerDownCapture={() => { keyboardInteraction.current = false; }} onClick={event => {
      if (minimized && !event.target.closest('button, a, input, select, textarea, [role="button"]')) expandPlayer(event);
    }} className={`radio-dock ${pathname.replace(/\/+$/, '') === '/santa-message-workshop' ? 'is-studio-player' : ''} ${minimized ? 'is-minimized' : ''} ${status === 'loading' ? 'is-loading' : ''}`} aria-label="Santa Radio player">
      <button type="button" className="radio-size-toggle" onClick={toggleSize}
        aria-label={minimized ? 'Expand radio player' : 'Minimise radio player'} aria-expanded={!minimized}
        title={minimized ? 'Expand player' : 'Minimise player'}>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d={minimized ? 'm6 15 6-6 6 6' : 'M5 12h14'} />
        </svg>
      </button>
      {minimized && <button type="button" className="radio-mini-summary" onClick={expandPlayer} aria-label="Show radio details" aria-describedby={`${upcomingId}-track`} aria-expanded="false">
        <span className="radio-eyebrow">SANTA RADIO</span>
        <span id={`${upcomingId}-track`} className="radio-mini-track" title={metadata.currentStatus === 'ready' ? `${metadata.current.title} — ${metadata.current.artist}` : undefined}>
          {metadata.currentStatus === 'ready' ? `${metadata.current.title} — ${metadata.current.artist}` : 'Christmas music, all year'}
        </span>
        {error && <span className="radio-mini-error" role="status">{error}</span>}
      </button>}
      <div className="radio-station">
        <span className="radio-eyebrow"><span className="live-dot active" aria-hidden="true" /> SANTA RADIO LIVE</span>
        {(error || status === 'loading') && <span className="radio-caption" role="status">{error || 'Connecting to the North Pole…'}</span>}
      </div>
       <div className="radio-dock-track"><RadioTracks metadata={metadata} showLabel={false} /><LiveLyrics metadata={metadata} suppressed={hidden} /></div>
      <RadioButton className="radio-play" />
      <label className="radio-volume">Volume
        <input aria-label="Radio volume" type="range" min="0" max="1" step=".01" value={volume} onChange={event => setVolume(Number(event.target.value))} />
      </label>
      <div className="radio-upcoming">
        <button type="button" className="radio-upcoming-toggle" aria-expanded={upcomingOpen} aria-controls={upcomingId} onClick={() => setUpcomingOpen(open => !open)}>
          <span>Playing Next</span>
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m6 9 6 6 6-6" /></svg>
        </button>
        <div id={upcomingId} className="radio-upcoming-panel" hidden={!upcomingOpen || minimized} tabIndex={upcomingOpen && !minimized ? 0 : -1} role="region" aria-label="Playing Next on Santa Radio">
          <RadioTracks metadata={metadata} kind="upcoming" showLabel={false} />
        </div>
      </div>
    </aside>
  );
}
