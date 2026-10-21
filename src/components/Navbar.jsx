import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { RadioButton } from './AudioPlayer.jsx';
import { scrollToSantaMessageDesk } from '../lib/scrollToSantaMessageDesk.js';
import useNavigationHighlight from './useNavigationHighlight.js';
import './Navbar.css';

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const highlight = useNavigationHighlight(location.key);
  const openMessageDesk = event => {
    setMenuOpen(false);
    // Repeat visits to the current route don't remount its entry effect.
    // Only an ordinary click should reposition this tab, not "open in new tab".
    if (/^\/free-santa-message\/?$/.test(location.pathname) &&
        !event.defaultPrevented && event.button === 0 &&
        !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      scrollToSantaMessageDesk();
    }
  };
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 40);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  useEffect(() => {
    setMenuOpen(false);
    // The standalone message page owns its initial section position.
    if (!/^\/free-santa-message\/?$/.test(location.pathname)) window.scrollTo(0, 0);
  }, [location.pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const close = event => { if (event.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [menuOpen]);
  const links = [
    { to: '/', label: 'Home' }, { to: '/apps', label: 'Apps' },
    { radio: true }, { to: '/christmas-music', label: 'Music' },
    { to: '/mugshots/all', label: 'Celebrity Mugshots' },
    { to: '/santa-tracker', label: 'Santa Tracker' },
  ];
  const pathname = location.pathname.replace(/\/+$/, '') || '/';
  const isActive = to => {
    if (to === '/mugshots/all') return /^\/mugshots(?:\/|$)/.test(pathname);
    if (to === '/christmas-music') {
      return /^\/(?:christmas-music|christmas-artist|christmas-karaoke-lyrics)(?:\/|$)/.test(pathname);
    }
    return pathname === to || (to !== '/' && pathname.startsWith(`${to}/`));
  };
  return (
    <nav className={`navbar ${scrolled || location.pathname !== '/' ? 'solid' : ''}`} aria-label="Main navigation">
      <div className="navbar-inner">
        <Link to="/" className="navbar-logo" aria-label="Santa Radio home"><img className="navbar-logo-image" src="/images/santa-radio-gold-nav.webp" alt="Santa Radio" width="630" height="188" /></Link>
        <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-controls="main-menu" aria-label={menuOpen ? 'Close menu' : 'Open menu'}><span /><span /><span /></button>
        <ul id="main-menu" ref={highlight.menuRef} style={highlight.style} {...highlight.handlers}
          data-interacting={highlight.target ? 'true' : undefined} className={`navbar-links ${menuOpen ? 'open' : ''}`}>
          {links.map(link => <li key={link.radio ? 'radio' : link.to} data-nav-key={link.radio ? 'radio' : link.to}
            data-highlighted={highlight.target === (link.radio ? 'radio' : link.to) ? 'true' : undefined}
            className={link.radio ? 'nav-listen' : undefined}>{link.radio
            ? <RadioButton className="nav-radio" />
            : link.external
            ? <a href={link.to} target="_blank" rel="noopener noreferrer" title={`${link.label} (opens in a new tab)`} onClick={() => setMenuOpen(false)}>{link.label}</a>
            : <Link to={link.to} aria-current={isActive(link.to) ? 'page' : undefined} className={isActive(link.to) ? 'active' : ''} onClick={() => setMenuOpen(false)}>{link.label}</Link>
          }</li>)}
          <li data-nav-key="/free-santa-message" data-highlighted={highlight.target === '/free-santa-message' ? 'true' : undefined}><Link to="/free-santa-message" className="btn-red nav-message" aria-current={isActive('/free-santa-message') ? 'page' : undefined} onClick={openMessageDesk}>FREE Santa Message</Link></li>
        </ul>
      </div>
    </nav>
  );
}
