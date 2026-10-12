import PageSeo from '../seo/PageSeo.jsx';
import { homeMetadata } from '../seo/catalogue.js';
import { Link } from 'react-router-dom';
import { RadioButton } from '../components/AudioPlayer.jsx';
import NowPlayingArtwork from '../components/NowPlayingArtwork.jsx';
import SantaTrackerBanner from '../tracker/components/SantaTrackerBanner.tsx';
import Countdown from '../components/Countdown.jsx';
import Soundboard from '../components/Soundboard.jsx';
import SantaMessageForm from '../components/SantaMessageForm.jsx';
import YouTubeSection from '../components/YouTubeSection.jsx';
import MugshotsPreview from '../components/MugshotsPreview.jsx';
import ContactSection from '../components/ContactSection.jsx';
import SantaVideoSection from '../components/SantaVideoSection.jsx';
import SantaFlyby from '../components/SantaFlyby.jsx';
import './Home.css';

export default function Home() {
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
            <div className="hero-actions"><Link to="/free-santa-message" className="btn-gold">FREE Santa Message <span aria-hidden="true">↗</span></Link><RadioButton className="btn-red" /></div>
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
