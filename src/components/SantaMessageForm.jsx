import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { findSantaMessage } from '../data/santaMessages.js';
import { useRadio } from './RadioProvider.jsx';
import './SantaMessageForm.css';

export default function SantaMessageForm({ showDetailLink = true }) {
  const [name, setName] = useState('');
  const [message, setMessage] = useState(null);
  const [validation, setValidation] = useState('');
  const [audioError, setAudioError] = useState(false);
  const audioRef = useRef(null);
  const resultRef = useRef(null);
  const inputId = useId();
  const radio = useRadio();

  useEffect(() => {
    if (message) resultRef.current?.focus();
  }, [message]);

  const changeName = event => {
    audioRef.current?.pause();
    setName(event.target.value);
    setMessage(null);
    setValidation('');
    setAudioError(false);
  };
  const submit = event => {
    event.preventDefault();
    audioRef.current?.pause();
    setAudioError(false);
    const recording = findSantaMessage(name);
    setMessage(recording);
    setValidation(recording ? '' : name.trim()
      ? 'We don’t have a recording for that name yet. Only Arabella is available in this experiment.'
      : 'Please enter a child’s name. Try Arabella, the name available in this experiment.');
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
        <p className="form-desc">We’re starting with one name: <strong>Arabella</strong>. We hope to bring this little bit of magic to thousands of names in the future.</p>
        <form onSubmit={submit} noValidate>
          <label className="message-name-label" htmlFor={inputId}>Child’s first name</label>
          <input className="message-name-input" id={inputId} type="text" value={name} onChange={changeName} placeholder="e.g. Arabella" autoComplete="off" autoCapitalize="words" spellCheck={false} aria-invalid={!!validation} aria-describedby={`${inputId}-hint${validation ? ` ${inputId}-error` : ''}`} />
          <span className="message-name-hint" id={`${inputId}-hint`}>Available now: Arabella. This finds an existing recording; it doesn’t generate a new one.</span>
          {validation && <p className="message-validation" id={`${inputId}-error`} role="alert">{validation}</p>}
          <button className="btn-red message-submit" type="submit">Find Santa’s message <span aria-hidden="true">→</span></button>
        </form>
        {message && <div className="message-result" ref={resultRef} tabIndex={-1} aria-label={`Santa’s greeting for ${message.name}`}>
          <p className="message-postmark">A greeting is waiting</p>
          <h4>For {message.name}, from Santa</h4>
          <p>Your recorded message is ready. Press play when you’re together. The radio will pause while Santa speaks.</p>
          <audio ref={audioRef} src={message.url} controls preload="none" onPlay={pauseRadio} onError={() => setAudioError(true)} aria-label={`Play Santa’s greeting for ${message.name}`} />
          {audioError && <div role="alert"><p className="message-audio-error">Santa’s recording couldn’t be played. Please try loading it again, or use the download link below.</p><button className="message-retry" type="button" onClick={() => { setAudioError(false); audioRef.current?.load(); }}>Reload recording</button></div>}
          <a className="message-download" href={message.url} download={message.downloadName}>Download {message.name}’s greeting <span aria-hidden="true">↓</span></a>
          <p className="message-name-hint">On iPhone, you may need to use Share → Save to Files to keep the MP3.</p>
        </div>}
        <p className="service-notice">Free to listen and download. No signup. The name you type isn’t sent or stored.</p>
      </div>
    </div>
  </section>;
}
