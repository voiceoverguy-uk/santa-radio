import PageSeo from '../seo/PageSeo.jsx';
import { homeMetadata } from '../seo/catalogue.js';
import { scrollToSantaMessageDesk } from '../lib/scrollToSantaMessageDesk.js';
import { useTrackEvent } from '../privacy/useTrackEvent.js';
import { RadioButton } from '../components/AudioPlayer.jsx';
import NowPlayingArtwork from '../components/NowPlayingArtwork.jsx';
import SantaTrackerBanner from '../tracker/components/SantaTrackerBanner.tsx';
import Countdown from '../components/Countdown.jsx';
import Soundboard from '../components/Soundboard.jsx';
import santaDashArtwork from '../assets/home/santa-dash-back-to-the-grotto.webp';
import santaDashWobblyBobArtwork from '../assets/home/santa-dash-wobbly-bob.webp';
import SantaMessageForm from '../components/SantaMessageForm.jsx';
import YouTubeSection from '../components/YouTubeSection.jsx';
import MugshotsPreview from '../components/MugshotsPreview.jsx';
import ContactSection from '../components/ContactSection.jsx';
import SantaFlyby from '../components/SantaFlyby.jsx';
import './Home.css';

export default function Home() {
  const trackEvent = useTrackEvent();
  const trackPartnership = event => {
    if (event.defaultPrevented ||
        (event.type === 'click' ? event.button !== 0 : event.button !== 1)) return;
    trackEvent('partnership_enquiry_opened', { location: 'homepage_partnership', destination: '/submit-a-song?mode=sponsorship' });
  };

  return (
    <main id="main-content" className="home-page">
      <PageSeo metadata={homeMetadata()} />
      <section className="hero">
        <picture className="hero-picture">
          <source media="(max-width: 600px)" srcSet="/images/north-pole-hero-mobile.webp" />
          <img src="/images/north-pole-hero.webp" alt="A snowy North Pole village with warmly lit windows beneath the northern lights" fetchpriority="high" />
        </picture>
        <div className="hero-aurora" aria-hidden="true" />
        <SantaFlyby />
        <div className="hero-layout">
          <div className="hero-content">
            <p className="eyebrow">A little magic from the North Pole</p>
            <h1 className="hero-title">Live from The North Pole,<span>Santa Radio</span></h1>
            <p className="hero-description">Enjoy online Christmas music 24/7 on Santa Radio, your Christmas radio station all year round. Listen live to festive classics and family favourites.</p>
            <div className="hero-actions">
              <a href="#santa-messages" className="btn-gold" onClick={event => {
                if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                scrollToSantaMessageDesk();
              }}>FREE Santa Message <span aria-hidden="true">↓</span></a>
              <RadioButton className="btn-red" />
            </div>
            <a className="app-store-badge" href="https://apps.apple.com/gb/app/santa-radio/id1021183593" target="_blank" rel="noopener noreferrer" aria-label="Download Santa Radio on the App Store (opens in a new tab)">
              <img src="/images/download-on-the-app-store.svg" width="149.58" height="50" alt="" />
            </a>
            <p className="hero-note">The World’s Best Christmas Radio Station · All year round</p>
            <div id="christmas-countdown" className="hero-countdown">
              <Countdown />
            </div>
          </div>
          <NowPlayingArtwork />
        </div>
      </section>
      <section className="partnership-strip" aria-labelledby="partnership-heading">
        <div className="partnership-strip__inner">
          <div className="partnership-strip__copy">
            <p className="partnership-strip__eyebrow">CHRISTMAS PARTNERSHIP 2026</p>
            <h2 id="partnership-heading" className="partnership-strip__heading">Your brand. Part of their Christmas.</h2>
            <p className="partnership-strip__body">Put your Christmas brand alongside Santa Radio, with two recorded sponsor mentions every hour, 24/7; a banner on every website page and your branding when our apps open—through 31 December.</p>
            <p className="partnership-strip__supporting">65,000 website active users in 2025 · Approx. 247,000 cumulative Apple app units across our streaming apps</p>
          </div>
          <a className="partnership-strip__button" href="/submit-a-song?mode=sponsorship"
            onClick={trackPartnership} onAuxClick={trackPartnership}>
            <span>Explore Christmas sponsorship →</span>
          </a>
        </div>
      </section>
      <SantaMessageForm />
      <SantaTrackerBanner />
      {/* Personalised video promotion temporarily removed; SantaVideoSection and its styles are retained for restoration. */}
      <section className="santa-dash-promo" aria-labelledby="santa-dash-promo-title">
        <div className="santa-dash-promo__inner">
          <p className="santa-dash-promo__eyebrow">A festive rooftop adventure</p>
          <h2 id="santa-dash-promo-title" className="santa-dash-promo__title">Santa Dash — Back to the Grotto</h2>
          <a
            className="santa-dash-promo__artwork-link"
            href="https://itunes.apple.com/gb/app/santa-dash-from-santa-guy/id1057048397"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View Santa Dash — Back to the Grotto on the App Store (opens in a new tab)"
          >
            <span className="santa-dash-promo__artwork-stage">
              <img
                className="santa-dash-promo__artwork santa-dash-promo__artwork--first"
                src={santaDashArtwork}
                width="1600"
                height="554"
                alt="Santa Dash — Back to the Grotto: Santa leaps across snowy rooftops to collect mince pies. Play on iPhone and iPad."
                loading="lazy"
              />
              <img
                className="santa-dash-promo__artwork santa-dash-promo__artwork--second"
                src={santaDashWobblyBobArtwork}
                width="1600"
                height="555"
                alt=""
                aria-hidden="true"
                loading="lazy"
              />
            </span>
          </a>
          <a
            className="santa-dash-promo__download"
            href="https://itunes.apple.com/gb/app/santa-dash-from-santa-guy/id1057048397"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Download Santa Dash for iPhone and iPad (opens in a new tab)"
          >
            Download Santa Dash for iPhone and iPad <span aria-hidden="true">→</span>
          </a>
        </div>
      </section>
      <Soundboard />
      <YouTubeSection />
      <MugshotsPreview />
      <ContactSection />
    </main>
  );
}
