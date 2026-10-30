import { useEffect, useId, useRef, useState } from 'react';
import { useRadio } from './RadioProvider.jsx';
import SantaMessageExample from './SantaMessageExample.jsx';
import SantaMessageAccessForm from './SantaMessageAccessForm.jsx';
import { SantaGreetingShare } from './SantaMessageShare.jsx';
import { useSantaMessageAccess } from './SantaMessageAccessProvider.jsx';
import useSantaMessageAllowance from './useSantaMessageAllowance.js';
import useSantaMessageHistory from './useSantaMessageHistory.js';
import useSantaNames from './useSantaNames.js';
import useHostedSantaNameSearch from './useHostedSantaNameSearch.js';
import useSantaNameCounter from './useSantaNameCounter.js';
import SantaCooldownNotice from './SantaCooldownNotice.jsx';
import SantaVoiceTagline from './SantaVoiceTagline.jsx';
import SantaStudioPromotion from './SantaStudioPromotion.jsx';
import { santaNameKey } from '../lib/santaNameSearch.js';
import { randomSantaExample, santaNamePlaceholder } from '../lib/santaNamePlaceholder.js';
import { normaliseRequestedName } from '../lib/santaNameRequests.js';
import { nameRequestToken } from '../lib/santaNameRequestTokens.js';
import { trySavedSantaGreeting } from '../lib/savedSantaGreeting.js';
import { settleSantaMessageDeskAfterEntry } from '../lib/scrollToSantaMessageDesk.js';
import './SantaNameRequest.css';
import './SantaMessageForm.css';

