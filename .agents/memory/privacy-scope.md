---
name: Privacy scope
description: Owner-approved website and native-app privacy scope and consent boundaries.
---
The owner wants a simple, concise policy with minimal company details. It now also covers Christmas Radio UK for iPhone and iPad, but this does not establish coverage of the separate Santa Radio native app.

The cookie experience should offer an immediate, equally prominent accept-or-decline choice, with settings optional rather than compulsory.

**Why:** The owner says: “We are a fun radio station and don't want to put people off.”

**How to apply:** Keep first-layer wording concise and friendly, put detailed explanations in optional layers, and preserve independent choices, withdrawal and radio access rather than simplifying by removing real controls.

The owner confirmed the supplied Christmas Radio UK privacy draft accurately describes that separate project's native app: no tracking/advertising SDKs or sensitive permissions; visual preferences, artwork and recent song information stay on the device. Website marketing must remain separate from native app use.

**Why:** The owner confirmed the other project's app description when authorising the shared policy update; this workspace does not contain the native source.

**How to apply:** Treat these as owner-confirmed product facts, not evidence of an iOS code audit. Do not equate local caching with server-side data collection or assume that providers retain no logs. Vercel hosting was confirmed, but provider log retention, lawful bases and transfer safeguards still require verification before a compliance-complete notice or App Store disclosure.

The owner’s Santa Radio for Android version 35.0 facts are release-specific confirmations, not findings from an Android source or signed-build audit in this website workspace.

**Why:** The owner provided corrected release facts, explicitly replacing the earlier external-browser-only Tracker description and the old feed/artwork destination assumptions.

**How to apply:** Use the Android release disclosures in the policy as owner-confirmed product facts, not proof that this repo audits native permissions, backup rules, motion handling or shipped WebView traffic. The owner does not know actual station/feed logging arrangements, retention periods, processing locations or transfer safeguards; do not replace those unknowns with generic provider assumptions.

Keep the Android correction on the existing website privacy-policy destination and preserve its direct Android section anchor.

**Why:** The owner explicitly said the Android app already links to the main policy page and asked for a correction there, not a separate site or policy destination.

**How to apply:** Use the existing Vercel publication route, not a new Replit deployment. Policy wording does not establish child-privacy certification or compliance: that review remains open, and this web-only work does not authorise native-app changes or release actions.

Future news signup must be voluntary and specifically for Santa Radio news/information, with subscriptions kept until unsubscribe. No marketing provider has been selected; Mailchimp was only an example.

**Why:** These are explicit owner instructions, not evidence that signup or a delivery provider is implemented.

**How to apply:** Do not infer marketing consent from enquiries or song submissions. Confirm the provider and data-handling arrangements before implementing signup or changing its notice.

Google Analytics and Meta advertising tracking require separate, explicit analytics and marketing choices; rejection must leave the website usable, and visitors must be able to change their choices later. Earlier Meta consent must not be treated as Google Analytics consent.

**Why:** The owner approved consent-gated Meta tracking, then explicitly approved adding Google Analytics with independent Analytics and Marketing cookie controls as better practice.

**How to apply:** Preserve independent opt-in and withdrawal controls when changing tracking. These choices are separate from news subscriptions and Santa message access; do not add an unconditional tracking script or no-JavaScript tracking image.

The Santa Tracker and all its subroutes must be analytics- and marketing-free for everyone, regardless of cookie consent, saved preferences, or internal navigation.

**Why:** The owner explicitly authorised this broader exception to protect the existing released Android app, which loads an unmarked tracker URL and cannot yet be identified reliably. This replaces the earlier app-only scope, not the consent rules for other website pages.

**How to apply:** Do not require a URL marker or infer native-app identity from storage restrictions or a synthetic WebView user agent. Keep the tracker exception active after entering from an already-tracked page; suppress late third-party telemetry without reloading or interrupting the shared radio. Preserve consent-based tracking elsewhere. Website changes must reach the existing Vercel deployment before claiming protection for the released app; do not publish unrelated pending work.

Partnership enquiry analytics measures opening the homepage invitation, not a submitted or accepted enquiry.

**Why:** The requested scope explicitly preserves the existing general enquiry workflow and excludes contact details and free-form messages from tracking.

**How to apply:** Report invitation activations as opens, not completed enquiries. Do not add form attribution or submission tracking without a separate request.

Use the site's existing Google Analytics integration for consent-gated custom events; analytics access authorisation alone does not prove that a Replit-hosted tracker exists on the published site.

**Why:** This site's hosting and existing consent setup must remain functional without assuming an injected tracker. A test-only replacement tracker can make event tests pass while the published app sends nothing.

**How to apply:** Inspect the actual provider and test its real command queue, stubbing only network loading or deliberate failure cases. Do not introduce a second analytics provider just for custom events.

The owner confirmed Google Analytics Enhanced Measurement is switched off for the Santa Radio web stream, with a screenshot of the account setting.

**Why:** The site sends its own navigation page views; Enhanced Measurement can independently send history-based views and automatic interaction events.

**How to apply:** Keep this account-side setting off while using manual page views. Do not ask the owner to repeat the setup unless there is evidence that the setting changed.

## Cookie experience and embedded providers

Cookie-only preference persistence does not emit browser `storage` events. Normal cross-tab consent tests therefore do not establish withdrawal behaviour when local storage is blocked.

**Why:** A repeated mobile cookie-banner report prompted a preference-cookie fallback; the existing happy-path refresh and cross-tab checks used working local storage.

**How to apply:** Include restricted-storage, cookie-only browser contexts when verifying consent changes across tabs. Keep choices fail-closed when saved records are damaged or expired, and do not claim the reporting iPhone's exact storage restriction was confirmed without testing that device.

Keep the first cookie choice compact, with optional details rather than compulsory settings.

**Why:** The owner says: “We are a fun radio station and don't want to put people off.”

**How to apply:** Preserve one-click accept and decline, equal treatment of saved acceptance and refusal, and uninterrupted core radio and separate Santa-message access.

Media permission is not a promise that embedded providers are tracking-free when this site's analytics and marketing are off.

**Why:** A real browser check showed YouTube contacting DoubleClick and setting its own cookies after media-only permission, with this site's Google Analytics and Meta still disabled. Third-party cookies remained after unloading the iframe because the site cannot delete another domain's cookies.

**How to apply:** Clearly disclose embedded providers' own analytics and advertising in the media choice. Do not infer media permission from older tracker choices or promise that withdrawal erases third-party storage or already-sent data.
