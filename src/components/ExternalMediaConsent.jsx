import { useId } from 'react';
import { useCookieConsent } from '../privacy/CookieConsentProvider.jsx';
import './ExternalMediaConsent.css';

export default function ExternalMediaConsent({ provider, href, onEnable, children }) {
  const { mediaAllowed, enableMedia } = useCookieConsent();
  const description = useId();
  if (mediaAllowed) return children;
  return <div className="external-media-placeholder" role="group" aria-label={`${provider} content is off`}>
    <p id={description}><strong>{provider} is off.</strong> External media lets YouTube and TuneIn
      use cookies and device information for playback, analytics and advertising.</p>
    <button type="button" className="btn-gold" aria-describedby={description} onClick={() => {
      enableMedia();
      onEnable?.();
    }}>Enable external media</button>
    <a href={href} target="_blank" rel="noopener noreferrer">Open on {provider} instead (new tab)</a>
    <p className="external-media-note">Only media permission changes. Change it back in Cookie settings. Our live radio works without it.</p>
  </div>;
}
