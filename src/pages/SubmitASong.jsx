import { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import {
  emptySongFields, songCountries, SONG_REQUEST_TIMEOUT_MS,
  SongSubmissionError, submitSong, validateSongFields,
} from '../lib/songSubmission.js';
import './SubmitASong.css';

export default function SubmitASong() {
  const [fields, setFields] = useState(emptySongFields);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const formRef = useRef(null);
  const successRef = useRef(null);
  const requestRef = useRef(null);

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
    const validation = validateSongFields(fields);
    setErrors(validation);
    setError('');
    if (Object.keys(validation).length) {
      setError('Please check the highlighted details.');
      focusInvalid(validation);
      return;
    }
    if (fields.email_address_check) {
      setError('Your submission could not be sent. Please try again.');
      return;
    }
    const request = { controller: new AbortController(), timedOut: false, timeout: null };
    requestRef.current = request;
    request.timeout = setTimeout(() => {
      request.timedOut = true;
      request.controller.abort();
    }, SONG_REQUEST_TIMEOUT_MS);
    setPending(true);
    try {
      await submitSong(fields, request.controller.signal);
      if (requestRef.current !== request) return;
      request.controller.signal.throwIfAborted();
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
          : 'We couldn’t confirm your submission with Brevo. Check your connection and try again; your entries are still here.');
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
      maxLength: options.limit, 'aria-invalid': Boolean(errors[name]), 'aria-describedby': describedBy,
    };
    return <div className="song-field">
      <label htmlFor={id}>{label}{!options.optional && <span aria-hidden="true"> *</span>}</label>
      {options.textarea ? <textarea {...props} rows={5} /> : <input {...props} type={options.type || 'text'} />}
      {errors[name] && <p className="song-field-error" id={`${id}-error`}>{errors[name]}</p>}
    </div>;
  };

  return (
    <main className="submit-song-page">
      <Helmet>
        <title>How do I submit a song to Santa Radio?</title>
        <meta name="description" content="Find out how to submit your Christmas song to Santa Radio for airplay consideration." />
      </Helmet>
      <div className="submit-hero starry-bg">
        <div className="submit-hero-content">
          <h1 className="submit-title gold-text">Submit a song to Santa Radio</h1>
          <div className="submit-body" onFocusCapture={keepFocusVisible}>
            <p>Have a Christmas recording you’d like us to consider? Send your details and a listening link below. No audio upload is needed.</p>
            <section className="song-requirements" aria-labelledby="song-requirements-title">
              <h2 id="song-requirements-title">Before you send your song</h2>
              <p>Please include <strong>all four items</strong> in your message before submitting:</p>
              <ul>
                <li>Artist name</li>
                <li>Song title</li>
                <li>A link to the song (YouTube, SoundCloud, Spotify etc.)</li>
                <li>A short bio or description</li>
              </ul>
              <p>Keep the complete message within 500 characters. Please check that your listening link works before sending.</p>
            </section>
            <p>Submissions are considered for airplay, but sending a song does not guarantee a playlist place or an individual reply.</p>
            {accepted ? <div className="song-form-success" role="status" tabIndex={-1} ref={successRef}>
              <h2>Thank you for your song submission</h2>
              <p>Brevo has accepted your submission for Santa Radio to consider. This is not a promise of airplay or a reply.</p>
              <Link to="/christmas-music">Explore Christmas music</Link>
            </div> : <form className="song-submission-form" ref={formRef} onSubmit={onSubmit} noValidate aria-busy={pending}>
              <p className="song-guidance">Fields marked * are required.</p>
              <div className="song-form-grid">
                {field('FIRSTNAME', 'First name', { autocomplete: 'given-name', limit: 200 })}
                {field('LASTNAME', 'Surname', { autocomplete: 'family-name', limit: 200 })}
              </div>
              {field('EMAIL', 'Email address', { autocomplete: 'email', type: 'email' })}
              <p className="song-guidance" id="song-message-help">Include the artist name, song title, a listening link (such as YouTube, SoundCloud or Spotify) and a short bio or description. Keep the whole message within 500 characters.</p>
              {field('COMPANY:name', 'Message', { textarea: true, limit: 500, help: 'song-message-help song-message-count' })}
              <p className="song-character-count" id="song-message-count">{fields['COMPANY:name'].length} / 500 characters</p>
              <p className="song-guidance" id="song-phone-help">Phone number is optional. Choose its country code and enter the local number separately.</p>
              <div className="song-phone-grid">
                <div className="song-field">
                  <label htmlFor="song-country">Country code (for optional phone)</label>
                  <select id="song-country" name="SMS__COUNTRY_CODE" value={fields.SMS__COUNTRY_CODE}
                    onChange={event => onChange('SMS__COUNTRY_CODE', event.target.value)} disabled={pending}
                    autoComplete="tel-country-code" aria-invalid={Boolean(errors.SMS__COUNTRY_CODE)}
                    aria-describedby={errors.SMS__COUNTRY_CODE ? 'song-country-error' : 'song-phone-help'}>
                    {songCountries.map(({ country, code }) => <option key={`${country}-${code}`} value={code}>
                      {country === 'GB' ? 'United Kingdom (GB)' : country} {code}
                    </option>)}
                  </select>
                  {errors.SMS__COUNTRY_CODE && <p id="song-country-error" className="song-field-error">{errors.SMS__COUNTRY_CODE}</p>}
                </div>
                {field('SMS', 'Phone number (optional)', { optional: true, autocomplete: 'tel-national', type: 'tel', help: 'song-phone-help' })}
              </div>
              <div className="song-honeypot" aria-hidden="true">
                <label htmlFor="song-website">Leave this field empty</label>
                <input id="song-website" name="email_address_check" type="text" tabIndex={-1} autoComplete="off"
                  value={fields.email_address_check} onChange={event => onChange('email_address_check', event.target.value)} />
              </div>
              <input type="hidden" name="locale" value="en" />
              <p className="song-privacy">Your name, email, song message and optional phone number are sent to Brevo to handle your song submission. This does not give consent for marketing. Read our <Link to="/privacy-policy">privacy policy</Link>.</p>
              {error && <p className="song-form-alert" role="alert">{error}</p>}
              <button className="song-submit-button" type="submit" disabled={pending}>{pending ? 'Submitting your song…' : 'Submit your song'}</button>
              {pending && <p className="song-pending" role="status">Waiting for Brevo to confirm acceptance. Please don’t submit again.</p>}
            </form>}
            <p className="song-privacy">For general enquiries, rather than song submissions, <a href="mailto:santa@santaradio.co.uk">email Santa Radio</a>.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
