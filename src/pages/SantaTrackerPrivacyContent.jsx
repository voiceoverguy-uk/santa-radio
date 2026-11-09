import { Link } from 'react-router-dom';

// Keep the standalone URL and the main policy's app section in agreement.
export default function SantaTrackerPrivacyContent({ embedded = false }) {
  const Heading = embedded ? 'h3' : 'h2';
  return <>
    <p>{embedded ? 'This section' : 'This policy'} covers <strong>The Santa Tracker by Santa Radio</strong> for iOS. It describes the native app’s tracker, not the Santa Radio website, the web-based tracker or other Santa Radio apps.</p>

    <Heading>Tracking Santa, not you</Heading>
    <p>The tracker is bundled inside the app. It calculates the countdown, sleigh position and route estimates on your device. These are make-believe journey estimates, not GPS tracking.</p>
    <p>You do not need an account or GPS to use the tracker. The native tracker does not send your tracker activity to Santa Radio.</p>

    <Heading>Analytics, advertising and tracking</Heading>
    <p>The current native tracker code has no analytics, advertising or tracking SDK. The tracker does not send Santa Radio reports about how you use it.</p>

    <Heading>Settings stored on your device</Heading>
    <p>The app can save preview settings locally on your device. This is device storage, not collection of those settings by Santa Radio. The native tracker does not transmit these settings to Santa Radio.</p>
    <p>There is no Santa Radio account or server-side tracker activity profile to delete. If you need help with local settings, please use the contact link below.</p>

    <Heading>Links to the Santa Radio website</Heading>
    <p>If you choose a Santa Radio website link in the app, it opens in your device’s browser. Visiting the website is separate from using the bundled native tracker.</p>
    <p>The website has its own practices and privacy choices, explained in the <Link to={embedded ? '/privacy-policy#cookie-overview' : '/privacy-policy'}>{embedded ? 'website and cookies section of this policy' : 'Santa Radio website privacy policy'}</Link>. The native app statements above do not describe information handled when you visit the website or choose to contact us there. This policy page is itself hosted on that website.</p>

    <Heading>Privacy questions and support</Heading>
    <p>Use the <Link to="/submit-a-song?mode=general">Santa Radio general enquiry contact form</Link> for privacy questions or app support. Please mention “The Santa Tracker for iOS” so we can identify the app. You do not need to send tracker settings or location information to ask a question.</p>
  </>;
}
