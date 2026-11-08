import HomepageSectionHeading from './HomepageSectionHeading.jsx';
import SantaStudioPromotion from './SantaStudioPromotion.jsx';
import SantaMessageReviews from './SantaMessageReviews.jsx';
import useSantaRecipient from './useSantaRecipient.js';
import useSantaMessageHistory from './useSantaMessageHistory.js';
import useSantaNameTotal from './useSantaNameTotal.js';
import useSantaNameCounter from './useSantaNameCounter.js';
import './SantaMessageForm.css';
import './HomepageSantaStudio.css';

export default function HomepageSantaStudio() {
  const selectedRecipient = useSantaRecipient();
  const { messages } = useSantaMessageHistory();
  const previewName = selectedRecipient || messages.at(-1)?.name || null;
  const hostedNameTotal = useSantaNameTotal();
  const displayedNameCount = useSantaNameCounter(hostedNameTotal);
  const availableNamesText = displayedNameCount !== null
    ? `${displayedNameCount.toLocaleString('en-GB')} ${displayedNameCount === 1 ? 'name' : 'names'} available`
    : 'Recorded names available to search';

  return (
    <section className="santa-message-section homepage-santa-studio" aria-labelledby="homepage-santa-studio-title">
      <div className="container homepage-santa-studio__layout">
        <HomepageSectionHeading
          eyebrow="A unique Christmas treat."
          title="MESSAGE FROM SANTA"
          supportingLine="OUR PREMIUM EXPERIENCE"
          subtitle="Ask Santa for a bespoke message to your little one."
          titleId="homepage-santa-studio-title"
          className="homepage-santa-studio__heading"
        />
        <SantaStudioPromotion availableNamesText={availableNamesText}
          previewName={previewName} allowExamples={!previewName && !messages.length} />
        <SantaMessageReviews />
      </div>
    </section>
  );
}
