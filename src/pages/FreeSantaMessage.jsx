import { Helmet } from 'react-helmet-async';
import SantaMessageForm from '../components/SantaMessageForm.jsx';
import './FreeSantaMessage.css';

export default function FreeSantaMessage() {
  return (
    <main>
      <Helmet>
        <title>Free Personalised Santa Message {'\u2013'} Santa Radio</title>
        <meta name="description" content="Choose a recorded name and create a free personalised Santa greeting. Preview and download your freshly mixed MP3, with no signup." />
      </Helmet>
      <div className="fsm-hero starry-bg">
        <div className="fsm-hero-content">
          <img className="brand-logo brand-logo-hero" src="/images/santa-radio-logo.png" alt="Santa Radio" width="827" height="190" />
          <p className="fsm-kicker">Special delivery from the North Pole</p>
          <h1 className="fsm-sub">Free Personalised Santa Message</h1>
          <p className="fsm-desc">A familiar name. An unmistakable voice. A recorded Christmas greeting to listen to and keep.</p>
        </div>
      </div>
      <SantaMessageForm showDetailLink={false} />
    </main>
  );
}
