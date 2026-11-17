import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import './Links.css';
import { useCookieConsent } from '../privacy/CookieConsentProvider.jsx';
import ExternalMediaConsent from '../components/ExternalMediaConsent.jsx';

const partners = [
  { name: 'Live Online Radio', url: 'https://liveonlineradio.net/santa-radio', image: '/images/links/live-online-radio.png', description: 'Hear Santa Radio on Live Online Radio. Open our station page and press play.' },
  { name: 'Radioguide.fm', url: 'https://www.radioguide.fm/internet-radio-england/santa-radio', image: '/images/links/radioguide-fm.svg', light: true, description: 'Find Santa Radio on Radioguide.fm and enjoy Christmas music wherever you listen.' },
  { name: 'radio.net', url: 'https://uk.radio.net/s/santa', image: '/images/links/radio-net.svg', light: true, description: 'Listen to Santa Radio through our radio.net station page.' },
  { name: 'Internet Radio', url: 'https://www.internet-radio.com', image: '/images/links/internet-radio.png', light: true, description: 'Explore the Internet Radio directory and search for Santa Radio.' },
  { name: 'Santa Guy', url: 'https://www.santaguy.co.uk', image: '/images/links/santa-guy.png', description: 'Meet the voice behind Santa Radio — Guy Harris, the voice of Santa.' },
  { name: 'Stag Communications', url: 'https://www.stagcommunications.co.uk/', image: '/images/links/stag-communications.png', description: 'Behind the sound: creative production and radio imaging from Stag Communications.' },
  { name: 'VoiceoverGuy', url: 'https://www.voiceoverguy.co.uk', image: '/images/links/voiceoverguy.jpg', description: 'British male voiceover artist Guy Harris — the voice behind Santa Radio.' },
];

export default function Links() {
  const [tuneInLoaded, setTuneInLoaded] = useState(false);
  const { mediaAllowed } = useCookieConsent();

  return (
    <main className="links-page">
      <Helmet>
        <title>Where to Hear Santa Radio</title>
        <meta name="description" content="Find Santa Radio on your favourite listening platforms, including TuneIn, Live Online Radio, Radioguide.fm and radio.net. Christmas music all year round." />
      </Helmet>
      <header className="links-hero">
        <div className="links-hero-content">
          <p className="links-eyebrow">Christmas music, wherever you listen</p>
          <h1 className="links-title">Where to Hear Santa Radio</h1>
          <p className="links-intro">
            Take the sound of Christmas with you. Choose a listening platform below or use Listen Live
            {' '}right here on our website. You can also meet the people behind Santa Radio’s sound.
          </p>
        </div>
      </header>
      <div className="links-container">
        <section className="links-partners" aria-label="Listening platforms and the people behind our sound">
          {partners.map((partner) => (
            <article className="partner-card" key={partner.name}>
              <a className={`partner-banner${partner.light ? ' partner-banner--light' : ''}`} href={partner.url} target="_blank" rel="noopener noreferrer" aria-label={`${partner.name} website (opens in a new tab)`}>
                {partner.image ? <img src={partner.image} alt={`${partner.name} banner`} loading="lazy" decoding="async" /> : <span className="platform-wordmark">{partner.label}</span>}
              </a>
              <h2 className="partner-heading">{partner.name}</h2>
              {partner.description && <p className="partner-description">{partner.description}</p>}
              <a className="partner-visit" href={partner.url} target="_blank" rel="noopener noreferrer">
                Visit {partner.name} <span className="external-note">(opens in a new tab)</span>
              </a>
            </article>
          ))}
        <section className="partner-card links-tunein" aria-labelledby="links-tunein-title">
          <a className="partner-banner" href="https://tunein.com/radio/Santa-Radio-s252505/" target="_blank" rel="noopener noreferrer" aria-label="TuneIn website (opens in a new tab)"><img className="platform-tunein-logo" src="/images/links/tunein.webp" alt="TuneIn" loading="lazy" decoding="async" /></a>
          <h2 className="links-section-title" id="links-tunein-title">Santa Radio on TuneIn</h2>
          <p>Listen through TuneIn, here or on their website.</p>
            <a className="tunein-link" href="https://tunein.com/radio/Santa-Radio-s252505/" target="_blank" rel="noopener noreferrer">
              Open Santa Radio on TuneIn <span className="external-note">(opens in a new tab)</span>
            </a>
          <details className="tunein-inline-player"><summary>Play here with TuneIn</summary>
          <div className="tunein-actions">
            {mediaAllowed && <button
              className="tunein-load"
              type="button"
              aria-expanded={tuneInLoaded}
              onClick={() => setTuneInLoaded((loaded) => !loaded)}
            >
              {tuneInLoaded ? 'Unload TuneIn player' : 'Load TuneIn player'}
            </button>}

          </div>
          <ExternalMediaConsent provider="TuneIn" href="https://tunein.com/radio/Santa-Radio-s252505/" onEnable={() => setTuneInLoaded(true)}>
          {tuneInLoaded && (
            <iframe
              className="tunein-frame"
              src="https://tunein.com/embed/player/s252505/"
              title="Santa Radio TuneIn player"
              allow="autoplay"
            />
          )}
          </ExternalMediaConsent>
          </details>
        </section>
        </section>
        <section className="links-contact" aria-label="Get in touch">
          <p>
            Know another platform where listeners can hear Santa Radio? Please use our{' '}
            <a href="/submit-a-song">contact form</a>.
          </p>
        </section>
      </div>
    </main>
  );
}
