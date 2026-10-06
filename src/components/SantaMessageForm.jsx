import { Link } from 'react-router-dom';
import './SantaMessageForm.css';

export default function SantaMessageForm() {
  return <section className="santa-message-section" id="santa-messages">
    <div className="container message-layout">
      <div className="message-intro"><p className="eyebrow">A message to remember</p><h2 className="santa-message-heading">A little hello<br />from Santa himself</h2><p>Explore personalised Santa messages for the little people who make Christmas so special.</p><Link to="/free-santa-message" className="message-detail-link">About free Santa messages <span aria-hidden="true">→</span></Link></div>
      <div className="santa-message-box">
        <span className="message-seal" aria-hidden="true">S</span>
        <h3>Free personalised Santa message</h3>
        <p className="form-desc">Our message request service is not connected on this website yet. We cannot generate, download or email a personalised message here.</p>
        <p className="service-notice">No details are collected or sent. Please contact Santa Radio for current availability.</p>
        <a className="btn-red" href="mailto:santa@santaradio.co.uk?subject=Santa%20message%20availability">Ask about Santa messages <span aria-hidden="true">↗</span></a>
      </div>
    </div>
  </section>;
}
