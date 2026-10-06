import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { RadioButton } from './AudioPlayer.jsx';
import { useRadio } from './RadioProvider.jsx';
import './Navbar.css';

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const { effects, setEffects } = useRadio();
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 40);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  useEffect(() => { setMenuOpen(false); window.scrollTo(0, 0); }, [location.pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const close = event => { if (event.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [menuOpen]);
  const links = [
    { to: '/', label: 'Home' }, { to: '/apps', label: 'Apps' },
    { to: '/free-santa-message', label: 'Santa Messages' }, { to: '/christmas-music', label: 'Music' },
    { to: '/mugshots/all', label: 'Mug Shots' }, { to: '/santa-stories', label: 'Santa Stories' },
  ];
  return (
    <nav className={`navbar ${scrolled || location.pathname !== '/' ? 'solid' : ''}`} aria-label="Main navigation">
      <div className="navbar-inner">
        <Link to="/" className="navbar-logo" aria-label="Santa Radio home"><img className="navbar-logo-image" src="/images/santa-radio-logo.png" alt="Santa Radio" width="660" height="157" /></Link>
        <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-controls="main-menu" aria-label={menuOpen ? 'Close menu' : 'Open menu'}><span /><span /><span /></button>
        <ul id="main-menu" className={`navbar-links ${menuOpen ? 'open' : ''}`}>
          {links.map(link => <li key={link.to}><Link to={link.to} aria-current={location.pathname === link.to ? 'page' : undefined} className={location.pathname === link.to ? 'active' : ''} onClick={() => setMenuOpen(false)}>{link.label}</Link></li>)}
          <li><a href="https://www.santaradio.co.uk/personalised-santa-video.php" target="_blank" rel="noopener noreferrer">Santa Video</a></li>
          <li><button className="effects-toggle" aria-pressed={effects} onClick={() => setEffects(!effects)}>Effects {effects ? 'On' : 'Off'}</button></li>
          <li className="nav-listen"><RadioButton className="btn-red" /></li>
        </ul>
      </div>
    </nav>
  );
}
