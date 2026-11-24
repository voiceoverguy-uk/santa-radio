import HomeContenders from '../components/HomeContenders.jsx';
import { useEffect, useState } from 'react';
import { Sparkles, Download, Headphones } from 'lucide-react';
import PageSeo from '../seo/PageSeo.jsx';
import { homeMetadata } from '../seo/catalogue.js';
import { useTrackEvent } from '../privacy/useTrackEvent.js';
import { useLocation, useNavigate } from 'react-router-dom';
import HomeHero from '../components/HomeHero.jsx';
import { offerFreeSantaMessageName } from '../lib/freeSantaMessageHandoff.js';
import SantaTrackerBanner from '../tracker/components/SantaTrackerBanner.tsx';
import NameChart from '../components/NameChart.jsx';
import Soundboard from '../components/Soundboard.jsx';
import NaughtyNiceWidget from '../naughty-or-nice/NaughtyNiceWidget.jsx';
import ChristmasPairs from '../components/ChristmasPairs.jsx';
import ChristmasStudyPromo from "../christmas-game/ChristmasStudyPromo.jsx";
import SantaDashPromo from '../components/SantaDashPromo.jsx';
import HomepageSantaStudio from '../components/HomepageSantaStudio.jsx';
import YouTubeSection from '../components/YouTubeSection.jsx';
import MugshotsPreview from '../components/MugshotsPreview.jsx';
import ContactSection from '../components/ContactSection.jsx';
import './Home.css';

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    if (!location.hash) return;
    const target = document.getElementById(location.hash.slice(1));
    if (!target?.matches('#bespoke-santa-messages, .bespoke-offer')) return;

    let cancelled = false;
    let frame;
    document.fonts.ready.then(() => {
      if (!cancelled) frame = requestAnimationFrame(() => target.scrollIntoView({ behavior: 'instant', block: 'start' }));
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [location.key, location.hash]);

  const [checkerEntry, setCheckerEntry] = useState({ name: '', id: 0 });
  const checkNaughtyNice = name => {
    // Keep the child's name in memory, never in a URL or browser storage.
    setCheckerEntry(current => ({ name, id: current.id + 1 }));
    navigate({ pathname: '/', hash: '#nice-list' }, { preventScrollReset: true });
  };
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
      <HomeHero onContinue={continueWithName} onCheckNaughtyNice={checkNaughtyNice} />
        <div id="santa-radio-milestones" className="container homepage-lifetime-stats" aria-label="Santa Radio over 11 years" style={{ scrollMarginTop: '110px' }}>
          <p><Sparkles aria-hidden="true" /><strong>11 years</strong><span>of Christmas magic</span></p>
          <p><Download aria-hidden="true" /><strong>500K+</strong><span>app downloads</span></p>
          <p><Headphones aria-hidden="true" /><strong>5M+</strong><span>listeners over 11 years</span></p>
        </div>
      <HomepageSantaStudio />
      <SantaTrackerBanner />
      {/* Personalised video promotion temporarily removed; SantaVideoSection and its styles are retained for restoration. */}
      <SantaDashPromo />
      <ChristmasStudyPromo />
      <NaughtyNiceWidget key={checkerEntry.id} initialName={checkerEntry.name} />
      <ChristmasPairs />
      <HomeContenders />
      <NameChart />
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
