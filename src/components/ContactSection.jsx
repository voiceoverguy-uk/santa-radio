import './ContactSection.css';
import SantaNote from './SantaNote.jsx';
import { Link } from 'react-router-dom';
import HomepageSectionHeading from './HomepageSectionHeading.jsx';

export default function ContactSection() {
  return (
    <section className="contact-section" aria-labelledby="contact-title">
      <div className="contact-scene">
        <div className="contact-letter" aria-hidden="true" />
        <div className="contact-panel">
          <div className="contact-copy">
            <HomepageSectionHeading
              eyebrow="THE NORTH POLE POST ROOM"
              title="We’d love to hear from you"
              subtitle={<>Got a question, a festive idea or something to share?{' '}<br />Get in touch with the Santa Radio team.</>}
              titleId="contact-title"
              className="contact-heading"
              eyebrowClassName="contact-eyebrow"
              titleClassName="contact-title"
              subtitleClassName="contact-intro"
            />
            <p className="contact-sub">Press, partnerships, feedback and suggestions welcome.</p>
            <Link to="/submit-a-song" className="contact-btn">
              <span>Get in touch</span><span aria-hidden="true" className="contact-arrow">→</span>
            </Link>
            <div className="contact-song">
              <span className="contact-rule" aria-hidden="true"><i>✦</i></span>
              <p>Made a Christmas song?</p>
              <Link to="/submit-a-song?mode=song">Submit it for consideration <span aria-hidden="true">→</span></Link>
            </div>
          </div>
        </div>
      </div>
      <div className="contact-santa-note">
        <div className="santa-note-label"><span aria-hidden="true">✦</span> A NOTE FROM SANTA</div>
        <SantaNote />
        <span className="santa-note-signature" aria-label="Signed, Santa">Santa</span>
      </div>
    </section>
  );
}
