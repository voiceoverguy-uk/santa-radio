import HomepageSectionHeading from './HomepageSectionHeading.jsx';
import { Link } from 'react-router-dom';
import { BESPOKE_MESSAGES_PATH } from '../lib/messageMakerOffers.js';
import BespokeMessageOffers from './BespokeMessageOffers.jsx';
import { WorkshopPasswordForm } from './WorkshopPasswordForm.jsx';
import SantaMessageReviews from './SantaMessageReviews.jsx';
import useSantaRecipient from './useSantaRecipient.js';
import useSantaMessageHistory from './useSantaMessageHistory.js';
import './SantaMessageForm.css';
import './HomepageSantaStudio.css';

export default function HomepageSantaStudio({ directEntry = false, dedicatedPage = false, onAuthorized, accessFeedback, children }) {
  const selectedRecipient = useSantaRecipient();
  const { messages } = useSantaMessageHistory();
  const previewName = selectedRecipient || messages.at(-1)?.name || null;

  return (
    <section id="bespoke-santa-messages" className={`santa-message-section homepage-santa-studio${dedicatedPage ? " bespoke-messages-page" : ""}`} aria-labelledby="homepage-santa-studio-title">
      <div className="container homepage-santa-studio__layout">
        <HomepageSectionHeading
          eyebrow="A unique Christmas treat."
          title="THE BESPOKE SANTA MESSAGES"
          supportingLine={<>OUR <span className="bespoke-premium-glow">PREMIUM</span> EXPERIENCE</>}
          titleId="homepage-santa-studio-title"
          titleTag={directEntry || dedicatedPage ? 'h1' : 'h2'}
          className="homepage-santa-studio__heading"
        />
        {dedicatedPage ? <p className="homepage-santa-studio__seo-intro">Personalised Christmas video messages from Santa for children and dads. Watch the examples below, compare what’s included and choose a message to download and share.</p>
          : !directEntry && <p className="homepage-santa-studio__seo-intro"><Link to={BESPOKE_MESSAGES_PATH}>Explore personalised Santa messages for kids and dads →</Link></p>}
        {accessFeedback}
        <BespokeMessageOffers previewName={previewName} />
        {children}
        {directEntry && <details className="studio-entry-voucher">
          <summary>Have a friends voucher code?</summary>
          <WorkshopPasswordForm onAuthorized={onAuthorized} compact />
        </details>}
        {!directEntry && <SantaMessageReviews />}
      </div>
    </section>
  );
}
