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
            <p className="santa-studio-promotion__name-count">A little North Pole magic, made personal</p>
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
          <h3 id="santa-studio-title" tabIndex={-1}>Imagine their face<br />when Santa knows…</h3>
          <p className="santa-studio-promotion__subheading">
            Their name. Their proudest moments. Even Santa’s favourite treat.
          </p>
          <p className="santa-studio-promotion__copy">
            Go beyond a name with a message that celebrates what makes your child special. Tell Santa their age, achievements and where they live. You can even tell him what they’re leaving out on Christmas Eve.
          </p>
          <div className="santa-studio-promotion__benefits">
            <p className="santa-studio-promotion__benefits-lead">
              Two personalised audio messages, with three gifts for each child:
            </p>
            <ul className="santa-studio-promotion__benefit-list">
              <li>A personalised Nice List certificate</li>
              <li>A personalised letter from Santa</li>
              <li>A Santa picture with their name</li>
            </ul>
          </div>
        </div>
      <div className="santa-studio-promotion__offer" role="group"
        aria-labelledby={`${offerTitleId} ${offerAmountId}`} aria-describedby={offerTermsId}>
        <p id={offerTitleId} className="santa-studio-promotion__offer-title">Christmas magic for two children</p>
        <p id={offerAmountId} className="santa-studio-promotion__offer-price">£6.50 <small>total</small></p>
        <p id={offerTermsId} className="santa-studio-promotion__offer-terms">Two message creations · One-off payment</p>
      </div>
        <div className="santa-studio-promotion__actions">
        <StudioPurchaseButton onPaidAccessChange={setPaidAccess} />
        <p className="santa-studio-promotion__checkout-note">
          <a href="/my-santa-messages">My Santa Messages · sign in or create an account</a>
          <br />Use your purchase email to save and download your creations.
        </p>
        {!paidAccess && <details className="santa-studio-promotion__voucher-entry">
          <summary>Have a voucher code?</summary>
          <WorkshopPasswordForm
          variant="promotion"
          onAuthorized={onAuthorized || (() => navigate(STUDIO_PATH))}
        /></details>}
        </div>
      </div>
      <div className="santa-studio-promotion__examples">
        <div className="santa-studio-promotion__audio"><SantaStudioAudioExample compact onActiveExampleNameChange={setPaidExampleName} /></div>
      <div className="santa-studio-promotion__gifts" data-expanded={giftsExpanded}>
        <div className="santa-studio-promotion__gift-controls">
          <button className="santa-studio-promotion__gift-toggle" type="button"
            aria-expanded={giftsExpanded} aria-controls={giftsId}
            onClick={() => setGiftsExpanded(value => !value)}>
            Your personalised keepsakes
            <span className="santa-studio-promotion__gift-arrow" aria-hidden="true">▾</span>
          </button>
        </div>
        <div id={giftsId} className="santa-studio-promotion__gift-content">
          <StudioGiftPreview example={example} variant="promotion"
            onPreviewOpen={() => setGiftsExpanded(true)} />
        </div>
      </div>
      </div>
    </section>
  );
}
