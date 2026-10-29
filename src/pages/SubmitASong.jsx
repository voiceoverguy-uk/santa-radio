import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  buildSponsorshipMessage, emptySongFields, SONG_REQUEST_TIMEOUT_MS,
  SongSubmissionError, submitSong, validateSongFields,
} from '../lib/songSubmission.js';
import './SubmitASong.css';

export default function SubmitASong() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedMode = ['song', 'sponsorship'].includes(searchParams.get('mode'))
    ? searchParams.get('mode') : 'general';
  const [mode, setMode] = useState(requestedMode);
  const isSong = mode === 'song';
  const isSponsorship = mode === 'sponsorship';
  const [fields, setFields] = useState(emptySongFields);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const formRef = useRef(null);
  const successRef = useRef(null);
  const requestRef = useRef(null);
  const lastRequestedMode = useRef(requestedMode);
  const latestRequestedMode = useRef(requestedMode);
  latestRequestedMode.current = requestedMode;

  // History navigation also changes the mode. Hold the submitted mode until
  // the active request finishes. On failure apply the current address; on
  // acceptance keep the submitted mode and confirmation visible.
  useEffect(() => {
    if (requestRef.current || requestedMode === lastRequestedMode.current) return;
    lastRequestedMode.current = requestedMode;
    setMode(requestedMode);
    setFields(previous => ({ ...previous, criteriaMet: false }));
    setErrors({});
    setError('');
    setAccepted(false);
  }, [requestedMode, pending]);

  const changeMode = nextMode => {
    if (requestRef.current || nextMode === mode) return;
    const next = new URLSearchParams(searchParams);
    if (nextMode === 'song' || nextMode === 'sponsorship') next.set('mode', nextMode);
    else next.delete('mode');
    // Update controlled radios in the same event, not a later effect.
    setMode(nextMode);
    setFields(previous => ({ ...previous, criteriaMet: false }));
    setErrors({});
    setError('');
    setAccepted(false);
    setSearchParams(next, { preventScrollReset: true });
  };

  useEffect(() => () => {
    const request = requestRef.current;
    requestRef.current = null;
    if (request) {
      clearTimeout(request.timeout);
      request.controller.abort();
    }
  }, []);
  useEffect(() => {
    if (accepted) successRef.current?.focus();
  }, [accepted]);

  const focusInvalid = fieldErrors => {
    const first = Object.keys(fieldErrors)[0];
    if (first) requestAnimationFrame(() => formRef.current?.elements.namedItem(first)?.focus());
  };
  const keepFocusVisible = event => {
    const control = event.target;
    // Moving a pointer-focused button between press and release can cancel
    // its click. This helper is for keyboard/validation focus only.
    if (!control.matches(':focus-visible')) return;
    // Native keyboard scrolling does not account for the fixed radio dock.
    // Measure after it settles; only move focus targets that would be covered.
    requestAnimationFrame(() => {
      if (!control.isConnected || document.activeElement !== control) return;
      const bounds = control.getBoundingClientRect();
      const dock = document.querySelector('.radio-dock')?.getBoundingClientRect();
      const coveredByDock = dock && bounds.right > dock.left && bounds.left < dock.right &&
        bounds.bottom > dock.top && bounds.top < dock.bottom;
      if (bounds.top < 110 || coveredByDock) {
        control.scrollIntoView({ block: 'center', behavior: 'instant' });
      }
    });
  };
  const onChange = (name, value) => {
    if (requestRef.current) return;
    setFields(previous => ({ ...previous, [name]: value }));
    setErrors(previous => ({ ...previous, [name]: undefined }));
    setError('');
  };
  const onSubmit = async event => {
    event.preventDefault();
    if (requestRef.current || accepted) return;
    const validation = validateSongFields(fields, mode);
    setErrors(validation);
    setError('');
    if (Object.keys(validation).length) {
      setError('Please check the highlighted details.');
      focusInvalid(validation);
      return;
    }
    if (fields.email_address_check) {
      setError('Your message could not be sent. Please try again.');
      return;
    }
    const request = { mode, controller: new AbortController(), timedOut: false, timeout: null };
    requestRef.current = request;
    request.timeout = setTimeout(() => {
      request.timedOut = true;
      request.controller.abort();
    }, SONG_REQUEST_TIMEOUT_MS);
    setPending(true);
    try {
      await submitSong(fields, request.controller.signal, request.mode);
      if (requestRef.current !== request) return;
      request.controller.signal.throwIfAborted();
      // Consume any address change made while pending without replacing the
      // accepted confirmation with a fresh form. Later navigation still works.
      lastRequestedMode.current = latestRequestedMode.current;
      setAccepted(true);
      setFields(emptySongFields);
    } catch (failure) {
      if (requestRef.current !== request) return;
      if (failure instanceof SongSubmissionError) {
        setErrors(failure.fieldErrors);
        setError(failure.message);
        focusInvalid(failure.fieldErrors);
      } else {
        setError(request.timedOut
          ? 'Brevo took too long to respond, so we couldn’t confirm acceptance. Your entries are still here; please try again.'
          : 'We couldn’t confirm your message with Brevo. Check your connection and try again; your entries are still here.');
      }
    } finally {
      clearTimeout(request.timeout);
      if (requestRef.current === request) {
        requestRef.current = null;
        setPending(false);
      }
    }
  };

  const field = (name, label, options = {}) => {
    const id = `song-${name.replace(':', '-')}`;
    const describedBy = [options.help, errors[name] && `${id}-error`].filter(Boolean).join(' ') || undefined;
    const props = {
      id, name, value: fields[name], onChange: event => onChange(name, event.target.value),
      required: !options.optional, readOnly: pending, autoComplete: options.autocomplete,
      maxLength: options.limit, placeholder: options.placeholder, 'aria-invalid': Boolean(errors[name]), 'aria-describedby': describedBy,
      min: options.min, max: options.max,
    };
    return <div className="song-field">
      <label htmlFor={id}>{label}{!options.optional && <span aria-hidden="true"> *</span>}</label>
      {options.textarea ? <textarea {...props} rows={5} /> : <input {...props} type={options.type || 'text'} />}
      {errors[name] && <p className="song-field-error" id={`${id}-error`}>{errors[name]}</p>}
    </div>;
  };

  return (
    <main className="submit-song-page">
      <div className="submit-hero starry-bg">
        <div className="submit-hero-content">
          <h1 className="submit-title gold-text">{isSong ? 'Submit a song to Santa Radio' : isSponsorship ? 'Christmas sponsorship enquiry' : 'Get in touch with Santa Radio'}</h1>
          <div className="submit-body" onFocusCapture={keepFocusVisible}>
            <fieldset className="contact-modes" disabled={pending}>
              <legend>What are you contacting us about?</legend>
              <div className="contact-mode-options">
                <label><input type="radio" name="contact-mode" value="general" checked={mode === 'general'}
                  onChange={() => changeMode('general')} /> General enquiry</label>
                <label><input type="radio" name="contact-mode" value="song" checked={isSong}
                  onChange={() => changeMode('song')} /> Song submission</label>
                <label><input type="radio" name="contact-mode" value="sponsorship" checked={isSponsorship}
                  onChange={() => changeMode('sponsorship')} /> Christmas sponsorship</label>
              </div>
            </fieldset>
            {isSong ? <>
            <p>Have a Christmas recording you’d like us to consider? Send your details and a listening link below. No audio upload is needed.</p>
            <section className="song-requirements" aria-labelledby="song-requirements-title">
              <h2 id="song-requirements-title">Before you send your song</h2>
              <p>Please include <strong>all five items</strong> in your message before submitting:</p>
              <ul id="song-requirements-checklist">
                <li>Artist name</li>
                <li>Song title</li>
                <li>A link to the song (YouTube, SoundCloud, Spotify etc.)</li>
                <li>A short bio or description</li>
                <li>A link to any promotion of Santa Radio</li>
              </ul>
              <p>Keep the complete message within 500 characters. Please check that both your listening and promotion links work before sending.</p>
            </section>
            <p>Submissions are considered for airplay, but sending a song does not guarantee a playlist place or an individual reply.</p>
            </> : isSponsorship ? <>
              <p>For Christmas-related brands—including gifts, decorations, festive food and attractions—ask about joining Santa Radio’s Christmas 2026 campaign.</p>
              <section className="sponsorship-offer" aria-labelledby="sponsorship-offer-title">
                <p className="sponsorship-offer__eyebrow">The 2026 Christmas package</p>
                <h2 id="sponsorship-offer-title">£2,500 · 1 November–31 December 2026</h2>
                <ul>
                  <li>Two recorded sponsor mentions each hour, 24/7 through 31 December.</li>
                  <li>A linked sponsor banner on every Santa Radio website page.</li>
                  <li>Branding on participating apps’ launch or splash screens.</li>
                </ul>
                <p>A full 61-day campaign schedules 2,928 on-air broadcasts. These are scheduled mentions, not audience impressions; a later start date means fewer scheduled broadcasts. Launch timing and campaign assets are agreed with the sponsor.</p>
              </section>
              <aside className="sponsorship-evidence" aria-labelledby="sponsorship-evidence-title">
                <h2 id="sponsorship-evidence-title">Historical figures</h2>
                <p>Google Analytics recorded approximately 65,000 active website users in 2025.</p>
                <p>Apple’s Lifetime Units report, viewed 28 October 2026, showed approximately 247,000 combined lifetime units across Santa Radio iOS/tvOS/watchOS (~59,400), Santa Radio macOS (~5,070), Christmas Radio UK (~142,000) and Fireplace Christmas Radio (~40,000). These are cumulative app acquisitions, not deduplicated people or current or active listeners.</p>
              </aside>
              <p>Share your brand, website, campaign and preferred launch date below. Sending an enquiry does not confirm a booking.</p>
            </> : <p>For press and corporate enquiries, feedback or suggestions, send us your details and message below.</p>}
            {accepted ? <div className="song-form-success" role="status" tabIndex={-1} ref={successRef}>
              <h2>{isSong ? 'Thank you for your song submission' : isSponsorship ? 'Thank you for your sponsorship enquiry' : 'Thank you for your enquiry'}</h2>
              <p>{isSong
                ? 'Brevo has accepted your submission for Santa Radio to consider. This is not a promise of airplay or a reply.'
                : isSponsorship
                  ? 'Brevo has accepted your enquiry. This does not confirm delivery to Santa Radio’s inbox or mean a sponsorship has been booked.'
                  : "Santa can't answer every message but rest assured it will be read by Head Elf at the very least."}</p>
              {isSong && <p>Provider acceptance does not confirm delivery to our inbox.</p>}
              {isSong ? <Link to="/christmas-music">Explore Christmas music</Link>
                : <a href="https://www.santaradio.co.uk/">Return to Santa Radio</a>}
            </div> : <form className="song-submission-form" ref={formRef} onSubmit={onSubmit} noValidate aria-busy={pending}>
              <p className="song-guidance">Fields marked * are required.</p>
              {isSponsorship && field('sponsorBrand', 'Company or brand', { autocomplete: 'organization', limit: 80 })}
              <div className="song-form-grid">
                {field('FIRSTNAME', isSponsorship ? 'Contact first name' : 'First name', { autocomplete: 'given-name', limit: 200 })}
                {field('LASTNAME', isSponsorship ? 'Contact surname' : 'Surname', { autocomplete: 'family-name', limit: 200 })}
              </div>
              {field('EMAIL', 'Email address', { autocomplete: 'email', type: 'email' })}
              {isSponsorship && field('sponsorWebsite', 'Brand website', {
                type: 'url', autocomplete: 'url', limit: 200, placeholder: 'https://example.com',
              })}
              {isSponsorship ? <>
                <p className="song-guidance" id="sponsorship-campaign-help">Briefly describe the product or campaign you would like to promote.</p>
                {field('sponsorCampaign', 'Product or campaign description', {
                  textarea: true, limit: 220, help: 'sponsorship-campaign-help song-message-count',
                })}
                {field('sponsorLaunchDate', 'Preferred launch date', {
                  type: 'date', autocomplete: 'off', limit: 10,
                  min: '2026-11-01', max: '2026-12-31',
                })}
                <p className="song-character-count" id="song-message-count">
                  {buildSponsorshipMessage(fields).length} / 500 characters sent to Brevo
                </p>
              </> : <>
                <p className="song-guidance" id="song-message-help">{isSong
                  ? 'Include the artist name, song title, a listening link (such as YouTube, SoundCloud or Spotify), a short bio or description, and a link to any promotion of Santa Radio. Keep the whole message within 500 characters and check both links work.'
                  : 'Tell us about your enquiry. Keep your message within 500 characters and share only necessary details.'}</p>
                {field('SONG_REQUEST', 'Message', { textarea: true, limit: 500, help: 'song-message-help song-message-count' })}
                <p className="song-character-count" id="song-message-count">{fields.SONG_REQUEST.length} / 500 characters</p>
              </>}
              {isSong && <div className="song-criteria-field">
                <label className="song-criteria-label" htmlFor="song-criteriaMet">
                  <input id="song-criteriaMet" name="criteriaMet" type="checkbox"
                    checked={fields.criteriaMet === true}
                    onChange={event => onChange('criteriaMet', event.target.checked)}
                    required disabled={pending} aria-invalid={Boolean(errors.criteriaMet)}
                    aria-describedby={`song-requirements-checklist${errors.criteriaMet ? ' song-criteriaMet-error' : ''}`} />
                  <span>Have you met the criteria?</span>
                </label>
                {errors.criteriaMet && <p className="song-field-error" id="song-criteriaMet-error">{errors.criteriaMet}</p>}
              </div>}
              <div className="song-honeypot" aria-hidden="true">
                <label htmlFor="song-website">Leave this field empty</label>
                <input id="song-website" name="email_address_check" type="text" tabIndex={-1} autoComplete="off"
                  value={fields.email_address_check} onChange={event => onChange('email_address_check', event.target.value)} />
              </div>
              <input type="hidden" name="locale" value="en" />
              <p className="song-privacy">{isSong
                ? 'Your name, email and message are sent to Brevo to handle your song submission.'
                : isSponsorship
                  ? 'Your contact name, email, brand, website, preferred launch date and campaign description are sent to Brevo as your enquiry.'
                  : 'Your name, email and message are sent to Brevo to handle your enquiry.'} This does not give consent for marketing. Read our <Link to="/privacy-policy">privacy policy</Link>.</p>
              {error && <p className="song-form-alert" role="alert">{error}</p>}
              <button className="song-submit-button" type="submit" disabled={pending}>{pending
                ? (isSong ? 'Submitting your song…' : isSponsorship ? 'Sending your sponsorship enquiry…' : 'Sending your enquiry…')
                : (isSong ? 'Submit song' : isSponsorship ? 'Send sponsorship enquiry' : 'Send enquiry')}</button>
              {pending && <p className="song-pending" role="status">Waiting for Brevo to confirm acceptance. Please don’t submit again.</p>}
            </form>}
          </div>
        </div>
      </div>
    </main>
  );
}
