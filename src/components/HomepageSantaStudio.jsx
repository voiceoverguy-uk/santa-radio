import HomepageSectionHeading from './HomepageSectionHeading.jsx';
import SantaStudioPromotion from './SantaStudioPromotion.jsx';
import SantaMessageReviews from './SantaMessageReviews.jsx';
import useSantaRecipient from './useSantaRecipient.js';
import useSantaMessageHistory from './useSantaMessageHistory.js';
import useSantaNameTotal from './useSantaNameTotal.js';
import useSantaNameCounter from './useSantaNameCounter.js';
import './SantaMessageForm.css';
import './HomepageSantaStudio.css';

export default function HomepageSantaStudio({ directEntry = false, onAuthorized, accessFeedback, children }) {
  const selectedRecipient = useSantaRecipient();
  const { messages } = useSantaMessageHistory();
  const previewName = selectedRecipient || messages.at(-1)?.name || null;
  const hostedNameTotal = useSantaNameTotal();
  const displayedNameCount = useSantaNameCounter(hostedNameTotal);
  const availableNamesText = displayedNameCount !== null
    ? `${displayedNameCount.toLocaleString('en-GB')} ${displayedNameCount === 1 ? 'name' : 'names'} available`
    : 'Recorded names available to search';

  return (
    <section id="bespoke-santa-messages" className="santa-message-section homepage-santa-studio" aria-labelledby="homepage-santa-studio-title">
      <div className="container homepage-santa-studio__layout">
        <HomepageSectionHeading
          eyebrow="A unique Christmas treat."
          title="A BESPOKE SANTA MESSAGE"
          supportingLine="OUR PREMIUM EXPERIENCE"
          subtitle="Let’s make it even more magical for your little one."
          titleId="homepage-santa-studio-title"
          titleTag={directEntry ? 'h1' : 'h2'}
          className="homepage-santa-studio__heading"
        />
        {accessFeedback}
        <SantaStudioPromotion availableNamesText={availableNamesText}
          previewName={previewName} allowExamples={!previewName && !messages.length}
          onAuthorized={onAuthorized} />
        {children}
        {!directEntry && <SantaMessageReviews />}
      </div>
    </section>
  );
}
