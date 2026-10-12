import { useSearchParams } from 'react-router-dom';
import PageSeo from '../seo/PageSeo.jsx';
import Breadcrumbs from '../seo/Breadcrumbs.jsx';
import { messageMetadata, messageBreadcrumbs } from '../seo/catalogue.js';
import { santaMessageRequestedName } from '../seo/santaMessageLinks.js';
import SantaMessageForm from '../components/SantaMessageForm.jsx';
import './FreeSantaMessage.css';

export default function FreeSantaMessage() {
  const [params] = useSearchParams();
  const requestedName = santaMessageRequestedName(params.get('name'));
  return (
    <main>
      <PageSeo metadata={messageMetadata()} />
      <div className="fsm-hero starry-bg">
        <div className="fsm-hero-content">
          <img className="brand-logo brand-logo-hero" src="/images/santa-radio-logo.png" alt="Santa Radio" width="827" height="190" />
          <p className="fsm-kicker">Special delivery from the North Pole</p>
          <h1 className="fsm-sub">Free Personalised Santa Message</h1>
          <p className="fsm-desc">Create a free message from Santa with your child’s name. Choose a recorded name, listen to a personalised Santa audio greeting and download your MP3 to keep.</p>
        </div>
      </div>
      <Breadcrumbs items={messageBreadcrumbs} />
      <SantaMessageForm key={requestedName} showDetailLink={false} initialName={requestedName} />
    </main>
  );
}
