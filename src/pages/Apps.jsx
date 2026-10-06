import { Helmet } from 'react-helmet-async';
import { christmasApps } from './apps-data.js';
import './Apps.css';

function AppSection({ app }) {
  return (
    <section id={app.id} className="app-section" aria-labelledby={`${app.id}-title`}>
      <div className="apps-container">
        <div className="app-section-heading">
          <h2 id={`${app.id}-title`} className="app-section-title">{app.title}</h2>
          {app.subtitle && <p className="app-section-sub">{app.subtitle}</p>}
          <div className="app-download-btns">
            {app.downloads.map(({ platform, href }) => (
              <a
                key={platform}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="app-dl-btn"
                aria-label={`Download ${app.title} on ${platform} (opens in a new tab)`}
              >
                Download on {platform}
              </a>
            ))}
          </div>
          <hr className="app-heading-rule" />
        </div>
        <div className={`app-layout${app.landscape ? ' app-layout-landscape' : ''}`}>
          <div className="app-phone-wrap">
            <div className="app-device">
              <div className="app-device-screen">
                <img
                  src={app.image}
                  alt={app.alt}
                  className="app-phone-img"
                  width={app.width}
                  height={app.height}
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>
          </div>
          <div className="app-features-grid">
            {app.features.map(({ label, desc, icon }) => (
              <div key={label} className="feature-item">
                <span className="feature-icon" aria-hidden="true">{icon}</span>
                <h3 className="feature-label">{label}</h3>
                <p className="feature-desc">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Apps() {
  return (
    <main className="apps-page">
      <Helmet>
        <title>Free Christmas Apps – Santa Radio</title>
        <meta name="description" content="Download our amazing free Christmas apps featuring Santa / Father Christmas. Available on iOS and Amazon." />
      </Helmet>
      <div className="apps-hero">
        <div className="apps-hero-content">
          <img className="apps-hero-logo" src="/images/santa-radio-logo.png" alt="Santa Radio" width="827" height="190" />
          <h1 className="apps-hero-title">Free Christmas Apps</h1>
          <p className="apps-hero-desc">Download our amazing apps featuring Santa / Father Christmas.</p>
        </div>
      </div>
      {christmasApps.map((app, index) => (
        <div key={app.id}>
          {index > 0 && <div className="apps-divider" aria-hidden="true" />}
          <AppSection app={app} />
        </div>
      ))}
    </main>
  );
}
