import React from 'react';
import './SantaCooldownUpsell.css';

function SantaCooldownUpsell({
  name = null,
  prelaunch = true,
  highlight = false,
  onExplore,
}) {
  const named = Boolean(name);

  const heading = named
    ? `A little more magic for ${name}?`
    : 'A little more Christmas magic?';

  const copy = prelaunch
    ? 'Make it even more magical with Santa’s Message Maker Studio for a bespoke message and bonus digital gifts.'
    : 'Make it extra special with a bespoke message from Santa. Including personalised digital gifts.';

  const buttonLabel = prelaunch
    ? named
      ? `Preview ${name}’s bespoke message package`
      : 'Preview the bespoke message package'
    : 'Click for more →';

  return (
    <section
      className="message-cooldown-upsell"
      aria-label="Bespoke Santa message invitation"
    >
      <h4 className="message-cooldown-upsell__heading">{heading}</h4>
      <p className="message-cooldown-upsell__copy">{copy}</p>
      <a
        className={`message-cooldown-upsell__link${highlight ? ' message-cooldown-upsell__link--highlight' : ''}`}
        href="/#bespoke-santa-messages"
        onClick={onExplore}
        onAuxClick={event => { if (event.button === 1) onExplore?.(event); }}
      >
        {buttonLabel}
      </a>
    </section>
  );
}

export default SantaCooldownUpsell;
