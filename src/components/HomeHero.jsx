import { useEffect, useRef, useState } from 'react';
import { scrollToSantaMessageDesk } from '../lib/scrollToSantaMessageDesk.js';
import { RadioButton } from './AudioPlayer.jsx';
import NowPlayingArtwork from './NowPlayingArtwork.jsx';
import Countdown from './Countdown.jsx';
import SantaFlyby from './SantaFlyby.jsx';
import HeroNameChecker from './HeroNameChecker.jsx';
import '../pages/Home.css';
import '../pages/HeroNamePreview.css';

export function useHeroNameSelection() {
  const [pendingName, setPendingName] = useState(null);
  const scrollFrame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(scrollFrame.current), []);

  const continueWithName = name => {
    setPendingName(previous => ({ name, revision: (previous?.revision || 0) + 1 }));
    cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = requestAnimationFrame(() => {
      const section = document.querySelector('#santa-messages');
      if (!section) return;
      const card = section.querySelector('.santa-message-box');
      scrollToSantaMessageDesk(card);
      const focusTarget = card?.querySelector('input:not([disabled])') ||
        card?.querySelector('h3[tabindex]');
      focusTarget?.focus({ preventScroll: true });
    });
  };
  return { pendingName, continueWithName };
}

export default function HomeHero({ preview = false, onContinue }) {
  return (
    <section className="hero hero-name-preview__hero" aria-labelledby="hero-name-preview-title">
      <picture className="hero-picture">
        <source media="(max-width: 600px)" srcSet="/images/north-pole-hero-mobile.webp" />
        <img src="/images/north-pole-hero.webp"
          alt="A snowy North Pole village with warmly lit windows beneath the northern lights"
          fetchpriority="high" />
      </picture>
      <div className="hero-aurora" aria-hidden="true" />
      <SantaFlyby />
      <div className="hero-layout hero-name-preview__layout">
        <div className="hero-content hero-name-preview__intro">
          {preview && <div className="hero-name-preview__flag" aria-label="Preview only">
            <span className="hero-name-preview__flag-mark" aria-hidden="true" />
            Hero preview
            <span className="hero-name-preview__flag-divider" aria-hidden="true" />
            Not the live homepage
          </div>}
          <p className="hero-name-preview__eyebrow">A little magic from the North Pole</p>
          <h1 id="hero-name-preview-title" className="hero-title">
            Live from The North Pole,<span>Santa Radio</span>
          </h1>
        </div>
        <div className="hero-name-preview__left-stack">
          <p className="hero-description hero-name-preview__description">
            Enjoy online Christmas music 24/7 on Santa Radio, your Christmas radio station all year round. Listen live to festive classics and family favourites.
          </p>
          <div className="hero-name-preview__listening">
            <div className="hero-name-preview__player-row">
              <div className="hero-actions hero-name-preview__actions">
                <RadioButton className="btn-red" />
              </div>
            </div>
            <p className="hero-note">The World’s Best Christmas Radio Station · All year round</p>
            <div id="christmas-countdown" className="hero-countdown"><Countdown /></div>
          </div>
        </div>
        <div className="hero-name-preview__artwork-slot" aria-label="Now playing artwork">
          <NowPlayingArtwork />
        </div>
        <aside className="hero-name-preview__checker" aria-label={preview ? 'Santa name checker preview' : 'Santa name checker'}>
          <div className="hero-name-preview__checker-top">
            <span className="hero-name-preview__seal" aria-hidden="true">S</span>
            <span className="hero-name-preview__checker-kicker">The North Pole</span>
          </div>
          <HeroNameChecker onContinue={onContinue} />
        </aside>
      </div>
    </section>
  );
}
