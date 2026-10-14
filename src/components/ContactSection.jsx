import './ContactSection.css';
import SantaNote from './SantaNote.jsx';

export default function ContactSection() {
  return (
    <section className="contact-section">
      <div className="container">
        <h2 className="contact-title">Contact Santa Radio</h2>
        <p className="contact-sub">
          For press and corporate enquiries, feedback or suggestions, please get in touch.
        </p>
        <p className="contact-sub">
          <strong>Submitting a song?</strong> Please use <strong>“Submit your song” in the footer</strong>, not the email button.
        </p>
        <a
          href="mailto:santa@santaradio.co.uk?subject=Enquiry%20from%20Santa%20Radio"
          className="contact-btn btn-red"
        >
          Email for general enquiries
        </a>
        <div className="contact-santa-note">
          <SantaNote />
        </div>
      </div>
    </section>
  );
}
