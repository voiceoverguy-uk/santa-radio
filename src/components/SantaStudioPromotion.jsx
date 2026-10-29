import { useNavigate } from 'react-router-dom';
import { WorkshopPasswordForm } from './WorkshopPasswordForm.jsx';
import './SantaStudioPromotion.css';
import StudioPurchaseButton from './StudioPurchaseButton.jsx';
import SantaStudioGifts from './SantaStudioGifts.jsx';

export default function SantaStudioPromotion({ activeExampleName = null }) {
  const navigate = useNavigate();

  return (
    <section id="santa-studio-promotion" className="santa-studio-promotion" aria-labelledby="santa-studio-title">
      <div className="santa-studio-promotion__intro">
        <div className="santa-studio-promotion__topline">
          <span className="santa-studio-promotion__seal" aria-hidden="true">S</span>
          <p className="santa-studio-promotion__eyebrow">A little more magic</p>
        </div>
        <h3 id="santa-studio-title" tabIndex={-1}>Santa’s <span className="santa-studio-promotion__title-line">Message Maker Studio</span></h3>
        <p className="santa-studio-promotion__copy">
          When the Studio launches, you’ll be able to add age, activities, achievements, country and festive treats. The paid Studio offer will include a personalised Nice List certificate and letter as a gift.
        </p>
        <div className="santa-studio-promotion__preview">
          <span className="santa-studio-promotion__preview-label">Coming soon</span>
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
      <StudioPurchaseButton />
      <SantaStudioGifts activeExampleName={activeExampleName} />
    </section>
  );
}
