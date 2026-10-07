import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { RadioButton } from '../components/AudioPlayer.jsx';
import { useRadio } from '../components/RadioProvider.jsx';
import RadioTracks from '../components/RadioTracks.jsx';
import Countdown from '../components/Countdown.jsx';
import Soundboard from '../components/Soundboard.jsx';
import SantaMessageForm from '../components/SantaMessageForm.jsx';
import YouTubeSection from '../components/YouTubeSection.jsx';
import MugshotsPreview from '../components/MugshotsPreview.jsx';
import ContactSection from '../components/ContactSection.jsx';
import SantaVideoSection from '../components/SantaVideoSection.jsx';
import './Home.css';

export default function Home() {
  const { metadata } = useRadio();
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
          <p className="hero-sub">The lights are glowing. The music is playing.<br className="desktop-break" /> Come in and make yourself at home.</p>
          <p className="hero-description">Listen live to Santa Radio, discover festive favourites and share a little Christmas magic with the whole family.</p>
          <div className="hero-actions"><Link to="/free-santa-message" className="btn-gold">Discover Santa Messages <span aria-hidden="true">↗</span></Link><RadioButton className="btn-red" /></div>
          <p className="hero-note">The World’s Best Christmas Radio Station · All year round</p>
        </div>
        <a href="#christmas-countdown" className="hero-scroll"><span aria-hidden="true" />Step inside the magic</a>
      </section>
      <section className="radio-listening-section" aria-label="Live radio songs">
        <div className="container radio-listening-layout">
          <div className="radio-listening-current"><RadioTracks metadata={metadata} /></div>
          <div className="radio-listening-upcoming"><RadioTracks metadata={metadata} kind="upcoming" /></div>
        </div>
      </section>
      <section id="christmas-countdown" className="countdown-section">
        <div className="container countdown-layout"><div><p className="eyebrow">The most wonderful day</p><h2>Christmas is on its way</h2><p>A little closer to the magic, every day.</p></div><Countdown /></div>
      </section>
      <section className="welcome-section">
        <div className="container welcome-layout"><div><p className="eyebrow">Make a little room for Christmas</p><h2>One station.<br /><span>A world of festive joy.</span></h2></div><div><p>From the songs you know by heart to a message from Santa, this is a place for family traditions, familiar voices and the feeling of Christmas.</p><p>Hosted by the UK’s Voice of Santa, Guy Harris. Tune in for Christmas music, whenever the mood takes you.</p><div className="welcome-links"><Link to="/christmas-music">Explore the music <span aria-hidden="true">→</span></Link><Link to="/apps">Take us with you <span aria-hidden="true">→</span></Link></div></div></div>
      </section>
      <SantaMessageForm />
      <SantaVideoSection />
      <Soundboard />
      <YouTubeSection />
      <MugshotsPreview />
      <ContactSection />
    </main>
  );
}
