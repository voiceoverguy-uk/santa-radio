import './ContactSection.css';
import SantaNote from './SantaNote.jsx';

export default function ContactSection() {
  return (
    <section className="contact-section">
      <div className="container">
        <h2 className="contact-title">Contact Santa Radio</h2>
        <p className="contact-sub">
          For Press or Corporate, feedback and suggestions, get in touch.
        </p>
        <a
          href="mailto:santa@santaradio.co.uk?subject=Enquiry%20from%20Santa%20Radio"
          className="contact-btn btn-red"
        >
          Send Email
        </a>
        <div className="contact-santa-note">
          <SantaNote />
        </div>
      </div>
    </section>
  );
}
