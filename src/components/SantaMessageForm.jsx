import { useState } from 'react';
import './SantaMessageForm.css';

export default function SantaMessageForm() {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '' });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.firstName || !form.email) {
      setError('Please fill in all required fields.');
      return;
    }
    setError('');
    setSubmitted(true);
  };

  return (
    <section className="santa-message-section">
      <div className="container">
        <h2 className="santa-message-heading gold-text">FREE Personalised Santa Message</h2>

        <div className="santa-message-box">
          {submitted ? (
            <div className="success-message">
              <span className="success-icon">🎅</span>
              <h3>Thank you, Santa is waiting with your message!</h3>
              <p>Check your email for your personalised message from Father Christmas.</p>
            </div>
          ) : (
            <>
              {error && <div className="form-error">{error}</div>}
              <p className="form-desc">
                Want to make Christmas magical? Get a FREE, instantly downloadable personalised
                message from Santa for your child. No waiting.
              </p>

              <div className="audio-example">
                <p>🎧 Hear an example of your free custom Santa message:</p>
                <audio controls preload="none" style={{ width: '100%', marginTop: 8 }}>
                  <source src="https://www.santaradio.co.uk/audio/santa-message-example.mp3" type="audio/mpeg" />
                  Your browser does not support the audio element.
                </audio>
              </div>

              <form onSubmit={handleSubmit} className="santa-form">
                <input
                  type="text"
                  name="firstName"
                  placeholder="FIRSTNAME"
                  value={form.firstName}
                  onChange={handleChange}
                  required
                />
                <input
                  type="text"
                  name="lastName"
                  placeholder="LASTNAME"
                  value={form.lastName}
                  onChange={handleChange}
                />
                <input
                  type="email"
                  name="email"
                  placeholder="EMAIL"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
                <button type="submit" className="btn-gold form-submit">
                  GET YOUR FREE SANTA MESSAGE NOW
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
