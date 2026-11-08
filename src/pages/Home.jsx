import PageSeo from '../seo/PageSeo.jsx';
import { homeMetadata } from '../seo/catalogue.js';
import { useTrackEvent } from '../privacy/useTrackEvent.js';
import { useNavigate } from 'react-router-dom';
import HomeHero from '../components/HomeHero.jsx';
import { offerFreeSantaMessageName } from '../lib/freeSantaMessageHandoff.js';
import SantaTrackerBanner from '../tracker/components/SantaTrackerBanner.tsx';
import Soundboard from '../components/Soundboard.jsx';
import NaughtyNiceWidget from '../naughty-or-nice/NaughtyNiceWidget.jsx';
import ChristmasPairs from '../components/ChristmasPairs.jsx';
import SantaDashPromo from '../components/SantaDashPromo.jsx';
import HomepageSantaStudio from '../components/HomepageSantaStudio.jsx';
import YouTubeSection from '../components/YouTubeSection.jsx';
import MugshotsPreview from '../components/MugshotsPreview.jsx';
import ContactSection from '../components/ContactSection.jsx';
import './Home.css';

export default function Home() {
  const navigate = useNavigate();
  const continueWithName = name => {
    offerFreeSantaMessageName(name);
    navigate('/free-santa-message');
  };
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
      <HomepageSantaStudio />
      <SantaTrackerBanner />
      {/* Personalised video promotion temporarily removed; SantaVideoSection and its styles are retained for restoration. */}
      <SantaDashPromo />
      <NaughtyNiceWidget />
      <ChristmasPairs />
      <Soundboard />
      <MugshotsPreview />
      <YouTubeSection />
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
      <ContactSection />
    </main>
  );
}
