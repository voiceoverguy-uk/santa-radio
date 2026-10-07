import { Helmet } from 'react-helmet-async';
import './PrivacyPolicy.css';

export default function PrivacyPolicy() {
  return <main className="privacy-page">
    <Helmet>
      <title>Privacy Policy — Santa Radio</title>
      <meta name="description" content="How Santa Radio handles your information, browser preferences and privacy choices." />
      <link rel="canonical" href="https://santa-radio.replit.app/privacy-policy" />
    </Helmet>
    <article className="privacy-content">
      <p className="eyebrow">Santa Radio</p>
      <h1>Privacy Policy</h1>
      <p className="privacy-date">Added <time dateTime="2026-10-07">7 October 2026</time></p>
      <p>Santa Radio is operated by VoiceoverGuy Ltd. For privacy questions, email <a href="mailto:santa@santaradio.co.uk">santa@santaradio.co.uk</a>.</p>
      <p>This notice covers this rebuilt website, not separate apps or linked services. You can browse and listen without an account. We do not sell personal data.</p>

      <h2>When you contact us</h2>
      <p>Email enquiries and song submissions share your email address and whatever you include, such as an artist name, song title, link or biography. We use this information to respond or consider submissions for airplay. Our lawful basis is legitimate interests: running the station and handling messages people choose to send us, while respecting their privacy.</p>
      <p>Please have a parent or carer handle enquiries involving children and share only necessary details.</p>

      <h2>Free Santa audio messages</h2>
      <p>An adult or parent provides their first name, surname and email address through a Brevo form to access our personalised Santa audio message maker. These details are sent to Brevo for message access; they are not sent to the audio generator. Access opens when Brevo accepts the form, not when email ownership or any double opt-in is verified.</p>
      <p>You then choose a child’s recorded first name. That selection is sent to our message generator to mix the greeting. You can listen to and download the MP3 on this website; we do not email the generated recording. The temporary server copy is removed after it is sent to your browser.</p>
      <p>Requesting a free Santa message does not give consent for Santa Radio news or tracker reminders. Contact us if you have questions about the contact details submitted for message access.</p>

      <h2>Optional Santa Radio news</h2>
      <p>News signup is not yet available here. When offered, you can voluntarily leave your email specifically to receive Santa Radio news and information. This will rely on your consent, not on sending an enquiry or song submission. We will use an email delivery provider; none has been selected yet.</p>
      <p>We will keep subscription details until you unsubscribe. You can withdraw consent at any time by unsubscribing or emailing us. We may keep a minimal suppression record to respect your opt-out.</p>

      <h2>Using the website</h2>
      <p>Your browser remembers your snow preference in local storage and the minimised player setting in session storage. The snow preference remains until changed or cleared; the player preference normally ends with the tab session. You can clear these through browser settings.</p>
      <p>The message desk also remembers a non-sensitive access flag in session storage for the current tab session. Your adult names and email address are not stored in browser storage or added to page addresses. If session storage is unavailable, access lasts while you browse in the tab but refreshing may ask you to submit again.</p>
      <p>Hosting services process technical information, such as IP addresses and browser/request details, to deliver and protect the website. Radio playback connects to Citrus3. YouTube supplies video embeds, and Google Fonts supplies fonts. Some images load from our legacy website.</p>
      <p>These services receive connection information and may use cookies or similar technologies under their own privacy notices. The homepage loads a muted YouTube player automatically; song and karaoke pages can also load YouTube embeds automatically.</p>

      <h2>Links and external services</h2>
      <p>Links to app stores, social networks, music platforms and personalised video services take you to separate services with their own privacy notices. Check those notices before sharing information. An email link opens your chosen email service; it does not submit a form on this website.</p>

      <h2>Editorial content and retention</h2>
      <p>We publish artist and celebrity photos and biographies for the station’s editorial features, relying on legitimate interests. Contact us about accuracy, privacy or removal concerns.</p>
      <p>We keep enquiries and submissions only as long as needed to handle them, follow up or resolve relevant issues. Editorial material may remain while relevant; we review concerns and remove or correct content where appropriate. Legal obligations or disputes may require longer retention. Service providers have their own retention arrangements.</p>

      <h2>Your choices and rights</h2>
      <p>Depending on the circumstances, you can request access, correction, deletion, restriction or portability of your information, and object to processing based on legitimate interests. Withdrawing consent does not affect earlier lawful processing. Email us to exercise your rights. You can also complain to the UK Information Commissioner’s Office at <a href="https://ico.org.uk/make-a-complaint/">ico.org.uk</a>.</p>
    </article>
  </main>;
}
