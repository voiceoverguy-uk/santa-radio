import HomepageSectionHeading from './HomepageSectionHeading.jsx';
import BespokeMessageOffers from './BespokeMessageOffers.jsx';
import { WorkshopPasswordForm } from './WorkshopPasswordForm.jsx';
import SantaMessageReviews from './SantaMessageReviews.jsx';
import useSantaRecipient from './useSantaRecipient.js';
import useSantaMessageHistory from './useSantaMessageHistory.js';
import './SantaMessageForm.css';
import './HomepageSantaStudio.css';

export default function HomepageSantaStudio({ directEntry = false, onAuthorized, accessFeedback, children }) {
  const selectedRecipient = useSantaRecipient();
  const { messages } = useSantaMessageHistory();
  const previewName = selectedRecipient || messages.at(-1)?.name || null;

  return (
    <section id="bespoke-santa-messages" className="santa-message-section homepage-santa-studio" aria-labelledby="homepage-santa-studio-title">
      <div className="container homepage-santa-studio__layout">
        <HomepageSectionHeading
          eyebrow="A unique Christmas treat."
          title="THE BESPOKE SANTA MESSAGES"
          supportingLine={<>OUR <span className="bespoke-premium-glow">PREMIUM</span> EXPERIENCE</>}
          titleId="homepage-santa-studio-title"
          titleTag={directEntry ? 'h1' : 'h2'}
          className="homepage-santa-studio__heading"
        />
        {accessFeedback}
        <BespokeMessageOffers previewName={previewName} />
        {directEntry && <details className="studio-entry-voucher">
          <summary>Have a friends voucher code?</summary>
          <WorkshopPasswordForm onAuthorized={onAuthorized} compact />
        </details>}
        {children}
        {!directEntry && <SantaMessageReviews />}
      </div>
    </section>
  );
}
