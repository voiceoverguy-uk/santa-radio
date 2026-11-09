import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WorkshopPasswordForm } from './WorkshopPasswordForm.jsx';
import './SantaStudioPromotion.css';
import StudioPurchaseButton from './StudioPurchaseButton.jsx';
import { StudioGiftPreview, useStudioGiftExample } from './SantaStudioGifts.jsx';
import StudioPortraitViewer from './StudioPortraitViewer.jsx';
import SantaStudioAudioExample from './SantaStudioAudioExample.jsx';
import { STUDIO_PATH } from '../lib/studioRoute.js';

export default function SantaStudioPromotion({ activeExampleName = null, availableNamesText, previewName = null, allowExamples = true }) {
  const navigate = useNavigate();
  const [paidExampleName, setPaidExampleName] = useState(null);
  const [giftsExpanded, setGiftsExpanded] = useState(false);
  const giftsId = useId();
  // Copy and every gift share the very same resolved recipient/rotation.
  const example = useStudioGiftExample({
    activeExampleName, paidExampleName, previewName, allowExamples,
  });

  return (
    <section id="santa-studio-promotion" className="santa-studio-promotion" aria-labelledby="santa-studio-title"
      data-recipient={previewName || undefined}>
      <header className="santa-studio-promotion__header">
        <div className="santa-studio-promotion__topline">
          <span className="santa-studio-promotion__seal" aria-hidden="true">S</span>
          <div className="santa-studio-promotion__heading">
            <p className="santa-studio-promotion__eyebrow">THE NORTH POLE RECORDING STUDIO</p>
            <p className="santa-studio-promotion__name-count" role="status" aria-live="off">{availableNamesText}</p>
          </div>
        </div>
        <span className="message-recording-indicator santa-studio-promotion__recording" title="North Pole recording studio">
          <span className="message-recording-dot" aria-hidden="true" />
          Recording
        </span>
        <div className="santa-studio-promotion__preview">
          <StudioPortraitViewer />
        </div>
        <div className="santa-studio-promotion__header-divider" aria-hidden="true" />
      </header>
      <div className="santa-studio-promotion__details">
        <div className="santa-studio-promotion__intro">
          <h3 id="santa-studio-title" tabIndex={-1}>Santa’s <span className="santa-studio-promotion__title-line">Message Maker Studio</span></h3>
          <p className="santa-studio-promotion__subheading">
            A little more Christmas magic for {example.name}
          </p>
          <p className="santa-studio-promotion__copy">
            Create a personalised message from Santa, with {example.name}’s age, achievements and the things that make them special for an extra personal touch.
          </p>
        </div>
        <article className="santa-studio-promotion__offer" aria-labelledby="santa-studio-offer-title">
          <div className="santa-studio-promotion__offer-price-block">
            <p className="santa-studio-promotion__offer-kicker">One Christmas package</p>
            <p id="santa-studio-offer-title" className="santa-studio-promotion__offer-headline">
              <span className="santa-studio-promotion__offer-price">£6.50</span>
              <span className="santa-studio-promotion__offer-for">for <strong>two</strong> bespoke messages from Santa</span>
            </p>
            <p className="santa-studio-promotion__offer-note">One payment for the pair, not per message.</p>
          </div>
          <ol className="santa-studio-promotion__offer-pair" aria-label="What the package includes">
            <li><span className="santa-studio-promotion__offer-num" aria-hidden="true">1</span><span>A bespoke recorded message, as a personalised MP3</span></li>
            <li><span className="santa-studio-promotion__offer-num" aria-hidden="true">2</span><span>A second bespoke message, ready to keep or share</span></li>
          </ol>
          <div className="santa-studio-promotion__benefits">
            <p className="santa-studio-promotion__benefits-lead">Each message comes with free gifts for one child:</p>
            <ul className="santa-studio-promotion__benefit-list">
              <li>An official Nice List certificate</li>
              <li>A short personal letter from Santa</li>
              <li>Santa celebrating {example.name}’s place on the Nice List</li>
            </ul>
          </div>
        </article>
        <WorkshopPasswordForm
          variant="promotion"
          onAuthorized={() => navigate(STUDIO_PATH)}
        />
        <StudioPurchaseButton />
        <SantaStudioAudioExample onActiveExampleNameChange={setPaidExampleName} />
      </div>
      <div className="santa-studio-promotion__gifts" data-expanded={giftsExpanded}>
        <div className="santa-studio-promotion__gift-controls">
          <button className="santa-studio-promotion__gift-toggle" type="button"
            aria-expanded={giftsExpanded} aria-controls={giftsId}
            onClick={() => setGiftsExpanded(value => !value)}>
            Free gifts include
            <span className="santa-studio-promotion__gift-arrow" aria-hidden="true">▾</span>
          </button>
          <p className="santa-studio-promotion__mobile-price">
            <span className="santa-studio-promotion__mobile-price-amount">£6.50</span>{' '}
            <span className="santa-studio-promotion__mobile-price-caption">for 2 messages</span>
          </p>
        </div>
        <div id={giftsId} className="santa-studio-promotion__gift-content">
          <StudioGiftPreview example={example} variant="promotion"
            onPreviewOpen={() => setGiftsExpanded(true)} />
        </div>
      </div>
    </section>
  );
}
