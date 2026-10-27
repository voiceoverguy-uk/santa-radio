import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { EMPTY_CHOICES, SETTINGS_EVENT } from '../privacy/cookieConsent.js';
import { useCookieConsent } from '../privacy/CookieConsentProvider.jsx';
import { trackPageView, revokeMarketing } from '../privacy/marketingConsent.js';
import { trackAnalyticsPageView, revokeAnalytics } from '../privacy/googleAnalytics.js';
import './MarketingConsent.css';

const allChoices = { analytics: true, marketing: true, media: true };
const toDraft = choice => ({
  analytics: choice?.analytics === true, marketing: choice?.marketing === true,
  media: choice?.media === true,
});

export default function MarketingConsent() {
  const { pathname } = useLocation();
  const { ready, choice, chooseConsent, storageWarning, dismissStorageWarning, settingsOpen, setSettingsOpen } = useCookieConsent();
  const [draft, setDraft] = useState(EMPTY_CHOICES);
  const [playerClearance, setPlayerClearance] = useState(88);
  const heading = useRef(null);
  const opener = useRef(null);
  const settingsTrigger = useRef(null);

  useEffect(() => {
    const player = document.querySelector('.radio-dock');
    if (!player) return;
    const measure = () => {
      const bounds = player.getBoundingClientRect();
      setPlayerClearance(bounds.height > 0 ? Math.max(0, Math.ceil(window.innerHeight - bounds.top)) : 0);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(player);
    window.addEventListener('resize', measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  useEffect(() => {
    const open = () => {
      opener.current = document.activeElement;
      setSettingsOpen(true);
    };
    window.addEventListener(SETTINGS_EVENT, open);
    return () => window.removeEventListener(SETTINGS_EVENT, open);
  }, []);

  useEffect(() => {
    if (settingsOpen) {
      setDraft(toDraft(choice));
      heading.current?.focus();
    }
  }, [settingsOpen, choice]);

  useEffect(() => {
    if (!ready) return;
    if (choice?.marketing) trackPageView(pathname);
    else revokeMarketing();
    if (choice?.analytics) trackAnalyticsPageView(pathname);
    else revokeAnalytics();
  }, [ready, choice, pathname]);

  const closeSettings = () => {
    setSettingsOpen(false);
    requestAnimationFrame(() => {
      if (opener.current?.isConnected) opener.current.focus();
      else settingsTrigger.current?.focus();
    });
  };
  const choose = next => {
    chooseConsent(next);
    closeSettings();
  };
  const complete = choice !== null && typeof choice.analytics === 'boolean';
  if (!ready || (complete && !settingsOpen && !storageWarning)) return null;
  if (complete && !settingsOpen && storageWarning) {
    return <section className="marketing-consent" style={{ '--audio-player-height': `${playerClearance}px` }}
      aria-label="Cookie preference status" aria-live="polite">
      <p>Your choice applies to this visit. Your browser could not save it for future visits.</p>
      <button type="button" onClick={dismissStorageWarning}>Dismiss</button>
    </section>;
  }

  return (
    <section className={`marketing-consent${settingsOpen ? ' is-settings' : ''}`}
      style={{ '--audio-player-height': `${playerClearance}px` }}
      role="region" aria-labelledby="marketing-consent-title"
      onKeyDown={event => { if (settingsOpen && event.key === 'Escape') closeSettings(); }}>
      <div className="marketing-consent-copy">
        <h2 id="marketing-consent-title" ref={heading} tabIndex={-1}>
          {settingsOpen ? 'Cookie settings' : 'A quick word about cookies'}
        </h2>
        {settingsOpen ? <>
          <p>Necessary storage keeps your choices and requested features working. Optional choices are yours;
            you can still browse, listen and access Santa messages without them.</p>
          <fieldset className="marketing-consent-options">
            <legend>Optional choices</legend>
            <label>
              <input type="checkbox" checked={draft.analytics} onChange={event =>
                setDraft(current => ({ ...current, analytics: event.target.checked }))} />
              <span><strong>Analytics cookies</strong><small>Google Analytics helps us understand visits and which pages are used.</small></span>
            </label>
            <label>
              <input type="checkbox" checked={draft.marketing} onChange={event =>
                setDraft(current => ({ ...current, marketing: event.target.checked }))} />
              <span><strong>Marketing cookies</strong><small>Meta measures adverts and helps show relevant advertising on Facebook and Instagram.</small></span>
            </label>
            <label>
              <input type="checkbox" checked={draft.media} onChange={event =>
                setDraft(current => ({ ...current, media: event.target.checked }))} />
              <span><strong>External media</strong><small>YouTube videos and the optional TuneIn player can use cookies and device information for playback, analytics and advertising. The homepage TV loads automatically before a choice is saved; saving this unchecked turns it off too. Other embeds wait for permission. Not needed for our live radio.</small></span>
            </label>
          </fieldset>
          <p>Saved for up to 180 days. Turning a choice off stops future optional activity here; it cannot undo data already sent or remove third-party cookies.</p>
        </> : <p>Necessary storage keeps things working. Optional Google Analytics helps us understand visits;
          Meta measures adverts and helps show relevant advertising. The homepage TV loads YouTube automatically,
          which may use cookies and device information for playback, analytics and advertising.
          Decline turns it off. Other YouTube videos and TuneIn wait for external-media permission.
          Accept all enables all three categories; automatic TV loading does not enable Google Analytics or Meta.</p>}
        {!complete && choice && <p>Your earlier Meta choice is kept. Analytics and external media need their own permission.</p>}
      </div>
      <div className="marketing-consent-actions">
        {settingsOpen
          ? <button type="button" onClick={() => choose(draft)}>Save choices</button>
          : <button type="button" onClick={() => choose(allChoices)}>Accept all</button>}
        <button type="button" onClick={() => choose(EMPTY_CHOICES)}>Decline optional cookies</button>
      </div>
      <div className="marketing-consent-links">
        {settingsOpen
          ? <button type="button" onClick={closeSettings}>Close settings</button>
          : <button type="button" ref={settingsTrigger} aria-expanded={false} onClick={event => {
            opener.current = event.currentTarget;
            setSettingsOpen(true);
          }}>Cookie settings</button>}
        <Link to="/privacy-policy">Privacy Policy</Link>
      </div>
    </section>
  );
}
