import React from 'react';
import { STUDIO_PATH } from '../lib/studioRoute.js';
import './SantaCooldownUpsell.css';

function SantaCooldownUpsell({
  name = null,
  prelaunch = true,
  highlight = false,
  onExplore,
}) {
  const named = Boolean(name);
  const possessive = named ? `${name}’s` : 'a little one’s';

  const heading = named
    ? `A little more magic for ${name}?`
    : 'A little more Christmas magic?';

  const copy = prelaunch
    ? 'Make it even more magical with Santa’s Message Maker Studio for a bespoke message and bonus digital gifts.'
    : `Make it extra special with a bespoke message from Santa, personalised with ${possessive} age, achievements and the things that make them special. Your paid package also includes three personalised digital gifts at no extra cost: a Nice List certificate, a short letter from Santa and Santa’s Nice List picture.`;

  const buttonLabel = prelaunch
    ? named
      ? `Preview ${name}’s bespoke message package`
      : 'Preview the bespoke message package'
    : named
      ? `Explore ${name}’s bespoke message`
      : 'Explore bespoke Santa messages';

  return (
    <section
      className="message-cooldown-upsell"
      aria-label="Bespoke Santa message invitation"
    >
      <h4 className="message-cooldown-upsell__heading">{heading}</h4>
      <p className="message-cooldown-upsell__copy">{copy}</p>
      <a
        className={`message-cooldown-upsell__link${highlight ? ' message-cooldown-upsell__link--highlight' : ''}`}
        href={STUDIO_PATH}
        onClick={onExplore}
        onAuxClick={event => { if (event.button === 1) onExplore?.(event); }}
      >
        {buttonLabel}
      </a>
    </section>
  );
}

export default SantaCooldownUpsell;
