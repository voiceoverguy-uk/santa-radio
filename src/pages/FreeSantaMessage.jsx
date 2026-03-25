import SantaMessageForm from '../components/SantaMessageForm.jsx';
import './FreeSantaMessage.css';

export default function FreeSantaMessage() {
  return (
    <main>
      <div className="fsm-hero starry-bg">
        <div className="fsm-hero-content">
          <h1 className="fsm-title gold-text">Santa Radio</h1>
          <h2 className="fsm-sub">Free Personalised Santa Message</h2>
          <p className="fsm-desc">Get a FREE, instantly downloadable personalised message from Santa for your child.</p>
        </div>
      </div>
      <SantaMessageForm />
    </main>
  );
}
