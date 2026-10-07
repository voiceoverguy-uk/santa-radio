import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { findSantaMessage, searchSantaNames, santaNames } from '../data/santaMessages.js';
import { useRadio } from './RadioProvider.jsx';
import './SantaMessageForm.css';

export default function SantaMessageForm({ showDetailLink = true }) {
  const [name, setName] = useState('');
  const [message, setMessage] = useState(null);
  const [validation, setValidation] = useState('');
  const [audioError, setAudioError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [activeOption, setActiveOption] = useState(-1);
  const requestRef = useRef(null);
  const suggestions = searchSantaNames(name);
  const audioRef = useRef(null);
  const resultRef = useRef(null);
  const inputId = useId();
  const radio = useRadio();

  useEffect(() => {
    if (message) resultRef.current?.focus();
  }, [message]);
  useEffect(() => () => {
    if (message?.url) URL.revokeObjectURL(message.url);
  }, [message]);
  useEffect(() => () => requestRef.current?.abort(), []);

  const updateName = value => {
    requestRef.current?.abort();
    requestRef.current = null;
    setBusy(false);
    audioRef.current?.pause();
    setName(value);
    setMessage(null);
    setValidation('');
    setAudioError(false);
    setActiveOption(-1);
  };
  const selectName = value => {
    updateName(value);
    setSuggesting(false);
  };
  const submit = async event => {
    event.preventDefault();
    if (busy) return;
    setSuggesting(false);
    audioRef.current?.pause();
    setAudioError(false);
    const recording = findSantaMessage(name);
    setMessage(null);
    if (!recording) {
      setValidation(name.trim()
        ? 'We don’t have a recording for that name yet. Choose one of the suggested names.'
        : 'Please enter a child’s name, then choose a suggestion.');
      return;
    }
    setValidation('');
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true);
    try {
      const response = await fetch('/api/santa-message', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: recording.id }), signal: controller.signal,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Unable to create the message. Please try again.');
      }
      const blob = await response.blob();
      if (requestRef.current === controller) setMessage({ ...recording, url: URL.createObjectURL(blob) });
    } catch (error) {
      if (requestRef.current === controller && error.name !== 'AbortError') setValidation(error.message);
    } finally {
      if (requestRef.current === controller) { setBusy(false); requestRef.current = null; }
    }
  };
  const pauseRadio = () => {
    if (radio?.status === 'playing' || radio?.status === 'loading') radio.togglePlay();
  };

  return <section className="santa-message-section" id="santa-messages">
    <div className="container message-layout">
      <div className="message-intro">
        <p className="eyebrow">A little North Pole experiment</p>
        <h2 className="santa-message-heading">Their name.<br />Santa’s voice.<br />A little Christmas magic.</h2>
        <p>A real recorded greeting from Santa, with your child’s name in it. Find their message, press play together, or save it for a special Christmas moment.</p>
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
      <div className="santa-message-box">
        <div className="message-card-top"><span className="message-seal" aria-hidden="true">S</span><div><p className="message-postmark">The North Pole message desk</p><small>A recorded hello, ready to keep</small></div></div>
        <h3>Find your free Santa greeting</h3>
        <p className="form-desc">Choose from {santaNames.length} recorded names. Santa’s greeting is mixed especially for your selection when you press Create message.</p>
        <form onSubmit={submit} noValidate>
          <label className="message-name-label" htmlFor={inputId}>Child’s first name</label>
          <div className="message-name-picker">
          <input className="message-name-input" id={inputId} type="text" role="combobox" aria-autocomplete="list" aria-expanded={suggesting && suggestions.length > 0} aria-controls={`${inputId}-options`} aria-activedescendant={suggesting && activeOption >= 0 ? `${inputId}-option-${activeOption}` : undefined} value={name}
            onChange={event => { updateName(event.target.value); setSuggesting(true); }}
            onFocus={() => setSuggesting(true)} onBlur={() => setSuggesting(false)}
            onKeyDown={event => {
              if (event.key === 'Escape') { setSuggesting(false); setActiveOption(-1); }
              if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && suggestions.length) {
                event.preventDefault(); setSuggesting(true);
                setActiveOption(current => (current + (event.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length);
              }
              if (event.key === 'Enter' && suggesting && activeOption >= 0) { event.preventDefault(); selectName(suggestions[activeOption]); }
            }}
            placeholder="Start typing, e.g. Olivia" autoComplete="off" autoCapitalize="words" spellCheck={false} aria-invalid={!!validation} aria-describedby={`${inputId}-hint${validation ? ` ${inputId}-error` : ''}`} />
          {suggesting && suggestions.length > 0 && <ul className="message-suggestions" id={`${inputId}-options`} role="listbox" aria-label="Available names">
            {suggestions.map((suggestion, index) => <li key={suggestion} id={`${inputId}-option-${index}`} role="option" aria-selected={index === activeOption}
              onPointerDown={event => event.preventDefault()} onClick={() => selectName(suggestion)}>{suggestion}</li>)}
          </ul>}
          </div>
          <span className="message-name-hint" id={`${inputId}-hint`} aria-live="polite">{suggesting && name.trim() && !suggestions.length ? 'No matching recording yet. Try another name.' : 'Start typing to find a recorded name.'}</span>
          {validation && <p className="message-validation" id={`${inputId}-error`} role="alert">{validation}</p>}
          <button className="btn-red message-submit" type="submit" disabled={busy}>{busy ? 'Santa Recording...' : 'Create message'} <span aria-hidden="true">→</span></button>
          {busy && <p role="status" className="message-name-hint">Santa is recording a personal message for you. Do hold on one moment...</p>}
        </form>
        {message && <div className="message-result" ref={resultRef} tabIndex={-1} aria-label={`Santa’s greeting for ${message.name}`}>
          <p className="message-postmark">A greeting is waiting</p>
          <h4>For {message.name}, from Santa</h4>
          <p>Your recorded message is ready. The radio will pause while Santa speaks.</p>
          <audio ref={audioRef} src={message.url} controls preload="none" onPlay={pauseRadio} onError={() => setAudioError(true)} aria-label={`Play Santa’s greeting for ${message.name}`} />
          {audioError && <div role="alert"><p className="message-audio-error">Santa’s recording couldn’t be played. Please try loading it again, or use the download link below.</p><button className="message-retry" type="button" onClick={() => { setAudioError(false); audioRef.current?.load(); }}>Reload recording</button></div>}
          <a className="message-download" href={message.url} download={message.downloadName}>Download {message.name}’s greeting <span aria-hidden="true">↓</span></a>
          <p className="message-name-hint">On iPhone, you may need to use Share → Save to Files to keep the MP3.</p>
        </div>}
        <p className="service-notice">Free. No signup. Only the selected name is sent to mix your message. The server deletes its temporary MP3 after sending it; download your copy before leaving this page.</p>
      </div>
    </div>
  </section>;
}
