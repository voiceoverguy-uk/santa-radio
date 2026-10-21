import PageSeo from '../seo/PageSeo.jsx';
import { homeMetadata } from '../seo/catalogue.js';
import { scrollToSantaMessageDesk } from '../lib/scrollToSantaMessageDesk.js';
import { useTrackEvent } from '../privacy/useTrackEvent.js';
import { RadioButton } from '../components/AudioPlayer.jsx';
import NowPlayingArtwork from '../components/NowPlayingArtwork.jsx';
import SantaTrackerBanner from '../tracker/components/SantaTrackerBanner.tsx';
import Countdown from '../components/Countdown.jsx';
import Soundboard from '../components/Soundboard.jsx';
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
    trackEvent('partnership_enquiry_opened', { location: 'homepage_partnership', destination: '/submit-a-song' });
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
            <p className="partnership-strip__eyebrow">A LITTLE CHRISTMAS PARTNERSHIP</p>
            <h2 id="partnership-heading" className="partnership-strip__heading">Your Christmas magic. Our festive soundtrack.</h2>
            <p className="partnership-strip__body">Got a Christmas market, festive event or unique Christmas product? Join Santa Radio with website and app banners, plus an on-air credit every hour.</p>
            <p className="partnership-strip__supporting">Heard across web, apps, CarPlay, Apple TV and the Mac app.</p>
          </div>
          <a className="partnership-strip__button" href="/submit-a-song"
            onClick={trackPartnership} onAuxClick={trackPartnership}>Let’s talk Christmas →</a>
        </div>
      </section>
      <SantaMessageForm />
      <SantaTrackerBanner />
      {/* Personalised video promotion temporarily removed; SantaVideoSection and its styles are retained for restoration. */}
      <Soundboard />
      <YouTubeSection />
      <MugshotsPreview />
      <ContactSection />
    </main>
  );
}
