import React from 'react';
import { useBlackFridayOfferWindow } from './BlackFridayOffer.jsx';
import { BESPOKE_MESSAGES_PATH, kidsOffer } from '../lib/messageMakerOffers.js';
import './SantaCooldownUpsell.css';

function SantaCooldownUpsell({ name = null, prelaunch = true, highlight = false, onExplore }) {
  const blackFriday = useBlackFridayOfferWindow();
  return (
    <section className="message-cooldown-upsell" aria-label="Full Santa video offer">
      <p className="message-cooldown-upsell__eyebrow">Loved their free message? There’s more!</p>
      <h4 className="message-cooldown-upsell__heading">Make a full Santa video {name ? `for ${name}` : 'for your child'}</h4>
      <p className="message-cooldown-upsell__copy">Santa talks about their name, age and the things they’ve done well. You choose the details!</p>
      <p className="message-cooldown-upsell__copy">Includes a letter from Santa and a Nice List certificate to print and keep.</p>
      {!prelaunch && <p className="message-cooldown-upsell__price">
        <strong>{blackFriday ? '£3.25 with code HALFPRICE' : '£6.50'}</strong>
        <span>{blackFriday ? 'Black Friday · Usually £6.50. Includes two video creations.' : 'Includes two video creations.'}</span>
      </p>}
      <a className={`message-cooldown-upsell__link${highlight ? ' message-cooldown-upsell__link--highlight' : ''}`}
        href={`${BESPOKE_MESSAGES_PATH}#${kidsOffer.id}`} onClick={onExplore}
        onAuxClick={event => { if (event.button === 1) onExplore?.(event); }}>
        Watch an example →
      </a>
    </section>
  );
}

export default SantaCooldownUpsell;
