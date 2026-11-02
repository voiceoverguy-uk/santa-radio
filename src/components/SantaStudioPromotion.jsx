import { useNavigate } from 'react-router-dom';
import { WorkshopPasswordForm } from './WorkshopPasswordForm.jsx';
import './SantaStudioPromotion.css';
import StudioPurchaseButton from './StudioPurchaseButton.jsx';
import { StudioGiftPreview, useStudioGiftExample } from './SantaStudioGifts.jsx';
import SantaStudioLaunchCountdown from './SantaStudioLaunchCountdown.jsx';

export default function SantaStudioPromotion({ activeExampleName = null, availableNamesText, previewName = null, allowExamples = true }) {
  const navigate = useNavigate();
  // Copy and every gift share the very same resolved recipient/rotation.
  const example = useStudioGiftExample({ activeExampleName, previewName, allowExamples });

  return (
    <section id="santa-studio-promotion" className="santa-studio-promotion" aria-labelledby="santa-studio-title"
      data-recipient={previewName || undefined}>
      <div className="santa-studio-promotion__details">
        <div className="santa-studio-promotion__intro">
          <div className="santa-studio-promotion__topline">
            <span className="santa-studio-promotion__seal" aria-hidden="true">S</span>
            <div className="santa-studio-promotion__heading">
              <p className="santa-studio-promotion__eyebrow">THE NORTH POLE RECORDING STUDIO</p>
              <div className="message-name-status">
                <p className="santa-studio-promotion__name-count" role="status" aria-live="off">{availableNamesText}</p>
                <span className="message-recording-indicator" title="North Pole recording studio">
                  <span className="message-recording-dot" aria-hidden="true" />
                  Recording (Studio - A)
                </span>
              </div>
            </div>
          </div>
          <h3 id="santa-studio-title" tabIndex={-1}>Santa’s <span className="santa-studio-promotion__title-line">Message Maker Studio</span></h3>
          <p className="santa-studio-promotion__subheading">
            A little more Christmas magic for {example.name}
          </p>
          <p className="santa-studio-promotion__copy">
            Create a personalised message from Santa, with {example.name}’s age, achievements and the things that make them special for an extra personal touch.
          </p>
          <div className="santa-studio-promotion__benefits">
            <p className="santa-studio-promotion__benefits-lead">
              <strong>Your paid package includes a personalised message from Santa, plus three personalised digital gifts to download:</strong>
            </p>
            <ul className="santa-studio-promotion__benefit-list">
              <li>An official Nice List certificate</li>
              <li>A short personal letter from Santa</li>
              <li>A picture of Santa celebrating {example.name}’s place on the Nice List*</li>
            </ul>
            <p className="santa-studio-promotion__footnote">*Subject to staying on the Nice List, of course.</p>
          </div>
          <div className="santa-studio-promotion__preview">
            <img
              className="santa-studio-promotion__artwork"
              src="/images/santa-studio-headphones.webp"
              alt="Santa wearing headphones at a festive message-making microphone"
            />
          </div>
        </div>
        <WorkshopPasswordForm
          variant="promotion"
          onAuthorized={() => navigate('/santa-message-workshop')}
        />
        <SantaStudioLaunchCountdown />
        <StudioPurchaseButton />
      </div>
        <StudioGiftPreview example={example} />
    </section>
  );
}
