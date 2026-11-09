import { Link } from 'react-router-dom';
import SantaTrackerPrivacyContent from './SantaTrackerPrivacyContent.jsx';
import './PrivacyPolicy.css';

export default function SantaTrackerPrivacy() {
  return <main className="privacy-page">
    <article className="privacy-content" aria-labelledby="tracker-privacy-heading">
      <p className="eyebrow">Santa Radio · Native iOS app</p>
      <h1 id="tracker-privacy-heading">The Santa Tracker privacy policy</h1>
      <SantaTrackerPrivacyContent />

      <p><Link to="/santa-tracker">Back to the Santa Tracker web page</Link></p>
    </article>
  </main>;
}
