import { Helmet } from 'react-helmet-async';
import './PrivacyPolicy.css';

export default function PrivacyPolicy() {
  return <main className="privacy-page">
    <Helmet>
      <title>Privacy Policy — Santa Radio</title>
      <meta name="description" content="How Santa Radio handles your information, browser preferences and privacy choices." />
      <link rel="canonical" href="https://www.santaradio.co.uk/privacy-policy" />
    </Helmet>
    <article className="privacy-content">
      <p className="eyebrow">Santa Radio</p>
      <h1>Privacy Policy</h1>
      <p className="privacy-date">Updated <time dateTime="2026-10-10">10 October 2026</time></p>
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
      <p>To manage the free-message allowance, local storage remembers only how many messages you have created and when the 30-minute wait ends. This works across visits and tabs in the same browser until cleared; it does not track your identity or IP address. Browsers without tab-lock support also use a temporary, randomly identified request lock in IndexedDB, valid for up to three minutes, to prevent simultaneous message requests. If local storage is unavailable, the allowance is remembered only while the page stays open.</p>
      <p>Hosting services process technical information, such as IP addresses and browser/request details, to deliver and protect the website. Radio playback connects to Citrus3. YouTube supplies video embeds, and Google Fonts supplies fonts. Some images load from our legacy website.</p>
      <p>These services receive connection information and may use cookies or similar technologies under their own privacy notices. The homepage loads a muted YouTube player automatically; song and karaoke pages can also load YouTube embeds automatically.</p>

      <h2>Optional analytics cookies — Google Analytics</h2>
      <p>Only after you accept analytics cookies, we load Google Analytics to understand visits and which pages are used. Google receives page-view information, connection information such as your IP address, browser/device details and cookie identifiers. Google Analytics does not log or store individual IP addresses.</p>
      <p>Our lawful basis is consent. Analytics and Meta marketing have separate choices: accepting one does not require accepting the other. Rejecting either does not stop you browsing, listening or making Santa messages. Our page-view tracking excludes query strings and fragments from page and referrer addresses, and does not send names, email addresses, form contents or message-maker selections. Google advertising signals and advertising personalisation are disabled in our tag.</p>
      <p>If you accept, Google may set first-party cookies such as <code>_ga</code> and <code>_ga_FGL2HBXZ92</code>, configured here to expire after up to 180 days. See <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google’s Privacy Policy</a> for its processing, retention and international-transfer information. Analytics report retention also depends on the settings in our Google Analytics account.</p>
      <p>You can withdraw analytics consent using <strong>Cookie settings</strong> in the footer. This disables further Google Analytics collection on this site and removes accessible Google Analytics cookies. It does not undo information already sent to Google.</p>

      <h2>Optional marketing cookies — Meta Pixel</h2>
      <p>Only after you accept marketing cookies, we load the Meta Pixel to measure page visits and the effectiveness of our Facebook and Instagram adverts, and to help Meta show relevant advertising. Meta can receive visited page addresses, connection information such as your IP address, browser/device details and advertising identifiers. This may link your visit to a Meta account.</p>
      <p>Our lawful basis for this optional advertising tracking is consent. Rejecting it does not stop you browsing, listening or making Santa messages. We send page-view events only; we do not add names, email addresses, message-maker selections or form contents to the pixel, and automatic event detection and advanced matching are not enabled.</p>
      <p>Your choice is remembered in local storage for up to 180 days, then we ask again. If you accept, Meta may set advertising cookies such as <code>_fbp</code> and <code>_fbc</code>. See <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noopener noreferrer">Meta’s Privacy Policy</a> and <a href="https://www.facebook.com/policies/cookies/" target="_blank" rel="noopener noreferrer">Cookie Policy</a> for its processing, retention and international-transfer information.</p>
      <p>You can change your choices or withdraw consent at any time using <strong>Cookie settings</strong> in the footer. Rejecting marketing stops further pixel events and removes accessible Meta advertising cookies from this website; it does not undo information already sent to Meta. Your analytics and marketing choices are remembered for up to 180 days, then we ask again. These choices do not control the separate radio, video or font services described above.</p>

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
