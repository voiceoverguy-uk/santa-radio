import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRadio } from '../components/RadioProvider.jsx';
import ContenderWaveformPlayer from '../components/ContenderWaveformPlayer.jsx';
import { votingStatus } from '../lib/contenders.js';
import './ChristmasContenders.css';

const API = '/api/christmas-contenders';
const ORDER_KEY = 'santa-radio-contender-order-v1';
const ATTEMPT_KEY = 'santa-radio-contender-attempt-v1';
const REQUEST_TIMEOUT = 10_000;
const POLL_INTERVAL = 30_000;

function shuffled(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function orderEntries(entries) {
  if (typeof window === 'undefined') return entries;
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(ORDER_KEY) || 'null');
    const ids = Array.isArray(saved) ? saved : [];
    const byId = new Map(entries.map(entry => [entry.id, entry]));
    const ordered = ids.map(id => byId.get(id)).filter(Boolean);
    const remaining = entries.filter(entry => !ids.includes(entry.id));
    const next = [...ordered, ...shuffled(remaining)];
    window.sessionStorage.setItem(ORDER_KEY, JSON.stringify(next.map(entry => entry.id)));
    return next;
  } catch {
    return entries;
  }
}

function dateLabel(value) {
  if (!value) return 'Date to be confirmed';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date to be confirmed';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', day: 'numeric', month: 'long', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short',
  }).format(date);
}

function countdownLabel(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return `${days}d ${hours}h ${minutes}m ${remainingSeconds}s`;
}

