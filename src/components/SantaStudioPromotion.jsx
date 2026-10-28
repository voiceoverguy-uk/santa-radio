import { useNavigate } from 'react-router-dom';
import { WorkshopPasswordForm } from './WorkshopPasswordForm.jsx';
import './SantaStudioPromotion.css';

export default function SantaStudioPromotion() {
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
          When the Studio launches, you’ll be able to add age, activities, achievements, country and festive treats. Each Studio message will include a free personalised Nice List certificate. The basic free greeting includes one too.
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
      <button className="santa-studio-promotion__purchase" type="button">
        Purchase
      </button>
    </section>
  );
}
