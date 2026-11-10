import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WorkshopPasswordForm } from './WorkshopPasswordForm.jsx';
import './SantaStudioPromotion.css';
import StudioPurchaseButton from './StudioPurchaseButton.jsx';
import { StudioGiftPreview, useStudioGiftExample } from './SantaStudioGifts.jsx';
import StudioPortraitViewer from './StudioPortraitViewer.jsx';
import SantaStudioAudioExample from './SantaStudioAudioExample.jsx';
import { hasStudioPurchaseHint } from '../lib/studioPurchaseHint.js';
import { STUDIO_PATH } from '../lib/studioRoute.js';

export default function SantaStudioPromotion({ activeExampleName = null, availableNamesText, previewName = null, allowExamples = true, onAuthorized }) {
  const navigate = useNavigate();
  const [paidAccess, setPaidAccess] = useState(() => !import.meta.env.DEV && hasStudioPurchaseHint());
  const [paidExampleName, setPaidExampleName] = useState(null);
  const [giftsExpanded, setGiftsExpanded] = useState(false);
  const giftsId = useId();
  const offerId = useId();
  const offerTitleId = `${offerId}-title`;
  const offerAmountId = `${offerId}-amount`;
  const offerTermsId = `${offerId}-terms`;
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
          <div className="santa-studio-promotion__benefits">
            <p className="santa-studio-promotion__benefits-lead">
              Each creation includes a personalised MP3 and three gifts for one child:
            </p>
            <ul className="santa-studio-promotion__benefit-list">
              <li>An official Nice List certificate</li>
              <li>A short personal letter from Santa</li>
              <li>Santa picture personalised for {example.name}</li>
            </ul>
          </div>
        </div>
      <div className="santa-studio-promotion__offer" role="group"
        aria-labelledby={`${offerTitleId} ${offerAmountId}`} aria-describedby={offerTermsId}>
        <p id={offerTitleId} className="santa-studio-promotion__offer-title">2 bespoke messages from Santa</p>
        <p id={offerAmountId} className="santa-studio-promotion__offer-price">£6.50</p>
        <p id={offerTermsId} className="santa-studio-promotion__offer-terms">One-off payment · Two message creations</p>
      </div>
        <div className="santa-studio-promotion__actions">
        <StudioPurchaseButton onPaidAccessChange={setPaidAccess} />
        {!paidAccess && <div className="santa-studio-promotion__voucher-entry">
          <WorkshopPasswordForm
          variant="promotion"
          onAuthorized={onAuthorized || (() => navigate(STUDIO_PATH))}
        /></div>}
        </div>
      </div>
      <div className="santa-studio-promotion__examples">
      <div className="santa-studio-promotion__gifts" data-expanded={giftsExpanded}>
        <div className="santa-studio-promotion__gift-controls">
          <button className="santa-studio-promotion__gift-toggle" type="button"
            aria-expanded={giftsExpanded} aria-controls={giftsId}
            onClick={() => setGiftsExpanded(value => !value)}>
            Free gifts include
            <span className="santa-studio-promotion__gift-arrow" aria-hidden="true">▾</span>
          </button>
        </div>
        <div id={giftsId} className="santa-studio-promotion__gift-content">
          <StudioGiftPreview example={example} variant="promotion"
            onPreviewOpen={() => setGiftsExpanded(true)} />
        </div>
      </div>
        <div className="santa-studio-promotion__audio"><SantaStudioAudioExample onActiveExampleNameChange={setPaidExampleName} /></div>
      </div>
    </section>
  );
}
