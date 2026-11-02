import React from 'react';
import './SantaCooldownUpsell.css';

function SantaCooldownUpsell({
  name = null,
  prelaunch = true,
  onExplore,
}) {
  const named = Boolean(name);
  const possessive = named ? `${name}’s` : 'a little one’s';

  const heading = prelaunch
    ? named
      ? `Coming soon: a little more magic for ${name}`
      : 'Coming soon: a little more Christmas magic'
    : named
      ? `A little more magic for ${name}?`
      : 'A little more Christmas magic?';

  const copy = prelaunch
    ? `When Santa’s Message Maker Studio opens, you’ll be able to create a bespoke message personalised with ${possessive} age, achievements and the things that make them special. The paid package will also include three personalised digital gifts at no extra cost: a Nice List certificate, a short letter from Santa and Santa’s Nice List picture.`
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
        className="message-cooldown-upsell__link"
        href="#santa-studio-promotion"
        onClick={onExplore}
      >
        {buttonLabel}
      </a>
    </section>
  );
}

export default SantaCooldownUpsell;