export default function SantaMessageForm({ showDetailLink = true, initialName = '', pendingName, keepSignupInPlace = false }) {
  const { hasAccess, greetingName, sessionRemembered } = useSantaMessageAccess();
  const makerHeadingRef = useRef(null);
  const previousAccess = useRef(hasAccess);
  const [name, setName] = useState(initialName);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [exampleName, setExampleName] = useState('Olivia');
  const [activeExampleName, setActiveExampleName] = useState(null);
  const [giftPreviewName, setGiftPreviewName] = useState(null);
  const { messages, remember } = useSantaMessageHistory();
  const [validation, setValidation] = useState('');
  const [audioErrors, setAudioErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [activeOption, setActiveOption] = useState(-1);
  const suggestionTouchRef = useRef(null);
  const suppressTouchClickRef = useRef(false);
  const requestRef = useRef(null);
  const nameRequestRef = useRef(null);
  const [nameRequest, setNameRequest] = useState({ key: '', status: 'idle', message: '' });
  const normalNameSearch = useSantaNames(keepSignupInPlace ? '' : name, hasAccess && !keepSignupInPlace);
  const privateNameSearch = useHostedSantaNameSearch(name, keepSignupInPlace);
  const nameSearch = keepSignupInPlace ? privateNameSearch : normalNameSearch;
  const displayedNameCount = useSantaNameCounter(nameSearch.hostedCount);
  const availableNamesText = displayedNameCount !== null
    ? `${displayedNameCount.toLocaleString('en-GB')} ${displayedNameCount === 1 ? 'name' : 'names'} available`
    : nameSearch.loading ? 'Checking how many names are available…' : 'Name total temporarily unavailable.';
  const suggestions = nameSearch.records;
  const verifiedSelectedRecord = selectedRecord && selectedRecord.name === name.trim()
    ? selectedRecord : null;
  const exactMatches = !nameSearch.loading && !nameSearch.error
    ? suggestions.filter(record => santaNameKey(record.name) === santaNameKey(name)) : [];
  // Equivalent spelling can identify multiple recordings. Require a choice.
  const exactMatch = exactMatches.length === 1 ? exactMatches[0] : null;
  const resolvedRecord = verifiedSelectedRecord || exactMatch;
  const searchPending = name.trim() !== '' && nameSearch.loading && !verifiedSelectedRecord;
  const audioRef = useRef(null);
  const audioRefs = useRef(new Map());
  const resumeRadioRef = useRef(null);
  const resultRef = useRef(null);
  const inputId = useId();
  const radio = useRadio();
  const allowance = useSantaMessageAllowance();
  const coolingDown = allowance.secondsLeft > 0;

  useEffect(() => {
    let frame;
    let stopSettling;
    if (hasAccess && !showDetailLink) {
      // Announce the unlocked studio without letting native focus scroll past
      // the section introduction. Page entry handles new/returning visits;
      // successful signup on this page explicitly returns to the section.
      makerHeadingRef.current?.focus({ preventScroll: true });
      // Let removal of the focused signup fields finish (including the
      // browser's scroll anchoring) before measuring the section destination.
      if (!previousAccess.current) frame = requestAnimationFrame(() => {
        stopSettling = settleSantaMessageDeskAfterEntry();
      });
    }
    previousAccess.current = hasAccess;
    return () => {
      cancelAnimationFrame(frame);
      stopSettling?.();
    };
  }, [hasAccess, showDetailLink]);
  // Keep server/client hydration deterministic; choose once on the client,
  // rather than changing the example whenever the user types or counts refresh.
  useEffect(() => { setExampleName(randomSantaExample()); }, []);
  useEffect(() => {
    let stopSettling;
    if (messages.length) {
      makerHeadingRef.current?.focus({ preventScroll: true });
      if (window.matchMedia('(max-width: 767px)').matches) {
        stopSettling = settleSantaMessageDeskAfterEntry(makerHeadingRef.current);
      } else {
        makerHeadingRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
      }
    }
    setAudioErrors(previous => Object.fromEntries(messages.map(message => [message.key, previous[message.key] || false])));
    return () => stopSettling?.();
  }, [messages]);
  useEffect(() => () => {
    requestRef.current?.abort();
    nameRequestRef.current?.abort();
  }, []);

  const updateName = value => {
    if (coolingDown) return;
    nameRequestRef.current?.abort();
    nameRequestRef.current = null;
    setNameRequest({ key: '', status: 'idle', message: '' });
    resumeRadioRef.current = null;
    requestRef.current?.abort();
    requestRef.current = null;
    setBusy(false);
    audioRef.current?.pause();
    setName(value);
    setSelectedRecord(null);
    setValidation('');
    setActiveOption(-1);
  };
  // Preview handoffs can happen more than once on the same mounted maker.
  // Retain only the text through signup; never choose a recording or submit.
  const appliedPendingName = useRef(null);
  useEffect(() => {
    // A checked name can personalise gifts even while audio creation is cooling down.
    if (pendingName?.name) setGiftPreviewName(pendingName.name);
  }, [pendingName]);
  useEffect(() => {
    if (!pendingName || pendingName === appliedPendingName.current || coolingDown) return;
    appliedPendingName.current = pendingName;
    updateName(pendingName.name);
    setSuggesting(false);
  }, [pendingName, coolingDown]);
  const submitNameRequest = async () => {
    const requested = normaliseRequestedName(name);
    if (!requested || nameSearch.loading || nameSearch.error || nameSearch.warning || suggestions.length) return;
    if (nameRequestRef.current) return;
    const controller = new AbortController();
    const requestKey = requested.key;
    nameRequestRef.current = controller;
    setNameRequest({ key: requestKey, status: 'pending', message: '' });
    const timeout = setTimeout(() => controller.abort(new Error('Saving took too long. Please retry; the same request will not be counted twice.')), 25000);
    let storageWarning = '';
    try {
      const token = nameRequestToken(requestKey);
      storageWarning = token.remembered ? '' : 'Your browser cannot remember retries after a refresh. Keep this page open when retrying.';
      const response = await fetch('/api/name-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: requested.name, requestId: token.id }),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || data.message || 'Santa could not save that request. Please try again.');
      if (data.saved !== true || data.name !== requested.name ||
          typeof data.message !== 'string' || !data.message.trim()) {
        throw new Error('Santa’s request desk returned an unexpected reply. Please try again.');
      }
      if (nameRequestRef.current === controller && normaliseRequestedName(name)?.key === requestKey) {
        setNameRequest({ key: requestKey, status: 'success', message: data.message,
          warning: storageWarning });
      }
    } catch (error) {
      if (nameRequestRef.current === controller && error.name !== 'AbortError' &&
        normaliseRequestedName(name)?.key === requestKey) {
        setNameRequest({
          key: requestKey,
          status: 'error',
          message: error.message || 'Santa could not save that request. Please try again.',
          warning: storageWarning,
        });
      }
    } finally {
      clearTimeout(timeout);
      if (nameRequestRef.current === controller) nameRequestRef.current = null;
    }
  };
  const selectName = record => {
    updateName(record.name);
    setSelectedRecord(record);
    setGiftPreviewName(record.name);
    setSuggesting(false);
  };
  const submit = async event => {
    event.preventDefault();
    if (requestRef.current || allowance.pending || coolingDown) return;
    resumeRadioRef.current = null;
    setSuggesting(false);
    audioRef.current?.pause();
    const recording = resolvedRecord;
    if (!recording) {
      setValidation(name.trim()
        ? nameSearch.error || nameSearch.warning || (nameSearch.loading
          ? 'Please wait while Santa checks the name list.'
          : 'We don’t have a recording for that name yet. Choose one of the suggested names.')
        : 'Please enter a child’s name, then choose a suggestion.');
      return;
    }
    setValidation('');
    setGiftPreviewName(recording.name);
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true);
    try {
      const blob = await allowance.create(async outro => {
        // The preview promises name-free request URLs through creation too.
        // Its POST still uses the same allowance and server-side saved cache,
        // without the browser's name-bearing greeting lookup/hosted MP3 URL.
        const saved = keepSignupInPlace ? null
          : await trySavedSantaGreeting(recording, controller.signal, { outro });
        if (saved) return saved;
        const response = await fetch('/api/santa-message', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: recording.id, outro }), signal: controller.signal,
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || 'Unable to create the message. Please try again.');
        }
        if (!response.headers.get('content-type')?.startsWith('audio/mpeg')) {
          throw new Error('The message service did not return an MP3. Please try again shortly.');
        }
        const blob = await response.blob();
        if (!blob.size) throw new Error('The message service returned an empty recording. Please try again.');
        return blob;
      }, controller.signal);
      if (requestRef.current === controller) {
        remember(recording, blob);
      }
    } catch (error) {
      if (requestRef.current === controller && error.name !== 'AbortError') setValidation(error.message);
    } finally {
      if (requestRef.current === controller) { setBusy(false); requestRef.current = null; }
    }
  };
  const pauseRadio = event => {
    audioRef.current = event.currentTarget;
    for (const audio of audioRefs.current.values()) {
      if (audio !== event.currentTarget) audio.pause();
    }
    const resume = radio?.pauseForMessage();
    if (resume) resumeRadioRef.current = resume;
  };
  const finishMessage = event => {
    if (event.currentTarget !== audioRef.current) return;
    const resume = resumeRadioRef.current;
    resumeRadioRef.current = null;
    resume?.();
  };
  const renderResults = () => messages.map((message, index) => <div key={message.key} className="message-result" ref={index === messages.length - 1 ? resultRef : null} tabIndex={-1} aria-label={`Santa’s greeting for ${message.name}`}>
    <p className="message-postmark">A greeting is waiting</p>
    <h4>To {message.name} from Santa</h4>
    <div className="message-player-row">
      <audio ref={audio => {
        if (audio) audioRefs.current.set(message.key, audio);
        else audioRefs.current.delete(message.key);
      }} src={message.url} controls preload="none" onPlay={pauseRadio} onEnded={finishMessage} onError={event => {
        if (audioRef.current === event.currentTarget) resumeRadioRef.current = null;
        setAudioErrors(previous => ({ ...previous, [message.key]: true }));
      }} aria-label={`Play Santa’s greeting for ${message.name}`} />
      <SantaGreetingShare message={message} />
    </div>
    {audioErrors[message.key] && <div role="alert"><p className="message-audio-error">Santa’s recording couldn’t be played. Please try loading it again, or use the download link below.</p><button className="message-retry" type="button" onClick={() => {
      setAudioErrors(previous => ({ ...previous, [message.key]: false }));
      audioRefs.current.get(message.key)?.load();
    }}>Reload recording</button></div>}
    <div className="message-download-actions">
      <div className="message-download-links">
        <a className="message-download" href={message.url} download={message.downloadName}>Download your audio <span aria-hidden="true">↓</span></a>
      </div>
    </div>
  </div>);

  return <section className="santa-message-section" id="santa-messages">
    <div className="container message-layout">
      <div className="message-intro">
        <p className="eyebrow">A little North Pole experiment</p>
        <h2 className="santa-message-heading">FREE Personalised message from Santa</h2>
        <SantaVoiceTagline />
        {!hasAccess && <SantaMessageExample onExampleNameChange={setActiveExampleName} />}
        <p className="message-free-intro">No Artificial Intelligence here. A real Human recorded message from Santa, aka Father Christmas to your little Human.{' '}<br />Click to enter Studio B, add your contact details, choose the name from <span className="message-intro-name-count">{availableNamesText}</span> currently, create and instantly download your short FREE personalised message from Santa.</p>
        <p className="message-studio-intro">Or, why not enter Studio - A and have a bespoke message from Santa?<sup>**</sup> You&apos;ll also receive some festive goodies. See below.</p>
        <p className="message-studio-availability"><small>** Coming early November</small></p>
      </div>
      <div className="santa-message-aside">
      <div className={`santa-message-box${hasAccess ? '' : ' message-access-box'}`}>
        <div className="message-card-top">
          <span className="message-seal" aria-hidden="true">S</span>
          <div className="message-card-heading">
            <p className="message-postmark">The North Pole Recording Studio</p>
        <div className="message-name-status">
          <p className="message-name-hint message-name-count" role="status" aria-live="off">
            {availableNamesText}
          </p>
          {nameSearch.hostedCount > 0 && <span className="message-recording-indicator" title="North Pole recording studio">
            <span className="message-recording-dot" aria-hidden="true" />
            Recording (Studio - B)
          </span>}
        </div>
          </div>
        </div>
        {nameSearch.hostedCount === null && !nameSearch.loading && !hasAccess &&
          <button className="message-retry" type="button" onClick={nameSearch.refresh}>Retry name total</button>}
        {!hasAccess ? <SantaMessageAccessForm keepInPlace={keepSignupInPlace} /> : <>
        <h3 ref={makerHeadingRef} tabIndex={-1}>{messages.length ? 'Download your free message' : 'Download your free Santa greeting'}</h3>
        {!!messages.length && <div className="message-wait-downloads">
          {renderResults()}
        </div>}
        {coolingDown && !messages.length && <SantaCooldownNotice availableAt={allowance.availableAt} />}
        {coolingDown && !allowance.remembered && <p className="message-name-hint" role="status">Your browser can’t remember the message allowance. The limit works while this page is open, but leaving or refreshing may reset it.</p>}
        {!coolingDown && <>
        <p className="form-desc">Hey {greetingName || 'there'}, Search for the name and press Create message.</p>
        <form onSubmit={submit} noValidate>
          <label className="message-name-label" htmlFor={inputId}>First Name</label>
          <div className="message-name-picker">
          <input className="message-name-input" id={inputId} type="text" role="combobox" disabled={coolingDown} aria-autocomplete="list" aria-expanded={suggesting && suggestions.length > 0} aria-controls={`${inputId}-options`} aria-activedescendant={suggesting && activeOption >= 0 ? `${inputId}-option-${activeOption}` : undefined} value={name}
            onChange={event => { updateName(event.target.value); setSuggesting(true); }}
            onFocus={() => setSuggesting(true)} onBlur={() => {
              if (!suggestionTouchRef.current) setSuggesting(false);
            }}
            onKeyDown={event => {
              if (event.key === 'Escape') { setSuggesting(false); setActiveOption(-1); }
              if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && suggestions.length) {
                event.preventDefault(); setSuggesting(true);
                setActiveOption(current => (current + (event.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length);
              }
              if (event.key === 'Enter' && suggesting && activeOption >= 0 && suggestions[activeOption]) { event.preventDefault(); selectName(suggestions[activeOption]); }
            }}
            placeholder={santaNamePlaceholder(exampleName)} autoComplete="off" autoCapitalize="words" spellCheck={false} aria-invalid={!!validation} aria-describedby={`${inputId}-hint${validation ? ` ${inputId}-error` : ''}`} />
          {suggesting && suggestions.length > 0 && <ul className="message-suggestions" id={`${inputId}-options`} role="listbox" aria-label="Available names">
            {suggestions.map((suggestion, index) => <li key={suggestion.id} id={`${inputId}-option-${index}`} role="option" aria-selected={index === activeOption}
              onPointerDown={event => {
                // Keep focus in the input. iOS can suppress the compatibility
                // click after this, so touch selection completes on pointerup.
                event.preventDefault();
                suppressTouchClickRef.current = event.pointerType === 'touch';
                suggestionTouchRef.current = event.pointerType === 'touch'
                  ? { id: suggestion.id, pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false } : null;
              }}
              onPointerMove={event => {
                const touch = suggestionTouchRef.current;
                if (touch && Math.hypot(event.clientX - touch.x, event.clientY - touch.y) > 10) touch.moved = true;
              }}
              onPointerUp={event => {
                const touch = suggestionTouchRef.current;
                suggestionTouchRef.current = null;
                if (!touch || touch.pointerId !== event.pointerId) return;
                event.preventDefault();
                if (!touch.moved && touch.id === suggestion.id
                  && Math.hypot(event.clientX - touch.x, event.clientY - touch.y) <= 10) selectName(suggestion);
                else if (document.activeElement?.id !== inputId) setSuggesting(false);
              }}
              onPointerCancel={() => {
                suggestionTouchRef.current = null;
                if (document.activeElement?.id !== inputId) setSuggesting(false);
              }}
              onClick={event => {
                if (!suppressTouchClickRef.current || event.detail === 0) selectName(suggestion);
              }}>{suggestion.name}{suggestion.variant && <small> — {suggestion.variant}</small>}</li>)}
          </ul>}
          </div>
          <span className="message-name-hint" id={`${inputId}-hint`} aria-live="polite">
            {verifiedSelectedRecord ? `${verifiedSelectedRecord.name} is selected.`
              : exactMatch ? `A recording for ${exactMatch.name} is available.`
              : ''}
          </span>
          {nameSearch.loading && name.trim() && <p className="message-search-status" role="status">Checking Santa’s hosted name list…</p>}
          {nameSearch.warning && <div className="message-search-notice" role="status">
            <p>{nameSearch.warning}</p>
            <p>Only existing local recordings are known right now; this list may be incomplete.</p>
            <button className="message-retry" type="button" onClick={nameSearch.refresh}>Refresh name list</button>
          </div>}
          {nameSearch.error && <div className="message-search-notice message-search-error" role="alert">
            <p>{nameSearch.error}</p>
            <button className="message-retry" type="button" onClick={nameSearch.refresh}>Retry name search</button>
          </div>}
          {!nameSearch.loading && !nameSearch.error && name.trim() && !suggestions.length && <p className="message-search-status" role="status">
            {nameSearch.warning
              ? 'The full hosted name list could not be checked. Try refreshing the names.'
              : 'No matching recording yet. Try another name.'}
          </p>}
          {(() => {
            const requested = normaliseRequestedName(name);
             const canRequest = !keepSignupInPlace && !!requested && !nameSearch.loading && !nameSearch.error &&
              !nameSearch.warning && suggestions.length === 0;
            const visibleRequest = canRequest && (nameRequest.key === requested.key ? nameRequest : null);
            return canRequest ? <div className="name-request">
              <button className="name-request-button" type="button"
                onClick={submitNameRequest}
                 disabled={['pending', 'success'].includes(visibleRequest?.status)}
                aria-describedby={visibleRequest && visibleRequest.status !== 'idle' ? `${inputId}-request-status` : undefined}>
                {visibleRequest?.status === 'pending' ? 'Sending request…'
                  : visibleRequest?.status === 'error' ? 'Retry name request'
                    : visibleRequest?.status === 'success' ? 'Request saved'
                    : 'Request this name'}
              </button>
              {visibleRequest?.status === 'pending' && <p className="name-request-note" id={`${inputId}-request-status`} role="status">Sending this request to Santa’s list. This won’t create a recording or use your message allowance.</p>}
              {visibleRequest?.status === 'success' && <p className="name-request-note success" id={`${inputId}-request-status`} role="status">{visibleRequest.message}</p>}
              {visibleRequest?.warning && <p className="name-request-note">{visibleRequest.warning}</p>}
              {visibleRequest?.status === 'error' && <p className="name-request-note" id={`${inputId}-request-status`} role="alert">{visibleRequest.message} You can retry when you’re ready.</p>}
            </div> : null;
          })()}
          {validation && <p className="message-validation" id={`${inputId}-error`} role="alert">{validation}</p>}
          <button className="btn-red message-submit" type="submit" disabled={busy || allowance.pending || coolingDown || searchPending}>{busy ? 'Santa Recording...' : 'Create message'} <span aria-hidden="true">→</span></button>
          {busy && <p role="status" className="message-name-hint">Santa is recording a personal message for you. Do hold on one moment...</p>}
          {!busy && allowance.pending && <p role="status" className="message-name-hint">Another message is being created. Please wait for it to finish.</p>}
        </form>
        </>}
        <p className="service-notice">Free to create and download. Messages are not sent by email.</p>
        {!sessionRemembered && <p className="message-name-hint" role="status">Your browser can’t remember access. The studio stays open while you browse, but refreshing this tab may ask for your details again.</p>}
        </>}
      </div>
      {hasAccess && <SantaMessageExample onExampleNameChange={setActiveExampleName} />}
      </div>
      <SantaStudioPromotion activeExampleName={activeExampleName} availableNamesText={availableNamesText}
        previewName={giftPreviewName} />
    </div>
  </section>;
}
