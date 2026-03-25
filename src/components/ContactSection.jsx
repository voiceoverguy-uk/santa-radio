import './ContactSection.css';

export default function ContactSection() {
  return (
    <section className="contact-section">
      <div className="container">
        <h2 className="contact-title">Contact Santa Radio</h2>
        <p className="contact-sub">
          For Press or Corporate, feedback and suggestions, get in touch.
        </p>
        <a
          href="mailto:santa@santaradio.co.uk?subject=Contact%20Santa%20Radio&body=How%20can%20we%20help?"
          className="contact-btn btn-red"
        >
          Send Email
        </a>
      </div>
    </section>
  );
}