function makeAttemptId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `demo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function votingCloseLabel(value) {
  if (!value || Number.isNaN(Date.parse(value))) return 'Date to be confirmed';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', day: 'numeric', month: 'long',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).formatToParts(new Date(value));
  const part = type => parts.find(item => item.type === type)?.value || '';
  return `${part('day')} ${part('month')} · ${part('hour')}:${part('minute')}${part('dayPeriod').toLowerCase()} UK time`;
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT);
  const abortFromCaller = () => controller.abort();
  options.signal?.addEventListener('abort', abortFromCaller, { once: true });
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    } });
    let body;
    try { body = await response.json(); } catch { body = {}; }
    if (!response.ok && !(options.method === undefined && body.ready === false && Array.isArray(body.entries))) {
      const error = new Error(body.error || 'We could not complete that request. Please try again.');
      error.status = response.status;
      throw error;
    }
    return body;
  } catch (error) {
    if (timedOut && !options.signal?.aborted) {
      const timeoutError = new Error('The request timed out. Its status is uncertain. Reload the ballot status before trying again.');
      timeoutError.uncertain = true;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abortFromCaller);
  }
}

export default function ChristmasContenders() {
  const radio = useRadio();
  const [data, setData] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [serverOffset, setServerOffset] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [testDelivery, setTestDelivery] = useState('accepted');
  const [selectedEntryId, setSelectedEntryId] = useState('');
  const [pending, setPending] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [message, setMessage] = useState(null);
  const [ballotUsed, setBallotUsed] = useState(false);
  const [ballotStatus, setBallotStatus] = useState(null);
  const [ballotReference, setBallotReference] = useState('');
  const demoAttempt = useRef(null);
  const [shareFeedback, setShareFeedback] = useState('');
  const [manualShare, setManualShare] = useState('');
  const audioRefs = useRef(new Map());
  const audioCallbacks = useRef(new Map());
  const activeAudio = useRef(null);
  const requestRef = useRef(null);
  const pollRequest = useRef(null);
  const radioRef = useRef(radio);
  const alive = useRef(true);
  const hashTimer = useRef(null);
  const ballotStatusRef = useRef(ballotStatus);
  const confirmationRef = useRef(confirmation);
  const repeatTestStartedRef = useRef(false);
  ballotStatusRef.current = ballotStatus;
  confirmationRef.current = confirmation;
  radioRef.current = radio;

  const audioRefFor = id => {
    if (!audioCallbacks.current.has(id)) audioCallbacks.current.set(id, element => {
      if (element) audioRefs.current.set(id, element);
      else {
        const previous = audioRefs.current.get(id);
        previous?.pause();
        radioRef.current?.releaseContender?.(previous);
        audioRefs.current.delete(id);
      }
    });
    return audioCallbacks.current.get(id);
  };

  const load = useCallback(async (initial = false) => {
    if (initial && alive.current) setLoading(true);
    pollRequest.current?.abort();
    const controller = new AbortController();
    pollRequest.current = controller;
    try {
      const next = await fetchJson(API, { signal: controller.signal });
      if (!alive.current) return;
      setData(next);
      setEntries(orderEntries(Array.isArray(next.entries) ? next.entries : []));
      setServerOffset(new Date(next.serverNow).getTime() - Date.now());
      setLoadError('');
      const viewerBallot = next.viewerBallot;
      if (viewerBallot) {
        const previous = ballotStatusRef.current;
        const staleRepeatConfirmation = next.settings?.repeatDemo === true
          && repeatTestStartedRef.current
          && viewerBallot.state === 'confirmed'
          && viewerBallot.reference !== previous?.reference;
        if (!staleRepeatConfirmation) {
          ballotStatusRef.current = viewerBallot;
          setBallotStatus(viewerBallot);
          if (viewerBallot.reference) setBallotReference(viewerBallot.reference);
          if (viewerBallot.state === 'confirmed' || viewerBallot.state === 'invalidated') {
            setBallotUsed(next.settings?.repeatDemo !== true);
            if (viewerBallot.state === 'confirmed' && viewerBallot.reference === previous?.reference) repeatTestStartedRef.current = false;
            setConfirmation(null);
            setMessage(current => current?.type === 'success' ? current : {
              type: viewerBallot.state === 'confirmed' ? 'success' : 'duplicate',
              text: viewerBallot.state === 'confirmed'
                ? 'Demo ballot recorded. Forwarding was simulated only; no email was sent.'
                : 'This ballot has been invalidated and cannot be used again.',
              reference: viewerBallot.reference,
            });
          } else if (viewerBallot.state === 'pending' && ['sending', 'unknown'].includes(viewerBallot.delivery)) {
            repeatTestStartedRef.current = false;
            setBallotUsed(false);
            setConfirmation(null);
            setMessage({ type: 'pending', text: 'Not counted yet. Provider acceptance is uncertain; staff must check this reference before any resend.', reference: viewerBallot.reference });
          } else if (viewerBallot.state === 'pending' && viewerBallot.delivery === 'failed') {
            repeatTestStartedRef.current = false;
            setBallotUsed(false);
            const sameKnownFailure = previous?.state === 'pending'
              && previous.delivery === 'failed'
              && previous.reference === viewerBallot.reference;
            if (!sameKnownFailure) setConfirmation(null);
            setMessage({ type: 'error', text: 'The simulated submission failed. It was not counted. You can review your details and retry.', reference: viewerBallot.reference });
          } else if (viewerBallot.state === 'pending') {
            repeatTestStartedRef.current = false;
            setBallotUsed(false);
            if (!confirmationRef.current || previous?.delivery === 'sending' || previous?.delivery === 'unknown') {
              setMessage(null);
            }
          }
        }
      } else if (ballotStatusRef.current?.networkOnly && !ballotStatusRef.current.reference) {
        ballotStatusRef.current = null;
        setBallotStatus(null);
        setBallotReference('');
        setConfirmation(null);
        setMessage({ type: 'error', text: 'No ballot status was found. You can safely prepare again; forwarding only happens after confirmation.' });
      }
    } catch (error) {
      if (!alive.current || error.name === 'AbortError') return;
      setLoadError(error.message || 'The contenders could not be loaded.');
    } finally {
      if (pollRequest.current === controller) pollRequest.current = null;
      if (alive.current && initial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    load(true);
    let timer;
    const poll = () => {
      if (!alive.current) return;
      if (document.visibilityState === 'visible') load(false);
      timer = setTimeout(poll, POLL_INTERVAL);
    };
    timer = setTimeout(poll, POLL_INTERVAL);
    const visibility = () => {
      if (document.visibilityState === 'visible') load(false);
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      alive.current = false;
      clearTimeout(timer);
      clearTimeout(hashTimer.current);
      document.removeEventListener('visibilitychange', visibility);
      requestRef.current?.abort();
      pollRequest.current?.abort();
      audioRefs.current.forEach(audio => {
        if (!audio.paused) audio.pause();
        radioRef.current?.releaseContender?.(audio);
      });
      audioRefs.current.clear();
      activeAudio.current?.pause();
      radioRef.current?.releaseContender?.(activeAudio.current);
      activeAudio.current = null;
    };
  }, [load]);

  useEffect(() => {
    const ticker = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(ticker);
  }, []);

  const focusHashEntry = useCallback(() => {
    if (!window.location.hash) return;
    let id;
    try { id = decodeURIComponent(window.location.hash.slice(1)); } catch { return; }
    clearTimeout(hashTimer.current);
    hashTimer.current = setTimeout(() => {
      const card = document.getElementById(id);
      if (!card || !card.classList.contains('contender-card')) return;
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.classList.add('contender-card--highlight');
      window.setTimeout(() => card.classList.remove('contender-card--highlight'), 2200);
    }, 80);
  }, []);

  useEffect(() => {
    focusHashEntry();
    window.addEventListener('hashchange', focusHashEntry);
    return () => window.removeEventListener('hashchange', focusHashEntry);
  }, [focusHashEntry, entries.length]);

  const stopOtherAudio = audio => {
    audioRefs.current.forEach(other => {
      if (other !== audio && !other.paused) {
        other.pause();
        radioRef.current?.releaseContender?.(other);
      }
    });
  };

  const claimContenderAudio = useCallback(audio => {
    stopOtherAudio(audio);
    activeAudio.current = audio;
    radioRef.current?.claimContender?.(audio);
  }, []);

  const releaseContenderAudio = useCallback(audio => {
    radioRef.current?.releaseContender?.(audio);
    if (activeAudio.current === audio) activeAudio.current = null;
  }, []);

  const shareEntry = async entry => {
    const url = new URL(window.location.href);
    url.hash = entry.anchor || entry.id;
    const shareData = { title: `${entry.artist} — ${entry.title}`, url: url.toString() };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        setShareFeedback(`Link shared for ${entry.title}.`);
        return;
      } catch (error) {
        if (error.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url.toString());
      setShareFeedback(`Link copied for ${entry.title}.`);
      setManualShare('');
    } catch {
      setManualShare(url.toString());
      setShareFeedback('Copy the link below to share this contender.');
    }
  };

  const chooseEntry = entryId => {
    if (pending || alreadyUsed || unresolved) return;
    setSelectedEntryId(current => current === entryId ? '' : entryId);
    setConfirmation(null);
    setMessage(null);
  };

  const startBallot = async event => {
    event.preventDefault();
    if (pending || alreadyUsed || unresolved || !demoAvailable || !email.trim() || !firstName.trim() || !lastName.trim() || !selectedEntry) return;
    const form = event.currentTarget;
    const website = form.elements.namedItem('website')?.value || '';
    if (repeatDemo && !demoAttempt.current) {
      try {
        demoAttempt.current = window.sessionStorage.getItem(ATTEMPT_KEY);
        if (!demoAttempt.current) {
          demoAttempt.current = makeAttemptId();
          window.sessionStorage.setItem(ATTEMPT_KEY, demoAttempt.current);
        }
      } catch {
        demoAttempt.current = makeAttemptId();
      }
    }
    const snapshot = {
      selectedEntryId: String(selectedEntry.id),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      marketingOptIn,
      testDelivery,
      website,
      ...(repeatDemo ? { attemptId: demoAttempt.current } : {}),
    };
    setPending(true);
    setMessage(null);
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const result = await fetchJson(API, {
        method: 'POST', signal: controller.signal,
        body: JSON.stringify({
          action: 'prepare', mode: 'demo', entryId: snapshot.selectedEntryId,
          email: snapshot.email, firstName: snapshot.firstName, lastName: snapshot.lastName,
          website: snapshot.website,
          ...(snapshot.attemptId ? { attemptId: snapshot.attemptId } : {}),
          marketingOptIn: snapshot.marketingOptIn, testDelivery: snapshot.testDelivery,
        }),
      });
      if (!alive.current) return;
      if (result.reference) setBallotReference(result.reference);
      if (result.state === 'already-voted') {
        setBallotUsed(true);
        setConfirmation(null);
        setBallotReference(result.reference || '');
        setMessage({ type: 'duplicate', text: 'This ballot has already been used.', reference: result.reference });
      } else if (result.state === 'pending' && ['sending', 'unknown'].includes(result.delivery)) {
        const status = { state: 'pending', delivery: result.delivery, reference: result.reference || '' };
        ballotStatusRef.current = status;
        setBallotStatus(status);
        setBallotReference(status.reference);
        setConfirmation(null);
        setMessage({ type: 'pending', text: 'Not counted yet. Provider acceptance is uncertain; staff must check this reference before any resend.', reference: status.reference });
      } else if (result.state === 'pending' && result.delivery === 'failed') {
        const status = { state: 'pending', delivery: 'failed', reference: result.reference || '' };
        ballotStatusRef.current = status;
        setBallotStatus(status);
        setBallotReference(status.reference);
        setConfirmation(null);
        setMessage({ type: 'error', text: 'The simulated submission failed. It was not counted. You can review your details and retry.', reference: status.reference });
      } else if (result.state === 'pending') {
        const status = { state: 'pending', delivery: null, reference: result.reference || '' };
        ballotStatusRef.current = status;
        setBallotStatus(status);
        setBallotReference(status.reference);
        setConfirmation(null);
        setMessage(null);
      } else if (result.state === 'confirmation') {
        const prepared = { ...snapshot, reference: result.reference || '' };
        setBallotReference(prepared.reference);
        setConfirmation(prepared);
        setMessage({ type: 'confirm', text: 'Review your choice, then confirm this simulated ballot.', reference: prepared.reference });
      } else {
        setMessage({ type: 'error', text: result.error || 'The ballot could not be prepared. No forwarding occurs until confirmation.', reference: result.reference });
      }
      await load(false);
    } catch (error) {
      if (error.name !== 'AbortError') {
        setMessage({ type: 'error', text: 'Preparation could not be confirmed. No forwarding occurs until you confirm. Reload status or try again.', reference: ballotReference });
        await load(false);
      }
    } finally {
      requestRef.current = null;
      if (alive.current) setPending(false);
    }
  };

  const confirmBallot = async () => {
    if (pending || unresolved || !confirmation || alreadyUsed || !demoAvailable || confirmation.selectedEntryId !== String(selectedEntry?.id)) return;
    const snapshot = confirmation;
    setPending(true);
    setMessage(null);
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const result = await fetchJson(API, {
        method: 'POST', signal: controller.signal,
        body: JSON.stringify({
          action: 'confirm', mode: 'demo', entryId: snapshot.selectedEntryId,
          email: snapshot.email, firstName: snapshot.firstName, lastName: snapshot.lastName,
          website: snapshot.website || '',
          ...(snapshot.attemptId ? { attemptId: snapshot.attemptId } : {}),
          marketingOptIn: snapshot.marketingOptIn,
          testDelivery: snapshot.testDelivery,
        }),
      });
      if (!alive.current) return;
      if (result.state === 'already-voted') {
        setBallotUsed(!repeatDemo);
        setBallotReference(result.reference || snapshot.reference || '');
        setMessage({ type: 'duplicate', text: 'This ballot has already been used.', reference: result.reference || snapshot.reference });
      } else if (result.state === 'error' || result.delivery === 'failed') {
        ballotStatusRef.current = { state: 'pending', delivery: 'failed', reference: result.reference || snapshot.reference };
        setBallotStatus(ballotStatusRef.current);
        setBallotReference(result.reference || snapshot.reference || '');
        setConfirmation(null);
        setMessage({ type: 'error', text: 'The simulated submission failed. It was not counted. Your details are still here; you can retry.', reference: result.reference || snapshot.reference });
      } else if (result.state === 'pending' && ['unknown', 'sending'].includes(result.delivery)) {
        ballotStatusRef.current = { state: 'pending', delivery: result.delivery || 'unknown', reference: result.reference || snapshot.reference };
        setBallotStatus(ballotStatusRef.current);
        setBallotReference(result.reference || snapshot.reference || '');
        setConfirmation(null);
        setMessage({ type: 'pending', text: 'Not counted yet. Provider acceptance is uncertain; staff must check this reference before any resend.', reference: result.reference || snapshot.reference });
      } else if (result.state === 'pending') {
        ballotStatusRef.current = { state: 'pending', delivery: null, reference: result.reference || snapshot.reference };
        setBallotStatus(ballotStatusRef.current);
        setBallotReference(result.reference || snapshot.reference || '');
        setConfirmation(null);
        setMessage(null);
      } else {
        setBallotUsed(!repeatDemo);
        ballotStatusRef.current = { state: 'confirmed', delivery: result.delivery || 'simulated', reference: result.reference || snapshot.reference };
        setBallotStatus(ballotStatusRef.current);
        setBallotReference(result.reference || snapshot.reference || '');
        setMessage({ type: 'success', text: 'Demo ballot recorded. Forwarding was simulated only; no email was sent.', reference: result.reference || snapshot.reference });
      }
      setConfirmation(null);
      await load(false);
    } catch (error) {
      if (error.name !== 'AbortError') {
        ballotStatusRef.current = { state: 'pending', delivery: 'unknown', reference: snapshot.reference || '', networkOnly: !snapshot.reference };
        setBallotStatus(ballotStatusRef.current);
        setMessage({ type: 'pending', text: error.uncertain || !error.status
          ? 'Status uncertain. Reload status before trying again; your entered details are kept here. Do not resend until the reference is checked.'
          : ballotError(error), reference: snapshot.reference });
        await load(false);
      }
    } finally {
      requestRef.current = null;
      if (alive.current) setPending(false);
    }
  };

  const settings = data?.settings || {};
  const repeatDemo = settings.repeatDemo === true;
  const currentServerTime = now + serverOffset;
  const opens = settings.opensAt ? new Date(settings.opensAt).getTime() : NaN;
  const closes = settings.closesAt ? new Date(settings.closesAt).getTime() : NaN;
  const votingState = !data
    ? 'checking'
    : data.status === 'unavailable' || data.ready === false
      ? 'unavailable'
      : data.status === 'closed'
        ? 'closed'
        : votingStatus(settings, currentServerTime);
  const countdownTarget = votingState === 'upcoming' ? opens : votingState === 'open' ? closes : NaN;
  const remaining = countdownTarget - currentServerTime;
  const statusCopy = {
    upcoming: Number.isFinite(remaining) && remaining > 0 ? `Voting opens in ${countdownLabel(remaining)}` : 'Voting opens soon',
    open: Number.isFinite(remaining) && remaining > 0 ? `Voting closes in ${countdownLabel(remaining)}` : 'Voting closes soon',
    closed: 'Voting closed',
    unavailable: 'Real voting is unavailable',
    checking: 'Checking voting status',
  }[votingState];
  const alreadyUsed = ballotUsed || (!repeatDemo && ['confirmed', 'invalidated'].includes(data?.viewerBallot?.state));
  const unresolved = ballotStatus?.state === 'pending' && ['sending', 'unknown'].includes(ballotStatus?.delivery);
  const demoAvailable = data?.demoStatus === 'open' && data?.ready && !alreadyUsed;
  const selectedEntry = entries.find(entry => entry.id === selectedEntryId && entry.mode === 'demo') || null;
  const keepFocusClear = event => {
    const control = event.target;
    if (!control.matches(':focus-visible')) return;
    requestAnimationFrame(() => {
      if (!control.isConnected || document.activeElement !== control) return;
      const rect = control.getBoundingClientRect();
      const dock = document.querySelector('.radio-dock')?.getBoundingClientRect();
      if (rect.top < 120 || (dock && rect.right > dock.left && rect.left < dock.right &&
          rect.bottom > dock.top && rect.top < dock.bottom)) {
        control.scrollIntoView({block:'center',behavior:'instant'});
      }
    });
  };

  return (
    <main className="christmas-contenders" onFocusCapture={keepFocusClear}>
      <section className="contenders-hero starry-bg">
        <div className="contenders-hero__inner">
          <p className="contenders-kicker">Christmas Contenders · 2026</p>
          <h1>Help shape the sound of Christmas</h1>
          <p className="contenders-intro">
            Listen and choose your favourite by giving it a vote!
          </p>
          <div className={`contenders-countdown contenders-countdown--${votingState}`} role="timer" aria-live="off">
            {statusCopy}
          </div>
          <p className="contenders-close-note">Voting closes {votingCloseLabel(settings.closesAt)}</p>
        </div>
      </section>

      <div className="contenders-content">
        <section className="contenders-listing" aria-labelledby="contenders-list-title">
          <header className="contenders-section-heading">
            <div>
              <p className="contenders-kicker">THE LISTENING ROOM - Studio C</p>
              <h2 id="contenders-list-title">Meet the contenders</h2>
            </div>
          </header>

          {loading ? <div className="contender-skeleton" aria-label="Loading contenders">
            <div className="contender-skeleton__art" />
            <div className="contender-skeleton__lines"><i /><i /><i /></div>
          </div> : loadError ? <div className="contenders-alert" role="alert">
            <strong>We can’t reach the ballot just now.</strong>
            <p>{loadError}</p>
            <button type="button" onClick={() => load(true)}>Try again</button>
          </div> : entries.length ? <fieldset className="contenders-grid">
            <legend className="sr-only">Choose one approved demo song for your ballot</legend>
            {entries.map(entry => {
              const demo = entry.mode === 'demo';
              const selectable = demo && !alreadyUsed && !pending && !unresolved;
              return <article className={`contender-card${demo ? '' : ' contender-card--live'}`} id={entry.anchor || entry.id} key={entry.id}>
                <div className="contender-card__art-wrap">
                  {entry.artwork ? <img className="contender-card__art" src={entry.artwork} alt={`${entry.artist} artwork`} /> : <div className="contender-card__art contender-card__art--missing" aria-label="Artwork unavailable" />}
                </div>
                <div className="contender-card__body">
                  <div className="contender-card__identity">
                    <p className="contender-card__eyebrow">{demo ? 'Demo contender' : 'Genuine contender'}</p>
                    <h3>{entry.artist}</h3>
                    <p className="contender-card__title">{entry.title}</p>
                  </div>
                </div>
                {entry.audio ? <div className="contender-card__audio">
                  <ContenderWaveformPlayer
                    src={entry.audio}
                    waveform={entry.waveform}
                    title={entry.title}
                    artist={entry.artist}
                    audioRef={audioRefFor(entry.id)}
                    onClaim={claimContenderAudio}
                    onRelease={releaseContenderAudio}
                  />
                </div> : <p className="contender-card__unavailable">Recording unavailable.</p>}
                <div className="contender-card__actions">
                  <div className="contender-card__count">
                    <span>{demo ? 'Demo ballots' : 'Votes'}</span>
                    <strong>{Number.isFinite(entry.total) ? entry.total.toLocaleString('en-GB') : '—'}</strong>
                  </div>
                  <button className="contender-share" type="button" onClick={() => shareEntry(entry)}>Share</button>
                  <label className={`contender-select${!selectable ? ' contender-select--disabled' : ''}`}>
                    <input
                      type="checkbox" name="contender-selection"
                      aria-label={demo ? `Select ${entry.title} by ${entry.artist}` : `Voting unavailable for ${entry.title} by ${entry.artist}`}
                      value={entry.id}
                      checked={selectedEntryId === entry.id && demo}
                      disabled={!selectable}
                      onChange={() => chooseEntry(entry.id)}
                    />
                    <span className="contender-select__tick" aria-hidden="true" />
                    <span>{demo ? 'Select song' : 'Voting unavailable'}</span>
                  </label>
                </div>
              </article>;
            })}
          </fieldset> : <div className="contenders-empty"><h3>No approved recordings yet</h3><p>Check back as screened contenders are added.</p></div>}

          {shareFeedback && <p className="share-feedback" role="status">{shareFeedback}</p>}
          {manualShare && <div className="share-manual">
            <label htmlFor="contender-share-url">Copy this link</label>
            <input id="contender-share-url" readOnly value={manualShare} onFocus={event => event.target.select()} />
          </div>}
        </section>

        <section className="shared-ballot" id="shared-ballot" aria-labelledby="shared-ballot-title" tabIndex="-1">
          <div className="shared-ballot__intro">
            <p className="contenders-kicker">One shared ballot</p>
            <h2 id="shared-ballot-title">Your song choice</h2>
            <p>Preview only: forwarding is simulated, no email is sent, and a provider acceptance is not inbox delivery or proof of email ownership.</p>
            {repeatDemo && <p>Repeat testing is on for the demo ballot. Use “Test another demo ballot” after each result. Genuine contenders remain unavailable for real voting.</p>}
          </div>
          <div className="shared-ballot__form-area">
            {alreadyUsed || ballotStatus?.state === 'confirmed' ? <div className="ballot-terminal" role="status">
              <p>{message?.text || 'This demo ballot has already been used. No additional ballot was recorded.'}</p>
              {ballotReference && <p className="ballot-reference">Vote reference: <strong>{ballotReference}</strong></p>}
              {repeatDemo && <button className="contender-vote-button" type="button"
                disabled={pending || data?.demoStatus !== 'open' || !data?.ready}
                onClick={() => {
                  demoAttempt.current = null;
                  try { window.sessionStorage.removeItem(ATTEMPT_KEY); } catch { /* optional */ }
                  repeatTestStartedRef.current = true;
                  ballotStatusRef.current = null;
                  setBallotUsed(false); setBallotStatus(null); setBallotReference('');
                  setConfirmation(null); setMessage(null); setMarketingOptIn(false); setTestDelivery('accepted');
                  setFirstName(''); setLastName(''); setEmail(''); setSelectedEntryId('');
                }}>
                Test another demo ballot
              </button>}
            </div> : unresolved ? <div className="ballot-terminal ballot-terminal--pending" role="status">
              <strong>Ballot status pending</strong>
              <p>{message?.text || 'Not counted yet. Provider acceptance is uncertain; staff must check this reference before any resend.'}</p>
              {ballotReference && <p className="ballot-reference">Vote reference: <strong>{ballotReference}</strong></p>}
              <button className="contender-cancel-button" type="button" onClick={() => load(false)} disabled={pending}>Check status</button>
            </div> : confirmation ? <div className="demo-confirmation">
              <p className="demo-confirmation__choice">Confirm <strong>{entries.find(entry => String(entry.id) === confirmation.selectedEntryId)?.artist} — {entries.find(entry => String(entry.id) === confirmation.selectedEntryId)?.title}</strong></p>
              <p className="demo-confirmation__name">{confirmation.firstName} {confirmation.lastName}</p>
              <p className="demo-confirmation__email">Demo email: {confirmation.email}</p>
              <p className="demo-confirmation__consent">Santa Radio news and updates: {confirmation.marketingOptIn ? 'Yes, opted in' : 'No'}</p>
              <p className="demo-confirmation__consent">Simulation result: {confirmation.testDelivery}</p>
              {confirmation.reference && <p className="ballot-reference">Vote reference: <strong>{confirmation.reference}</strong></p>}
              <div className="demo-confirmation__actions">
                <button className="contender-vote-button" type="button" onClick={confirmBallot} disabled={pending || !demoAvailable || confirmation.selectedEntryId !== String(selectedEntry?.id)}>
                  {pending ? 'Confirming…' : 'Confirm simulated forwarding'}
                </button>
                <button className="contender-cancel-button" type="button" onClick={() => { setConfirmation(null); setMessage(null); }} disabled={pending}>Cancel</button>
              </div>
            </div> : <form className="shared-ballot__form" onSubmit={startBallot}>
              <p className="shared-ballot__choice">{selectedEntry ? <>Selected: <strong>{selectedEntry.artist} — {selectedEntry.title}</strong></> : 'Select one song above to continue.'}</p>
              <p className="shared-ballot__required-copy">The existing SONG submission needs your first name, last name and email. These details stay in this page’s temporary state.</p>
              <label htmlFor="demo-first-name">First name</label>
              <input id="demo-first-name" type="text" autoComplete="given-name" maxLength={200}
                value={firstName} onChange={event => setFirstName(event.target.value)}
                required disabled={!demoAvailable || pending} />
              <label htmlFor="demo-last-name">Last name</label>
              <input id="demo-last-name" type="text" autoComplete="family-name" maxLength={200}
                value={lastName} onChange={event => setLastName(event.target.value)}
                required disabled={!demoAvailable || pending} />
              <label htmlFor="demo-email">Email</label>
              <input
                id="demo-email" type="email" autoComplete="email" maxLength={254}
                value={email} onChange={event => setEmail(event.target.value)}
                required disabled={!demoAvailable || pending}
              />
              <label htmlFor="demo-delivery">Preview simulation result</label>
              <select id="demo-delivery" value={testDelivery} onChange={event => setTestDelivery(event.target.value)} disabled={!demoAvailable || pending}>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
                <option value="unknown">Unknown</option>
              </select>
              <p className="shared-ballot__preview-note">Preview only: simulates forwarding; no email is sent.</p>
              <label className="shared-ballot__opt-in">
                <input
                  type="checkbox"
                  checked={marketingOptIn}
                  onChange={event => setMarketingOptIn(event.target.checked)}
                  disabled={!demoAvailable || pending}
                />
                <span>Send me occasional Santa Radio news and updates.</span>
              </label>
              <p className="shared-ballot__privacy">
                At launch, the existing SONG submission forwards your name, email, chosen artist and title, vote reference, and marketing yes/no through the Brevo form. The site keeps a fingerprint, count and minimal consent metadata only; it does not keep a new readable or recoverable address or create a marketing list. Read our <Link to="/privacy-policy">Privacy Policy</Link>.
              </p>
              <p className="shared-ballot__preview-note">This preview sends no email. Provider acceptance is not confirmed inbox delivery or proof of email ownership.</p>
              <div className="contender-honeypot" aria-hidden="true">
                <label htmlFor="demo-website">Leave this field empty</label>
                <input id="demo-website" name="website" tabIndex={-1} autoComplete="off" />
              </div>
              <button className="contender-vote-button" type="submit" disabled={!demoAvailable || pending || !selectedEntry}>
                {pending ? 'Preparing…' : 'Review simulated forwarding'}
              </button>
            </form>}
            {message && !alreadyUsed && !unresolved && <div className={`ballot-message ballot-message--${message.type}`} role={message.type === 'error' ? 'alert' : 'status'}>
              {message.text}{message.reference && <span className="ballot-message__reference">Vote reference: <strong>{message.reference}</strong></span>}
            </div>}
            {!alreadyUsed && !unresolved && !demoAvailable && !confirmation && <p className="ballot-unavailable">
              {data?.demoStatus === 'closed' ? 'The demo ballot is closed.' : data?.demoStatus === 'unavailable' || !data?.ready
                ? 'Demo ballots are temporarily unavailable.' : 'Demo ballot is not available.'}
            </p>}
            <p className="live-ballot-note"><strong>Preview only.</strong> No real vote or email is sent.</p>
          </div>
        </section>

        <section className="contenders-how" aria-labelledby="how-title">
          <div className="contenders-how__heading">
            <p className="contenders-kicker">A little Christmas fairness</p>
            <h2 id="how-title">How it works</h2>
          </div>
          <div className="contenders-how__copy">
            <p>Listen to the recordings, then choose one song for your ballot. Participation is optional.</p>
            <ul>
              <li>Only screened, family-friendly Christmas songs are considered.</li>
              <li>One ballot per person during November; suspicious votes may be removed.</li>
              <li>Voting closes {dateLabel(settings.closesAt)} (UK time).</li>
              <li>Votes inform December playlist consideration, but do not guarantee airplay; Santa Radio makes the final editorial decision.</li>
            </ul>
            <p>Have a recording for the team to consider? Send it through the existing <Link to="/submit-a-song?mode=song">SONG submission form</Link>. Submissions are reviewed before publication and are not automatically added here.</p>
            {settings.submissionCutoff && <p>Song submission cutoff: {dateLabel(settings.submissionCutoff)}.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}

function ballotError(error) {
  if (error.status === 409) return 'This ballot is closed or has already been used. No ballot was recorded.';
  if (error.status === 503) return 'Ballots are temporarily unavailable. Please try again later.';
  return error.message || 'We could not record that demo ballot. Please try again.';
}
