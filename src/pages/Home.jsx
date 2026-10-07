import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { RadioButton } from '../components/AudioPlayer.jsx';
import SantaNote from '../components/SantaNote.jsx';
import SantaTrackerBanner from '../tracker/components/SantaTrackerBanner.tsx';
import Countdown from '../components/Countdown.jsx';
import Soundboard from '../components/Soundboard.jsx';
import SantaMessageForm from '../components/SantaMessageForm.jsx';
import YouTubeSection from '../components/YouTubeSection.jsx';
import MugshotsPreview from '../components/MugshotsPreview.jsx';
import ContactSection from '../components/ContactSection.jsx';
import SantaVideoSection from '../components/SantaVideoSection.jsx';
import './Home.css';

export default function Home() {
  return (
    <main id="main-content" className="home-page">
      <Helmet>
        <title>Santa Radio {'\u2013'} The World{'\u2019'}s Best Christmas Radio Station</title>
        <meta name="description" content="Stream the best Christmas songs 24/7 on Santa Radio, hosted by the UK\u2019s Voice of Santa. Tune in all year for festive hits, apps and personalised Santa fun!" />
      </Helmet>
      <section className="hero">
        <picture className="hero-picture">
          <source media="(max-width: 600px)" srcSet="/images/north-pole-hero-mobile.webp" />
          <img src="/images/north-pole-hero.webp" alt="A snowy North Pole village with warmly lit windows beneath the northern lights" fetchpriority="high" />
        </picture>
        <div className="hero-aurora" aria-hidden="true" />
        <div className="hero-content">
          <p className="eyebrow">A little magic from the North Pole</p>
          <h1 className="hero-title">Live from The North Pole,<span>Santa Radio</span></h1>
          <p className="hero-description">Listen live to Santa Radio, discover festive favourites and share a little Christmas magic with the whole family.</p>
          <div className="hero-actions"><Link to="/free-santa-message" className="btn-gold">FREE Santa Message <span aria-hidden="true">↗</span></Link><RadioButton className="btn-red" /></div>
          <p className="hero-note">The World’s Best Christmas Radio Station · All year round</p>
          <div id="christmas-countdown" className="hero-countdown">
            <Countdown />
          </div>
        </div>
      <div className="hero-santa-note"><SantaNote variant="inline" /></div>
      </section>
      <SantaTrackerBanner />
      <SantaMessageForm />
      <SantaVideoSection />
      <Soundboard />
      <YouTubeSection />
      <MugshotsPreview />
      <ContactSection />
    </main>
  );
}
