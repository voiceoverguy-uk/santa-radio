import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { RadioButton } from './AudioPlayer.jsx';
import { scrollToSantaMessageDesk } from '../lib/scrollToSantaMessageDesk.js';
import useNavigationHighlight from './useNavigationHighlight.js';
import './Navbar.css';
import { isStudioPath } from '../lib/studioRoute.js';

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hiddenOnScroll, setHiddenOnScroll] = useState(false);
  const navRef = useRef(null);
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
    let lastY = window.scrollY;
    let direction = 0;
    let distance = 0;
    const update = () => {
      const y = Math.max(0, window.scrollY);
      setScrolled(y > 40);
      if (!window.matchMedia('(max-width: 767px), (max-width: 1024px) and (max-height: 500px) and (orientation: landscape)').matches || menuOpen || y <= 40 ||
          navRef.current?.contains(document.activeElement)) {
        direction = 0;
        distance = 0;
        lastY = y;
        setHiddenOnScroll(false);
        return;
      }
      const delta = y - lastY;
      lastY = y;
      if (!delta) return;
      const nextDirection = Math.sign(delta);
      if (nextDirection !== direction) {
        direction = nextDirection;
        distance = 0;
      }
      distance += Math.abs(delta);
      if (direction > 0 && distance >= 12) setHiddenOnScroll(true);
      if (direction < 0 && distance >= 8) setHiddenOnScroll(false);
    };
    const revealOnFocus = event => {
      if (navRef.current?.contains(event.target)) setHiddenOnScroll(false);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    document.addEventListener('focusin', revealOnFocus);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      document.removeEventListener('focusin', revealOnFocus);
    };
  }, [menuOpen]);
  useEffect(() => {
    setMenuOpen(false);
    setHiddenOnScroll(false);
    // Message pages own their initial panel position; a later navbar scroll
    // would undo Studio's before-paint mobile alignment.
    if (!/^\/free-santa-message\/?$/.test(location.pathname) && !isStudioPath(location.pathname)) window.scrollTo(0, 0);
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
    { to: '/naughty-or-nice-list-checker', label: 'Nice List?' },
  ];
  const pathname = location.pathname.replace(/\/+$/, '') || '/';
  const isStudio = isStudioPath(pathname);
  const isActive = to => {
    if (to === '/') return pathname === '/';
    if (to === '/mugshots/all') return /^\/mugshots(?:\/|$)/.test(pathname);
    if (to === '/christmas-music') {
      return /^\/(?:christmas-music|christmas-artist|christmas-karaoke-lyrics)(?:\/|$)/.test(pathname);
    }
    return pathname === to || (to !== '/' && pathname.startsWith(`${to}/`));
  };
  return (
    <nav ref={navRef} className={`navbar ${scrolled || location.pathname !== '/' ? 'solid' : ''} ${hiddenOnScroll && !menuOpen ? 'is-scroll-hidden' : ''}`} aria-label="Main navigation">
      <div className="navbar-inner">
        <Link to="/" className="navbar-logo" aria-label="Santa Radio home"><img className="navbar-logo-image" src="/images/santa-radio-gold-nav.webp" alt="Santa Radio" width="630" height="188" /></Link>
        {!isStudio && <RadioButton className="nav-radio-icon" iconOnly />}
        <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-controls="main-menu" aria-label={menuOpen ? 'Close menu' : 'Open menu'}><span /><span /><span /></button>
        <ul id="main-menu" ref={highlight.menuRef} style={highlight.style} {...highlight.handlers}
          data-interacting={highlight.target ? 'true' : undefined} className={`navbar-links ${menuOpen ? 'open' : ''}`}>
          {links.map(link => <li key={link.radio ? 'radio' : link.to} data-nav-key={link.radio ? 'radio' : link.to}
            data-highlighted={highlight.target === (link.radio ? 'radio' : link.to) ? 'true' : undefined}
            className={link.radio ? 'nav-listen' : undefined}>{link.radio
            ? <RadioButton className="nav-radio" />
            : link.external
            ? <a href={link.to} target="_blank" rel="noopener noreferrer" title={`${link.label} (opens in a new tab)`} onClick={() => setMenuOpen(false)}>{link.label}</a>
            : <Link to={link.to} aria-current={isActive(link.to) ? (link.to.includes('#') ? 'location' : 'page') : undefined} className={isActive(link.to) ? 'active' : ''} onClick={() => setMenuOpen(false)}>{link.label}</Link>
          }</li>)}
          <li data-nav-key="/free-santa-message" data-highlighted={highlight.target === '/free-santa-message' ? 'true' : undefined}><Link to="/free-santa-message" className="btn-red nav-message" aria-current={isActive('/free-santa-message') ? 'page' : undefined} onClick={openMessageDesk}>FREE Santa Message</Link></li>
        </ul>
      </div>
    </nav>
  );
}
