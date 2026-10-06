import { Helmet } from 'react-helmet-async';
import './Apps.css';

function AppSection({ title, subtitle, imgSrc, features }) {
  return (
    <section className="app-section section-white">
      <div className="container">
        <h2 className="app-section-title">{title}</h2>
        {subtitle && <p className="app-section-sub">{subtitle}</p>}
        <div className="app-download-btns">
          <a href="https://apps.apple.com/gb/app/santa-radio/id1021183593" target="_blank" rel="noopener noreferrer" className="btn-red app-dl-btn">
            Download on iOS
          </a>
          <a href="https://www.amazon.co.uk/gp/product/B013KHIIMM" target="_blank" rel="noopener noreferrer" className="btn-red app-dl-btn">
            Download on Amazon
          </a>
        </div>
        <div className="app-layout">
          <div className="app-phone-wrap">
            <img src={imgSrc} alt={title} className="app-phone-img" />
          </div>
          <div className="app-features-grid">
            {features.map((f, index) => (
              <div key={f.label} className="feature-item">
                <div className="feature-icon" aria-hidden="true">{String(index + 1).padStart(2, '0')}</div>
                <h4 className="feature-label">{f.label}</h4>
                <p className="feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const RADIO_FEATURES = [
  { label: 'Leave a message', desc: 'Your child can leave a FREE voicemail message for Santa.' },
  { label: 'Playback', desc: "Playback your Child's message to hear what they asked Santa." },
  { label: 'Santa Soundboard', desc: 'Head Elf recorded Santa. Play back some fun festive phrases.' },
  { label: 'Send a message', desc: 'Send a message to Santa and read other messages & replies.' },
  { label: '100% FREE', desc: "It's 100% free with none of those annoying adverts." },
  { label: 'Santa Radio', desc: 'You can also listen and enjoy Santa Radio direct from the app.' },
];

const VOICEMAIL_FEATURES = [
  { label: 'Leave a message', desc: 'Your child can leave a FREE voicemail message for Santa.' },
  { label: 'Playback', desc: "Playback your Child's message to hear what they asked Santa." },
  { label: 'Santa Soundboard', desc: 'Head Elf recorded Santa. Play back some fun festive phrases.' },
  { label: 'Send a message', desc: 'Send a message to Santa and read other messages & replies.' },
  { label: '100% FREE', desc: "It's 100% free with none of those annoying adverts." },
  { label: 'Santa Radio', desc: 'You can also listen and enjoy Santa Radio direct from the app.' },
];

const MESSAGES_FEATURES = [
  { label: "Find your child's name", desc: 'Santa will then play a personal message for your child.' },
  { label: 'Share your message', desc: "Share your child's message on social media or by email." },
  { label: '100% FREE', desc: "It's 100% free with none of those annoying adverts." },
  { label: 'Santa Radio', desc: 'You can also listen and enjoy Santa Radio direct from the app.' },
];

const PHONE_PLACEHOLDER = '/images/santa-radio-logo.png';

export default function Apps() {
  return (
    <main>
      <Helmet>
        <title>Free Christmas Apps {'\u2013'} Santa Radio</title>
        <meta name="description" content="Download our amazing free Christmas apps featuring Santa / Father Christmas. Available on iOS and Amazon." />
      </Helmet>
      <div className="apps-hero starry-bg">
        <div className="apps-hero-content">
          <h1 className="hero-title-app"><img className="brand-logo brand-logo-hero" src="/images/santa-radio-logo.png" alt="Santa Radio" width="827" height="190" /></h1>
          <h2 className="apps-hero-sub">Free Christmas Apps</h2>
          <p className="apps-hero-desc">Download our amazing apps featuring Santa / Father Christmas.</p>
        </div>
      </div>

      <AppSection
        title="Santa Radio App"
        imgSrc={PHONE_PLACEHOLDER}
        features={RADIO_FEATURES}
      />

      <div className="apps-divider" />

      <AppSection
        title="Santa Voicemail"
        subtitle="Leave Santa a voicemail message."
        imgSrc={PHONE_PLACEHOLDER}
        features={VOICEMAIL_FEATURES}
      />

      <div className="apps-divider" />

      <AppSection
        title="Santa Messages"
        subtitle="Santa has a personal message just for your child."
        imgSrc={PHONE_PLACEHOLDER}
        features={MESSAGES_FEATURES}
      />
    </main>
  );
}
