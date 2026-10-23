import { Helmet } from 'react-helmet-async';
import './PrivacyPolicy.css';
import CookiePolicySection from './CookiePolicySection.jsx';

export default function PrivacyPolicy() {
  return <main className="privacy-page">
    <Helmet>
      <title>Privacy Policy — Santa Radio</title>
      <meta name="description" content="Privacy information for the Santa Radio website and Christmas Radio UK app, including browser preferences, app storage and privacy choices." />
      <link rel="canonical" href="https://www.santaradio.co.uk/privacy-policy" />
    </Helmet>
    <article className="privacy-content">
      <p className="eyebrow">Santa Radio</p>
      <h1>Privacy Policy</h1>
        <p className="privacy-date">Updated <time dateTime="2026-10-23">23 October 2026</time></p>
      <p>The Santa Radio website and Christmas Radio UK app are operated by VoiceoverGuy Ltd. For privacy questions, email <a href="mailto:santa@santaradio.co.uk">santa@santaradio.co.uk</a>.</p>
        <p>This notice covers the current Santa Radio website and the Christmas Radio UK native apps for iPhone and iPad, version 35.0, and Android. The app-specific sections below explain how each app handles information. Website-only features, including forms, Santa audio messages, embedded videos and optional analytics or marketing cookies, are separate from the native apps. External services may also have their own privacy notices.</p>
      <p>You can browse and listen without an account. We do not sell personal data.</p>
      <CookiePolicySection />

      <section aria-labelledby="christmas-radio-privacy">
        <h2 id="christmas-radio-privacy">Christmas Radio UK — native iPhone and iPad app, version 35.0</h2>
        <h3>Using the app</h3>
        <p>The app plays the live Christmas Radio stream and displays Now Playing, Up Next and artist artwork. Listening does not require a mandatory account or submission of your name, email address or other contact details.</p>
        <p>Background audio lets listening continue when the app is not on screen. AirPlay and CarPlay provide playback and audio-routing controls on compatible devices. These listening features do not require you to record your voice, take a photograph or upload a selfie, and do not require microphone, camera, contacts, photo-library or location access for radio playback.</p>
        <p>This description applies to Christmas Radio UK version 35.0, not every app carrying the Santa Radio name. Online listening still involves the technical connections described below; it should not be understood as a promise that no data is collected or that all third-party processing has been ruled out.</p>

        <h3>Information stored on your device</h3>
        <p>Optional Snowfall, Blizzard and Festive lights effects can be switched on or off. The app remembers those preferences on your device. It also stores copies of artist artwork and recent song information to reduce downloads and display previously available information when a connection is unavailable. Cached song information is not a recording of the live broadcast.</p>
        <p>The app does not upload these saved preferences or cached copies to us. iOS may remove cached files automatically. Deleting the app, rather than offloading it, removes its local data from that installation. Device settings may also be included in backups managed by Apple; deleting the app does not necessarily remove existing backups.</p>

        <h3>Connections needed for radio playback</h3>
        <p>The app connects over HTTPS to Citrus3, at global.citrus3.com, to receive the live radio stream, and to Santa Radio, at www.santaradio.co.uk, to obtain current and upcoming song information and artist artwork. Vercel hosts the website and its song-information and artwork services.</p>
        <p>These connections necessarily disclose your IP address and normal technical request information to the relevant servers. This can include request times, requested resources, connection duration and device or networking-software information supplied with a request. Stream, metadata and artwork requests may indicate when you listen or which song information and images you request.</p>
        <p>The app does not create an account-based personal listening-history profile. However, the relevant servers or hosting providers may maintain connection logs or listener statistics.</p>

        <h3>Provider processing and retention</h3>
        <p>Vercel and Citrus3 may process technical connection information to deliver their hosting and streaming services, maintain reliability and security, and produce operational or listener statistics. Hosting, access and error logs may be held separately from information cached on your device. Local cache deletion does not control server-log retention.</p>
        <p>Provider log retention periods, processing locations and any international transfers or safeguards depend on the applicable service arrangements. We do not specify a fixed retention period where it has not been confirmed. See <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">Vercel’s Privacy Policy</a> for its general practices, and contact us for information about the arrangements relevant to this service. A provider’s general notice does not necessarily describe every setting on our account.</p>
        <p>Deleting the app does not delete information already retained by these providers. Optional website marketing is separate from native app use and requires the consent described below; using the app does not enrol you in marketing.</p>

        <h3>Opening the website</h3>
        <p>If you open the Santa Radio website from the app, the website’s privacy information and cookie choices apply to that website visit. The website’s Google Analytics and Meta Pixel settings describe website visits, not a blanket statement about native-app SDKs or all third-party processing. Accepting website cookies does not automatically give consent for separate app tracking.</p>

        <h3>Privacy questions and your rights</h3>
        <p>For questions about the app’s handling of information, or to exercise applicable data-protection rights, <a href="mailto:santa@santaradio.co.uk">email us about app privacy</a>. The rights and complaints information elsewhere in this policy also applies to the app.</p>
      </section>

      <section aria-labelledby="android-radio-privacy">
        <h2 id="android-radio-privacy">Christmas Radio UK — Android app</h2>
        <h3>Using the app</h3>
        <p>The app plays the live Christmas Radio stream and displays current and upcoming song information and artist artwork. You can listen without creating an account or providing your name, email address or other contact details.</p>
        <p>The app uses HTTPS connections to receive the radio stream and to request current and upcoming song information and artist artwork from Santa Radio at www.santaradio.co.uk. These requests necessarily disclose your IP address and normal technical request information to the relevant services. This can include request times, requested resources, connection duration and device or networking-software information supplied with a request. Stream, metadata and artwork requests may indicate when you listen or which information and images you request.</p>
        <p>The app does not include advertising or analytics SDKs, and Santa Radio programming is broadcast without adverts. These facts do not mean that no technical information is processed to provide the stream, song information or artwork.</p>

        <h3>Information stored on your device</h3>
        <p>App preferences and cached content are stored on your device and are not uploaded to us. Local storage is separate from technical information that streaming, website or hosting services may receive through your requests. Removing the app does not delete information already retained by those services.</p>

        <h3>Service providers and the Tracker</h3>
        <p>The services needed to provide the stream, song information and artwork may maintain connection logs or listener statistics. Provider-specific retention periods, processing locations and any international transfers or safeguards depend on the applicable service arrangements. We do not specify a fixed retention period where it has not been confirmed. Contact us for information about arrangements relevant to this service.</p>
        <p>The Tracker is optional and opens in your external browser. The website’s privacy information and cookie choices apply to that visit. External services may also have their own privacy notices. Using the app does not enrol you in marketing.</p>
        <p>The app is intended for listeners of all ages. This describes its intended audience and is not a claim of compliance with children’s privacy laws or Google Play Families requirements.</p>

        <h3>Privacy questions and your rights</h3>
        <p>For questions about the app’s handling of information, or to exercise applicable data-protection rights, <a href="mailto:santa@santaradio.co.uk">email us about app privacy</a>. The rights and complaints information elsewhere in this policy also applies to the app.</p>
      </section>

      <h2>Other Santa Radio and tvOS apps</h2>
      <p>Older Santa Radio iPhone or iPad apps, older Android app versions, tvOS apps and other linked apps may have different features, permissions and data practices. The descriptions above must not be applied to them automatically. In particular, they are not claims that no Santa Radio app has ever used a microphone, camera, photo library, selfies or voice-message recordings.</p>
      <p>Check the privacy information and permission prompts for the particular app and version you use. If an older app links to this page and you need information about a feature not described here, contact us with its name, version and platform. Device settings let you review permissions, but withdrawing permission does not erase recordings or information already submitted to a service.</p>

      <h2>When you contact us</h2>
      <p>Our <a href="/submit-a-song">shared contact form</a> lets you choose General enquiry or Song submission. Both collect your first name, surname, email address and a message of up to 500 characters, sent directly to the same dedicated Brevo form to handle your enquiry or consider your recording. If you email us instead, you share your email address and whatever you include. Our lawful basis is legitimate interests: running the station and handling messages people choose to send us, while respecting their privacy.</p>
      <p>Please have a parent or carer handle enquiries involving children and share only necessary details.</p>

      <h2>Song submissions</h2>
      <p>Choose <a href="/submit-a-song?mode=song">Song submission on the shared contact form</a> and include an artist name, song title, listening link, short bio or description and a link to any promotion of Santa Radio in your message. A required checkbox confirms that you have met these criteria; it is not consent for marketing and is not sent as a separate Brevo attribute. General enquiries do not require these song criteria.</p>
      <p>Both enquiry types are separate from the Santa-message access form and do not open the message maker or give consent for marketing. Explicit Brevo acceptance confirms only that the provider accepted the form, not verified delivery to our inbox, an individual reply or, for songs, airplay. We have not specified unconfirmed Brevo account settings, automatic emails or fixed provider retention periods. For Brevo’s general processing practices, see <a href="https://www.brevo.com/legal/privacypolicy/" target="_blank" rel="noopener noreferrer">Brevo’s Privacy Policy</a>; contact us about the arrangements for your enquiry or submission, or a deletion request.</p>

      <h2>Free Santa audio messages</h2>
      <p>An adult or parent provides their first name, surname and email address through a Brevo form to access our personalised Santa audio message maker. These details are sent to Brevo for message access; they are not sent to the audio generator. Access opens when Brevo accepts the form, not when email ownership or any double opt-in is verified.</p>
      <p>You then choose a child’s first name from the available prerecorded clips. That selection is sent to our message generator to mix the greeting. This is a personalised MP3 assembled from existing recordings, not a microphone recording made by you or your child. You can listen to and download the MP3 on this website; we do not email the generated recording. The generator removes its temporary working copy when the request finishes; copies you download remain under your control.</p>
      <p>Requesting a free Santa message does not give consent for Santa Radio news or tracker reminders. Contact us if you have questions about the contact details submitted for message access.</p>

      <h2>Optional Santa Radio news</h2>
      <p>News signup is not yet available here. When offered, you can voluntarily leave your email specifically to receive Santa Radio news and information. This will rely on your consent, not on sending an enquiry or song submission. We will use an email delivery provider; none has been selected yet.</p>
      <p>We will keep subscription details until you unsubscribe. You can withdraw consent at any time by unsubscribing or emailing us. We may keep a minimal suppression record to respect your opt-out.</p>

      <h2>Using the website</h2>
      <p>The current website does not offer microphone recording, camera capture or selfie-upload features. Images and feature descriptions on the Apps page are not requests for access to your device. This statement is about the website, not the permissions or recording features of separate apps.</p>
      <h2>Requests for missing Santa names</h2>
      <p>If you choose “Request this name”, we save the requested first name, request dates and a request count in a private database so approved Santa Radio staff can review which recordings listeners would like. We do not attach your adult contact details or email address to the request, and this does not sign you up for marketing or promise that a recording will be made.</p>
      <p>A necessary request-control cookie lasts up to seven days. Short-lived, randomly identified technical records help prevent repeated requests being counted twice and limit excessive submissions. These records stop being used after at most seven days and are removed during subsequent request processing. The requested-name list is kept while needed to review and plan recordings. Only authorised staff can view it. Staff sign-in is provided by Clerk, which processes staff account details and authentication cookies under <a href="https://clerk.com/legal/privacy" target="_blank" rel="noopener noreferrer">its privacy notice</a>. Visitors do not need a Clerk account to request a name.</p>
      <p>Hosting services, including Vercel, process technical information such as IP addresses and browser/request details to deliver and protect the website. Radio playback connects to Citrus3. YouTube supplies video embeds, Google Fonts supplies fonts, and Brevo processes general enquiries and song submissions and, separately, adult details submitted for message access. Some images load from our legacy website. Each recipient may receive technical connection information when its resource is requested, even without an account or optional analytics cookies.</p>
      <p>The homepage YouTube TV loads automatically on a first visit after saved preferences are checked,
        and may involve provider cookies, analytics and advertising before you choose. It respects saved
        refusals and can be turned off in Cookie settings. Other YouTube and TuneIn embeds wait for
        external-media permission as described above. Automatic TV loading does not grant consent for
        site analytics, marketing or other media, and turning it off cannot erase data already sent or third-party cookies.
        Ordinary hosting, live-radio and requested-feature connections still disclose technical request
        information even when optional cookies are declined.</p>

      <h2>Links and external services</h2>
      <p>Links to app stores, social networks, music platforms and personalised video services take you to separate services with their own privacy notices. Check those notices before sharing information. An email link opens your chosen email service; it does not submit a form on this website.</p>

      <h2>Editorial content and retention</h2>
      <p>We publish artist and celebrity photos and biographies for the station’s editorial features, relying on legitimate interests. Contact us about accuracy, privacy or removal concerns.</p>
      <p>We keep enquiries and submissions only as long as needed to handle them, follow up or resolve relevant issues. Editorial material may remain while relevant; we review concerns and remove or correct content where appropriate. Legal obligations or disputes may require longer retention. Brevo contact records, provider logs and listener statistics have separate retention arrangements; removal of a temporary MP3 or local app cache does not remove those records. Contact us about retention or a deletion request for information you have submitted.</p>

      <h2>Your choices and rights</h2>
      <p>Depending on the circumstances, you can request access, correction, deletion, restriction or portability of your information, and object to processing based on legitimate interests. Withdrawing consent does not affect earlier lawful processing. Email us to exercise your rights. You can also complain to the UK Information Commissioner’s Office at <a href="https://ico.org.uk/make-a-complaint/">ico.org.uk</a>.</p>
      <p>These rights apply to relevant website and app information, subject to the conditions and exemptions in data-protection law. You may be asked for proportionate information to verify your identity and identify the records concerned. We normally respond within one month; if a lawful extension is needed, we will explain it. Where a third party acts as a separate controller, you may also need to contact that provider.</p>
    </article>
  </main>;
}
