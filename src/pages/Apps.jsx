import PageSeo from '../seo/PageSeo.jsx';
import { appsMetadata } from '../seo/catalogue.js';
import { appleWatchScreenshots, christmasApps, macAppListing } from './apps-data.js';
import appleTvScreenshot from '../assets/apps/santa-radio-apple-tv.webp';
import AppIcon from './AppIcon.jsx';
import AppScreenshots from './AppScreenshots.jsx';
import './Apps.css';

function AppSection({ app }) {
  return (
    <section id={app.id} className="app-section" aria-labelledby={`${app.id}-title`}>
      <div className="apps-container">
        <div className="app-section-heading">
          <h2 id={`${app.id}-title`} className="app-section-title">{app.title}</h2>
          {app.subtitle && <p className="app-section-sub">{app.subtitle}</p>}
        </div>
        <div className={`app-layout${app.landscape ? ' app-layout-landscape' : ''}${app.screenshots ? ' app-layout-with-slideshow' : ''}`}>
          {app.screenshots ? <AppScreenshots slides={app.screenshots} {...app.slideshow} /> : <div className="app-phone-wrap">
                <img
                  src={app.image}
                  alt={app.alt}
                  className="app-phone-img"
                  width={app.width}
                  height={app.height}
                  loading="lazy"
                  decoding="async"
                />
          </div>}
          <div className="app-copy">
            <div className="app-features-grid">
              {app.features.map(({ label, desc }) => (
                <div key={label} className="feature-item">
                  <h3 className="feature-label">{label}</h3>
                  <p className="feature-desc">{desc}</p>
                </div>
              ))}
            </div>
            <div className="app-download-btns">
              {app.downloads.map(({ platform, href }) => (
                <a
                  key={platform}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="app-dl-btn"
                  aria-label={`Download on ${platform === 'iOS' ? 'the App Store' : 'Amazon Appstore'} — ${app.title} (opens in a new tab)`}
                >
                  <AppIcon name="download" />
                  Download on {platform === 'iOS' ? 'the App Store' : 'Amazon Appstore'}
                </a>
              ))}
            </div>
          </div>
        </div>
        <hr className="app-heading-rule" />
      </div>
    </section>
  );
}

function AppleTvShowcase() {
  return (
    <section className="apple-tv-showcase" aria-labelledby="apple-tv-title">
      <div className="apps-container apple-tv-inner">
        <div className="apple-tv-copy">
          <p className="apple-tv-eyebrow">The big-screen experience</p>
          <h2 id="apple-tv-title">Available FREE on Apple TV</h2>
          <p className="apple-tv-description">
            Enjoy Santa Radio on your Apple TV. Listen live, see what’s playing and explore the festive scene on the big screen.
          </p>
          <p className="apple-tv-instruction">Find Santa Radio in the App Store on your Apple TV.</p>
        </div>
        <figure className="apple-tv-figure">
          <img
            src={appleTvScreenshot}
            alt="Santa Radio on Apple TV, showing live Christmas music and festive controls in Santa’s workshop."
            width="1920"
            height="1080"
            loading="lazy"
            decoding="async"
          />
          <figcaption>Santa Radio on the big screen</figcaption>
        </figure>
      </div>
    </section>
  );
}

function AppleWatchShowcase() {
  return (
    <section className="apple-watch-showcase" aria-labelledby="apple-watch-title">
      <div className="apps-container apple-watch-inner">
        <div className="apple-watch-copy">
          <p className="apps-page-eyebrow">A little closer to the music</p>
          <h2 id="apple-watch-title">Now available on Apple Watch</h2>
          <p className="apple-watch-description">
            View the current song, artist and artwork, then start or pause playback on your paired iPhone.
          </p>
          <p className="apple-watch-instruction">
            Music plays on your paired iPhone, not as standalone streaming from Apple Watch.
          </p>
          <p className="apple-watch-note">These promotional images show the Watch experience; they are not live website controls.</p>
        </div>
        <AppScreenshots
          slides={appleWatchScreenshots}
          heading="Santa Radio on Apple Watch"
          regionLabel="Santa Radio Apple Watch promotional images"
          maxWidth={420}
        />
      </div>
    </section>
  );
}

function MacAppShowcase({ app }) {
  return (
    <section id={app.id} className="mac-app-showcase" aria-labelledby={`${app.id}-title`}>
      <div className="apps-container mac-app-inner">
        <div className="mac-app-copy">
          <p className="apps-page-eyebrow">Mac app</p>
          <h2 id={`${app.id}-title`} className="app-section-title">{app.title}</h2>
          <p className="mac-app-description">{app.subtitle}</p>
          <p className="mac-app-status" role="status">{app.status}</p>
        </div>
        <figure className="mac-app-figure">
          <img
            src={app.image}
            alt={app.alt}
            width={app.width}
            height={app.height}
            loading="lazy"
            decoding="async"
          />
          <figcaption>Santa Radio for Mac promotional artwork</figcaption>
        </figure>
      </div>
    </section>
  );
}

export default function Apps() {
  return (
    <main className="apps-page">
      <PageSeo metadata={appsMetadata([...christmasApps, macAppListing])} />
      <div className="apps-hero">
        <div className="apps-hero-content">
          <img className="apps-hero-logo" src="/images/santa-radio-logo.png" alt="Santa Radio" width="827" height="190" />
          <h1 className="apps-hero-title">Christmas Apps</h1>
          <p className="apps-hero-desc">Christmas music, Santa messages and festive games. Check the linked stores for current pricing.</p>
        </div>
      </div>
      {christmasApps.map((app, index) => (
        <div key={app.id}>
          {index > 0 && <div className="apps-divider" aria-hidden="true" />}
          <AppSection app={app} />
          {index === 0 && (
            <>
              <AppleWatchShowcase />
              <AppleTvShowcase />
              <MacAppShowcase app={macAppListing} />
            </>
          )}
        </div>
      ))}
    </main>
  );
}
