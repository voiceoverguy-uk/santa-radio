import { useNavigate } from 'react-router-dom';
import { WorkshopPasswordForm } from './WorkshopPasswordForm.jsx';
import './SantaStudioPromotion.css';
import StudioPurchaseButton from './StudioPurchaseButton.jsx';
import SantaStudioGifts from './SantaStudioGifts.jsx';
import SantaStudioLaunchCountdown from './SantaStudioLaunchCountdown.jsx';

export default function SantaStudioPromotion({ activeExampleName = null, availableNamesText, previewName = null }) {
  const navigate = useNavigate();

  return (
    <section id="santa-studio-promotion" className="santa-studio-promotion" aria-labelledby="santa-studio-title">
      <div className="santa-studio-promotion__details">
        <div className="santa-studio-promotion__intro">
          <div className="santa-studio-promotion__topline">
            <span className="santa-studio-promotion__seal" aria-hidden="true">S</span>
            <div className="santa-studio-promotion__heading">
              <p className="santa-studio-promotion__eyebrow">A little more magic</p>
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
          <p className="santa-studio-promotion__copy">
            When Studio - A launches, you’ll be able to add age, activities, achievements, country and festive treats.{' '}
            <br />
            The paid offer will include a digital personalised Nice List certificate, a short personal letter from Santa and a picture confirming your place on the Nice List. *
            <br /><br />
            <small>* have you been good this year?</small>
          </p>
          <div className="santa-studio-promotion__preview">
            <span className="santa-studio-promotion__preview-label">Coming Early November</span>
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
        <SantaStudioGifts activeExampleName={activeExampleName} previewName={previewName} />
    </section>
  );
}
