import { Link } from 'react-router-dom';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-attribution">
        Brought to life by the Voice of Santa, British Voiceover Artist <a href="https://www.voiceoverguy.co.uk" target="_blank" rel="noopener noreferrer">Guy Harris</a>
      </div>
      <div className="footer-links">
        <Link to="/">News</Link>
        <span>&middot;</span>
        <Link to="/christmas-music">Playlist</Link>
        <span>&middot;</span>
        <a href="https://www.santaguy.co.uk" target="_blank" rel="noopener noreferrer">SantaGuy.co.uk</a>
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
        <a href="https://www.instagram.com/santaradiouk/" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
          </svg>
        </a>
        <a href="https://www.facebook.com/santaradiouk" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        </a>
      </div>
      <p className="footer-copy">&copy; 2026 Santa Radio. All Rights Reserved.</p>
    </footer>
  );
}
