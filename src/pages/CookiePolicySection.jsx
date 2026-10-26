import { openCookieSettings } from '../privacy/cookieConsent.js';

export default function CookiePolicySection() {
  return <section className="cookie-policy-summary" aria-labelledby="cookie-overview">
    <h2 id="cookie-overview">Cookies: the short version</h2>
    <p>Necessary storage keeps your choices and requested features working. Optional Google Analytics helps us
      understand visits; Meta measures adverts and helps show relevant advertising. The homepage TV loads
      YouTube automatically on a first visit, after checking saved preferences. YouTube may use cookies and
      device information for playback, analytics and advertising before you make a choice. Other YouTube
      videos and the optional TuneIn player stay off until you allow external media.</p>
    <p>You can decline optional cookies and still browse, listen to our live radio and access Santa messages,
      subject to the separate adult-access and message-allowance requirements. Accept all allows analytics,
      marketing and external media; settings lets you choose them separately. We remember acceptance and refusal
      equally for up to 180 days, rather than asking on every page.</p>
    <button type="button" className="cookie-settings-link" onClick={openCookieSettings}>Cookie settings</button>

    <details className="cookie-details">
      <summary>Necessary storage and requested preferences</summary>
      <p>We store your cookie choices in local storage for up to 180 days. This is a preference record, not an
        analytics cookie. If your browser cannot save it, the choice applies while this page remains open and
        during navigation within it; we show a notice, and a reload or later visit may ask again.</p>
      <p>Your browser remembers your snow preference in local storage and the minimised player setting in session
        storage. The snow preference remains until changed or cleared; the player preference normally ends with
        the tab session. You can clear these through browser settings.</p>
      <p>The recording studio also remembers a non-sensitive access flag in session storage for the current tab
        session. Your adult names and email address are not stored in browser storage or added to page addresses.
        If session storage is unavailable, access lasts while you browse in the tab but refreshing may ask you
        to submit again.</p>
      <p>To manage the free-message allowance, local storage remembers only how many messages you have created and
        when the 10-minute wait ends. This works across visits and tabs in the same browser until cleared; it
        does not track your identity or IP address. Browsers without tab-lock support also use a temporary,
        randomly identified request lock in IndexedDB, valid for up to three minutes, to prevent simultaneous
        message requests. If local storage is unavailable, the allowance is remembered only while the page stays open.</p>
      <p>Missing-name requests use a necessary request-control cookie for up to seven days, as explained below.
        Requested-name retry tokens and the rotating example message use session storage; staff sign-in uses
        authentication cookies. Declining optional cookies does not disable these controls or requested preferences.</p>
    </details>

    <details className="cookie-details">
      <summary>Analytics — Google Analytics</summary>
      <p>Only with analytics consent, we load Google Analytics to measure visits and pages used. Google receives
        page-view information, cookie identifiers and technical connection information, such as IP address and
        browser/device details. Our tag excludes query strings and fragments from page and referrer addresses;
        it does not send names, email addresses, form contents or message-maker selections. Google advertising
        signals and advertising personalisation are disabled.</p>
      <p>First-party cookies such as <code>_ga</code> and <code>_ga_FGL2HBXZ92</code> are configured here to expire
        after up to 180 days, without extending their life on each visit. Analytics report retention depends on
        our Google Analytics account settings; cookie expiry is not the same as deletion of Google's records.</p>
      <p>Our lawful basis is consent. See <a href="https://policies.google.com/privacy" target="_blank"
        rel="noopener noreferrer">Google’s Privacy Policy</a> for processing and international-transfer information.</p>
    </details>

    <details className="cookie-details">
      <summary>Marketing — Meta Pixel</summary>
      <p>Only with marketing consent, we load Meta Pixel to measure page visits and the effectiveness of our
        Facebook and Instagram adverts, and to help show relevant advertising. Meta can receive visited page
        addresses, cookie identifiers and connection/browser information, including IP address, and may link
        this to a Meta account.</p>
      <p>We send page-view events only: no names, email addresses, message-maker selections or form contents are
        added to the pixel, and automatic event detection and advanced matching are not enabled. Our lawful
        basis is consent, separate from analytics, news signup and Santa-message access.</p>
      <p>Meta may set first-party advertising cookies such as <code>_fbp</code> and <code>_fbc</code>. Meta controls
        their lifetimes and its own retention; these are separate from our 180-day choice record.
        See <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noopener noreferrer">Meta’s
        Privacy Policy</a> and <a href="https://www.facebook.com/policies/cookies/" target="_blank"
        rel="noopener noreferrer">Cookie Policy</a> for processing, cookie durations and international-transfer information.</p>
    </details>

    <details className="cookie-details">
      <summary>External media — YouTube and TuneIn</summary>
      <p>The homepage live TV is an exception: it loads YouTube automatically when no saved preference exists,
        without recording consent or enabling our Google Analytics, Meta, song videos or TuneIn.
        Saved refusals and older preferences without media permission keep it off. Decline optional cookies
        or save External media unchecked to unload it, including in other open tabs. Expired or damaged
        preferences keep it off until you choose again; clearing browser storage can restore the first-visit default.</p>
      <p>Other YouTube videos and the optional TuneIn embed wait until you allow external media in the banner,
        settings or an informed content placeholder. Enabling this category allows both providers, without
        changing your analytics or marketing choices. TuneIn also has its own load/unload control. Older saved
        analytics or Meta choices do not automatically enable this category.</p>
      <p>When loaded, including automatically on the homepage, these services receive technical connection information and may use cookies or similar
        storage, for playback, measurement, personalisation or advertising under their own policies. YouTube
        may use session cookies such as <code>YSC</code> and persistent visitor cookies; provider cookies can
        outlast our media permission or the tab. Their lifetimes depend on the provider, account and browser
        settings, not our 180-day preference record.</p>
      <p>See <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google/YouTube’s
        Privacy Policy</a>, <a href="https://policies.google.com/technologies/cookies" target="_blank"
        rel="noopener noreferrer">Google’s cookie information</a> and <a href="https://tunein.com/policies/privacy/"
        target="_blank" rel="noopener noreferrer">TuneIn’s Privacy Policy</a>.
        Choosing an external “Open on” link visits that provider directly under its own privacy controls.
        Our main live radio does not require external-media consent.</p>
    </details>

    <details className="cookie-details">
      <summary>Changing your mind and what withdrawal does</summary>
      <p>Use Cookie settings here or in the footer on every page. Save individual choices, or select Decline
        optional cookies to turn all optional categories off in one click. This stops subsequent analytics
        and pixel events here and unloads optional media embeds, including in other open tabs.</p>
      <p>We remove accessible first-party Google Analytics and Meta advertising cookies where possible.
        We cannot remove cookies held on another provider's domain, undo information already sent or erase
        provider records by changing this setting. Use browser controls or the provider's privacy tools for
        those cookies and records. Necessary storage and ordinary connections needed to deliver requested
        features still work; declining is not a promise of no storage or no server logs.</p>
    </details>
  </section>;
}
