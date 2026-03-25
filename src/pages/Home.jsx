import { Helmet } from 'react-helmet-async';
import AudioPlayer from '../components/AudioPlayer.jsx';
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
    <main>
      <Helmet>
        <title>Santa Radio {'\u2013'} The World{'\u2019'}s Best Christmas Radio Station</title>
        <meta name="description" content="Stream the best Christmas songs 24/7 on Santa Radio, hosted by the UK\u2019s Voice of Santa. Tune in all year for festive hits, apps and personalised Santa fun!" />
      </Helmet>
      {/* Hero */}
      <section className="hero starry-bg">
        <div className="hero-content">
          <img
            src="https://www.santaradio.co.uk/assets/img/santa-radio-logo.png"
            alt="Santa Radio Logo"
            className="hero-logo"
            onError={e => { e.target.style.display = 'none'; }}
          />
          <h1 className="hero-title gold-text">Santa Radio</h1>
          <p className="hero-tagline">The World{'\u2019'}s Best Christmas Radio Station</p>
          <p className="hero-sub">
            Get your fix of festive <strong>Christmas music</strong> all year round!
          </p>
          <Countdown />
          <AudioPlayer />
        </div>
        <div className="snow-trees" />
      </section>

      {/* Santa Message Form */}
      <SantaMessageForm />

      {/* Soundboard */}
      <Soundboard />

      {/* Personalised Santa Video */}
      <SantaVideoSection />

      {/* YouTube */}
      <YouTubeSection />

      {/* Mugshots Preview */}
      <MugshotsPreview />

      {/* Contact */}
      <ContactSection />
    </main>
  );
}
