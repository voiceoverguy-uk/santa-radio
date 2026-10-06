import { Helmet } from 'react-helmet-async';
import SantaMessageForm from '../components/SantaMessageForm.jsx';
import './FreeSantaMessage.css';

export default function FreeSantaMessage() {
  return (
    <main>
      <Helmet>
        <title>Free Personalised Santa Message {'\u2013'} Santa Radio</title>
        <meta name="description" content="Get a FREE, instantly downloadable personalised message from Santa for your child on Santa Radio." />
      </Helmet>
      <div className="fsm-hero starry-bg">
        <div className="fsm-hero-content">
          <h1 className="fsm-title gold-text">Santa Radio</h1>
          <h2 className="fsm-sub">Free Personalised Santa Message</h2>
          <p className="fsm-desc">Explore personalised Santa messages. Requests and downloads are not currently available on this website.</p>
        </div>
      </div>
      <SantaMessageForm />
    </main>
  );
}
