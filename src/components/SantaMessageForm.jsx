import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRadio } from './RadioProvider.jsx';
import SantaMessageAccessForm from './SantaMessageAccessForm.jsx';
import SantaMessageShare, { SantaGreetingShare } from './SantaMessageShare.jsx';
import { useSantaMessageAccess } from './SantaMessageAccessProvider.jsx';
import useSantaMessageAllowance from './useSantaMessageAllowance.js';
import useSantaMessageHistory from './useSantaMessageHistory.js';
import useSantaNames from './useSantaNames.js';
import { randomSantaExample, santaNamePlaceholder } from '../lib/santaNamePlaceholder.js';
import { normaliseRequestedName } from '../lib/santaNameRequests.js';
import { nameRequestToken } from '../lib/santaNameRequestTokens.js';
import './SantaNameRequest.css';
import './SantaMessageForm.css';

export default function SantaMessageForm({ showDetailLink = true, initialName = '' }) {
  const { hasAccess, sessionRemembered } = useSantaMessageAccess();
  const makerHeadingRef = useRef(null);
  const [name, setName] = useState(initialName);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [exampleName, setExampleName] = useState('Olivia');
  const { messages, remember } = useSantaMessageHistory();
  const [validation, setValidation] = useState('');
  const [audioErrors, setAudioErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [activeOption, setActiveOption] = useState(-1);
  const requestRef = useRef(null);
  const nameRequestRef = useRef(null);
  const [nameRequest, setNameRequest] = useState({ key: '', status: 'idle', message: '' });
  const nameSearch = useSantaNames(name, hasAccess);
  const suggestions = nameSearch.records;
  const verifiedSelectedRecord = selectedRecord && selectedRecord.name === name.trim()
    ? selectedRecord : null;
  const exactMatch = !nameSearch.loading && !nameSearch.error
    ? suggestions.find(record => [record.name, record.id].some(value =>
      value.normalize('NFKC').toLocaleLowerCase('en-GB') ===
      name.normalize('NFKC').trim().toLocaleLowerCase('en-GB'))) : null;
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
  const countdown = `${Math.floor(allowance.secondsLeft / 60).toString().padStart(2, '0')}:${(allowance.secondsLeft % 60).toString().padStart(2, '0')}`;

  useEffect(() => {
    if (hasAccess && !showDetailLink) makerHeadingRef.current?.focus();
  }, [hasAccess, showDetailLink]);
  // Keep server/client hydration deterministic; choose once on the client,
  // rather than changing the example whenever the user types or counts refresh.
  useEffect(() => { setExampleName(randomSantaExample()); }, []);
  useEffect(() => {
    if (messages.length) resultRef.current?.focus();
    setAudioErrors(previous => Object.fromEntries(messages.map(message => [message.key, previous[message.key] || false])));
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
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true);
    try {
      const blob = await allowance.create(async () => {
        const response = await fetch('/api/santa-message', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: recording.id }), signal: controller.signal,
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
  const listenToRadio = () => {
    if (!radio || radio.status === 'playing' || radio.status === 'loading') return;
    resumeRadioRef.current = null;
    audioRef.current?.pause();
    radio.togglePlay();
  };

  return <section className="santa-message-section" id="santa-messages">
    <div className="container message-layout">
      <div className="message-intro">
        <p className="eyebrow">A little North Pole experiment</p>
        <h2 className="santa-message-heading">Their name.<br />Santa’s voice.<br />A little Christmas magic.</h2>
        <p>A real recorded greeting from Santa, with your child’s name in it. Open the message desk with your adult contact details, then choose a recorded name, listen together and download your free MP3.</p>
        <svg className="north-pole-letter" viewBox="0 0 360 240" fill="none" aria-hidden="true">
          <ellipse cx="180" cy="218" rx="114" ry="10" fill="#09291e" />
          <path d="M47 103L178 28L311 103" stroke="#d9bc72" strokeWidth="2" />
          <path d="M65 66H292V182H65z" fill="#f0e3c3" transform="rotate(-7 178 124)" />
          <path d="M108 91L247 74M112 105L232 90" stroke="#b5a47f" strokeWidth="2" />
          <path d="M47 103H311V207H47z" fill="#ead6a6" />
          <path d="M47 207L155 128M311 207L205 128" stroke="#c3a46b" strokeWidth="2" />
          <path d="M47 103L180 170L311 103" fill="#f6e9ca" stroke="#c3a46b" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="180" cy="161" r="24" fill="#a82f36" stroke="#c46c58" strokeWidth="3" />
          <path d="M190 150C184 144 170 145 170 153C170 162 190 156 190 167C190 175 176 177 169 170" stroke="#efcf8d" strokeWidth="2" strokeLinecap="round" />
          <path d="M26 61V77M18 69H34M329 46V66M319 56H339M329 166V178M323 172H335" stroke="#d9bc72" strokeWidth="2" strokeLinecap="round" />
          <circle cx="42" cy="158" r="2" fill="#d9bc72" /><circle cx="290" cy="39" r="2" fill="#d9bc72" />
        </svg>
        {showDetailLink && <Link to="/free-santa-message" className="message-detail-link">Visit Santa’s message desk <span aria-hidden="true">→</span></Link>}
      </div>
      <div className={`santa-message-box${hasAccess ? '' : ' message-access-box'}`}>
        <div className="message-card-top"><span className="message-seal" aria-hidden="true">S</span><div><p className="message-postmark">The North Pole message desk</p><small>A recorded hello, ready to keep</small></div></div>
        {!hasAccess ? <SantaMessageAccessForm /> : <>
        <h3 ref={makerHeadingRef} tabIndex={-1}>Download your free Santa greeting</h3>
        <p className="form-desc">New names are being made available all the time to Santa's list, so make your selection and press Create message.</p>
        <p className="message-name-hint message-name-count" role="status">
          {nameSearch.hostedCount !== null
            ? `${nameSearch.hostedCount.toLocaleString('en-GB')} ${nameSearch.hostedCount === 1 ? 'name' : 'names'} available to download`
            : nameSearch.loading ? 'Checking how many names are available…' : 'Name total temporarily unavailable.'}
        </p>
        {coolingDown ? <div className="message-wait">
          <p role="status">You’ve created two free Santa messages for now. Please allow Santa 10 minutes to recover to generate more. Meanwhile why not enjoy Christmas music while you wait or tell your friends?</p>
          <p className="message-countdown">More messages in <span role="timer" aria-live="off">{countdown}</span></p>
          <button className="message-retry" type="button" onClick={listenToRadio} disabled={!radio || radio.status === 'playing' || radio.status === 'loading'}>
            {radio?.status === 'playing' ? 'Santa Radio is playing' : radio?.status === 'loading' ? 'Connecting to Santa Radio…' : 'Listen to Santa Radio'}
          </button>
          <SantaMessageShare />
          {radio?.error && <p className="message-audio-error" role="alert">{radio.error}</p>}
        </div> : null}
        {coolingDown && !allowance.remembered && <p className="message-name-hint" role="status">Your browser can’t remember the message allowance. The limit works while this page is open, but leaving or refreshing may reset it.</p>}
        <form onSubmit={submit} noValidate>
          <label className="message-name-label" htmlFor={inputId}>Child’s first name</label>
          <div className="message-name-picker">
          <input className="message-name-input" id={inputId} type="text" role="combobox" disabled={coolingDown} aria-autocomplete="list" aria-expanded={suggesting && suggestions.length > 0} aria-controls={`${inputId}-options`} aria-activedescendant={suggesting && activeOption >= 0 ? `${inputId}-option-${activeOption}` : undefined} value={name}
            onChange={event => { updateName(event.target.value); setSuggesting(true); }}
            onFocus={() => setSuggesting(true)} onBlur={() => setSuggesting(false)}
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
              onPointerDown={event => event.preventDefault()} onClick={() => selectName(suggestion)}>{suggestion.name}</li>)}
          </ul>}
          </div>
          <span className="message-name-hint" id={`${inputId}-hint`} aria-live="polite">
            {verifiedSelectedRecord ? `${verifiedSelectedRecord.name} is selected.`
              : exactMatch ? `A recording for ${exactMatch.name} is available.`
              : 'Start typing to find a recorded name.'}
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
            const canRequest = !!requested && !nameSearch.loading && !nameSearch.error &&
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
        {messages.map((message, index) => <div key={message.key} className="message-result" ref={index === messages.length - 1 ? resultRef : null} tabIndex={-1} aria-label={`Santa’s greeting for ${message.name}`}>
          <p className="message-postmark">A greeting is waiting</p>
          <h4>For {message.name}, from Santa</h4>
          <p>(The radio will pause while playing)</p>
          <audio ref={audio => {
            if (audio) audioRefs.current.set(message.key, audio);
            else audioRefs.current.delete(message.key);
          }} src={message.url} controls preload="none" onPlay={pauseRadio} onEnded={finishMessage} onError={event => {
            if (audioRef.current === event.currentTarget) resumeRadioRef.current = null;
            setAudioErrors(previous => ({ ...previous, [message.key]: true }));
          }} aria-label={`Play Santa’s greeting for ${message.name}`} />
          {audioErrors[message.key] && <div role="alert"><p className="message-audio-error">Santa’s recording couldn’t be played. Please try loading it again, or use the download link below.</p><button className="message-retry" type="button" onClick={() => {
            setAudioErrors(previous => ({ ...previous, [message.key]: false }));
            audioRefs.current.get(message.key)?.load();
          }}>Reload recording</button></div>}
          <a className="message-download" href={message.url} download={message.downloadName}>Download {message.name}’s greeting <span aria-hidden="true">↓</span></a>
          <p className="message-name-hint">On iPhone, choose Share → Save to Files to keep the MP3.</p>
          <SantaGreetingShare message={message} />
        </div>)}
        <p className="service-notice">Free to create and download here. The message is not sent by email.</p>
        {!sessionRemembered && <p className="message-name-hint" role="status">Your browser can’t remember access. The desk stays open while you browse, but refreshing this tab may ask for your details again.</p>}
        </>}
      </div>
    </div>
  </section>;
}
