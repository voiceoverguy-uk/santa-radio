import { Link } from 'react-router-dom';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer">
      <Link to="/" className="footer-wordmark" aria-label="Santa Radio home"><img className="brand-logo brand-logo-footer" src="/images/santa-radio-logo.png" alt="Santa Radio" width="827" height="190" /></Link>
      <div className="footer-attribution">
        Brought to life by the Voice of Santa, British Voiceover Artist Guy Harris
      </div>
      <div className="footer-links">
        <Link to="/">News</Link>
        <span>&middot;</span>
        <Link to="/christmas-music">Playlist</Link>
        <span>&middot;</span>
        <a href="mailto:santa@santaradio.co.uk?subject=Santa%20Radio%20question">Questions? Email us</a>
        <span>&middot;</span>
        <Link to="/submit-a-song">Submit your song</Link>
        <span>&middot;</span>
        <a href="https://festivestudio.co.uk/" target="_blank" rel="noopener noreferrer">Personalised Santa Video Message</a>
        <span>&middot;</span>
        <Link to="/apps">Download the app</Link>
        <span>&middot;</span>
        <Link to="/links">Links</Link>
        <span>&middot;</span>
        <Link to="/privacy-policy">Privacy Policy</Link>
      </div>
      <div className="footer-social">
        <a href="https://twitter.com/WeAreSantaRadio" target="_blank" rel="noopener noreferrer" aria-label="Twitter">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.631L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/>
          </svg>
        </a>
        <a href="https://facebook.com/santaradio" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        </a>
      </div>
      <p className="footer-copy">&copy; 2026 Santa Radio. All Rights Reserved.</p>
    </footer>
  );
}
