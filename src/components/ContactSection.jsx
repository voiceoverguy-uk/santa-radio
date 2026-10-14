import './ContactSection.css';
import SantaNote from './SantaNote.jsx';
import { Link } from 'react-router-dom';

export default function ContactSection() {
  return (
    <section className="contact-section">
      <div className="container">
        <h2 className="contact-title">Contact Santa Radio</h2>
        <p className="contact-sub">
          For press and corporate enquiries, feedback or suggestions, please get in touch.
        </p>
        <p className="contact-sub">
          You can also choose Song submission on our contact form to send a Christmas recording for consideration.
        </p>
        <Link
          to="/submit-a-song"
          className="contact-btn btn-red"
        >
          Get in touch
        </Link>
        <div className="contact-santa-note">
          <SantaNote />
        </div>
      </div>
    </section>
  );
}
