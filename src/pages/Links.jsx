import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import './Links.css';

const partners = [
  { name: 'Xmas Radio', url: 'https://xmasradio.mobi', image: '/images/links/xmas-radio.png' },
  {
    name: 'VoiceoverGuy',
    url: 'https://www.voiceoverguy.co.uk',
    image: '/images/links/voiceoverguy.jpg',
    description: 'Brought to life by the voice of Santa himself — Guy Harris, British Male Voiceover Artist.',
  },
  {
    name: 'Stag Communications',
    url: 'https://www.stagcommunications.co.uk/',
    image: '/images/links/stag-communications.jpg',
    description: 'Creative production and radio imaging by our friends at Stag Communications.',
  },
  { name: 'Internet Radio', url: 'https://www.internet-radio.com', image: '/images/links/internet-radio.gif' },
];

export default function Links() {
  const [tuneInLoaded, setTuneInLoaded] = useState(false);

  return (
    <main className="links-page">
      <Helmet>
        <title>Friends of Santa Radio</title>
        <meta name="description" content="Meet the friends of Santa Radio across radio, voiceover and entertainment who help make Christmas brighter all year round." />
      </Helmet>
      <header className="links-hero">
        <div className="links-hero-content">
          <p className="links-eyebrow">From our North Pole address book</p>
          <h1 className="links-title">Friends of Santa Radio</h1>
          <p className="links-intro">
            Santa loves sharing the festive spirit with friends from across radio, voiceover, and entertainment.
            {' '}Here are a few of the people and projects that help make Christmas brighter all year round.
          </p>
        </div>
      </header>
      <div className="links-container">
        <section className="links-partners" aria-label="Our friends and partners">
          {partners.map((partner) => (
            <article className="partner-card" key={partner.name}>
              <a className="partner-banner" href={partner.url} target="_blank" rel="noopener noreferrer" aria-label={`${partner.name} website (opens in a new tab)`}>
                <img src={partner.image} alt={`${partner.name} banner`} loading="lazy" decoding="async" />
              </a>
              <h2 className="partner-heading">{partner.name}</h2>
              {partner.description && <p className="partner-description">{partner.description}</p>}
              <a className="partner-visit" href={partner.url} target="_blank" rel="noopener noreferrer">
                Visit {partner.name} <span className="external-note">(opens in a new tab)</span>
              </a>
            </article>
          ))}
        </section>
        <section className="links-tunein" aria-labelledby="links-tunein-title">
          <h2 className="links-section-title" id="links-tunein-title">Santa Radio on TuneIn</h2>
          <p>Listen through TuneIn, here or on their website.</p>
          <p id="tunein-disclosure">
            Loading the player connects your browser to TuneIn, a third-party service that may use cookies and
            receive information such as your IP address. It will not load until you choose to load it.
          </p>
          <div className="tunein-actions">
            <button
              className="tunein-load"
              type="button"
              aria-describedby="tunein-disclosure"
              aria-expanded={tuneInLoaded}
              onClick={() => setTuneInLoaded((loaded) => !loaded)}
            >
              {tuneInLoaded ? 'Unload TuneIn player' : 'Load TuneIn player'}
            </button>
            <a className="tunein-link" href="https://tunein.com/radio/Santa-Radio-s252505/" target="_blank" rel="noopener noreferrer">
              Open Santa Radio on TuneIn <span className="external-note">(opens in a new tab)</span>
            </a>
          </div>
          {tuneInLoaded && (
            <iframe
              className="tunein-frame"
              src="https://tunein.com/embed/player/s252505/"
              title="Santa Radio TuneIn player"
              allow="autoplay"
            />
          )}
        </section>
        <section className="links-contact" aria-label="Get in touch">
          <p>
            If you would like to be added to this page, please get in touch at{' '}
            <a href="mailto:santa@santaradio.co.uk">santa@santaradio.co.uk</a>.
          </p>
        </section>
      </div>
    </main>
  );
}
