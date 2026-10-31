import PageSeo from '../seo/PageSeo.jsx';
import { homeMetadata } from '../seo/catalogue.js';
import { useTrackEvent } from '../privacy/useTrackEvent.js';
import HomeHero, { useHeroNameSelection } from '../components/HomeHero.jsx';
import SantaTrackerBanner from '../tracker/components/SantaTrackerBanner.tsx';
import Soundboard from '../components/Soundboard.jsx';
import ChristmasPairs from '../components/ChristmasPairs.jsx';
import santaDashArtwork from '../assets/home/santa-dash-back-to-the-grotto.webp';
import santaDashWobblyBobArtwork from '../assets/home/santa-dash-wobbly-bob.webp';
import SantaMessageForm from '../components/SantaMessageForm.jsx';
import YouTubeSection from '../components/YouTubeSection.jsx';
import MugshotsPreview from '../components/MugshotsPreview.jsx';
import ContactSection from '../components/ContactSection.jsx';
import './Home.css';

export default function Home() {
  const { pendingName, continueWithName } = useHeroNameSelection();
  const trackEvent = useTrackEvent();
  const trackPartnership = event => {
    if (event.defaultPrevented ||
        (event.type === 'click' ? event.button !== 0 : event.button !== 1)) return;
    trackEvent('partnership_enquiry_opened', { location: 'homepage_partnership', destination: '/submit-a-song?mode=sponsorship' });
  };

  return (
    <main id="main-content" className="home-page hero-name-preview">
      <PageSeo metadata={homeMetadata()} />
      <HomeHero onContinue={continueWithName} />
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
      <SantaMessageForm keepSignupInPlace pendingName={pendingName} />
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
      <ChristmasPairs />
      <YouTubeSection />
      <MugshotsPreview />
      <ContactSection />
    </main>
  );
}
