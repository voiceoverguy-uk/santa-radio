# Christmas Contenders preview

`/christmas-contenders` is demo-first. Bob is permanently demo-only. The supplied PNG and MP3 are copied unchanged into the site's public static assets.

The owner-supplied genuine (`live` mode) contenders can be browsed and shared, but neither demo ballots nor real ballots can be cast for them while this preview is isolated. Adding a genuine recording does not enable real voting.

## Storage readiness

The focused schema is `database/christmas-contenders.sql`. Apply only to a separately confirmed non-production PostgreSQL target, for example `node scripts/setup-contenders.mjs --confirmed-development-target` after checking the connection target. Never add this command to startup, build or deploy. Requests perform no DDL. Missing schema, database or signing produces an unavailable API response, not memory-only vote totals. For public GETs only, the page can still show the eight approved genuine recordings from the source-backed catalogue in `src/lib/contenders.js`; counts stay unknown, and all voting remains disabled. The catalogue test checks that this list matches the approved live IDs seeded by the SQL file. This fallback does not establish production database readiness or replace database-backed ballot storage.

Staff use the competition section beneath the existing `/request-names` ledger. Both reads and changes require the same verified primary admin email policy on the server. Settings control dates, demo availability and the optional submission cutoff. ISO timestamps must include their timezone; the public page displays Europe/London time. The submission cutoff starts unset and must be chosen by the owner; a configured cutoff is displayed as guidance (submissions remain manually reviewed).

Public entries show artist and song title only, alongside artwork and controls. No descriptions, promotional text, tooltips or expandable biographies are published. There is no public-description input in management. Existing stored descriptions stay private and are not overwritten or cleared by entry edits; screening materials/lyrics remain unchanged. The listening page uses compact rows and a single shared ballot, rather than a form per recording.

Run `node scripts/prepare-contender-waveforms.mjs` after adding or replacing local contender MP3s, before building. This decodes the actual supplied audio offline, caches 360 normalized peaks in content-hashed JSON files and updates the source-URL catalogue. Commit the small peak files/catalogue with the entry. The public API attaches matching waveform metadata without changing database schema. Listing fetches only small peak files; the player loads audio on explicit playback or seeking, not to draw waveforms. Unknown/unprepared media shows an honest waveform-unavailable notice, not invented peaks. Remote recordings need an approved local static copy and this preparation step before their waveform can appear.

## Ballots and privacy

Email is required and checked for syntax before a ballot can count. There is no ownership verification; fake/different addresses bypass normalized-email HMAC duplicate checks. The site stores fingerprints, choices/counts and minimal consent/notification metadata only, for opted-in and non-opted-in voters alike. Raw email and names remain in request memory, never logs or persisted retry payloads. Browser cookies are convenience only. Counts aggregate confirmed PostgreSQL rows; invalidation keeps the voter identity reserved. Pending preparation expires after 15 minutes. Demo availability is independent of November live dates.

A signed HttpOnly cookie lasts up to 30 days and lets the API retrieve this browser's previous demo state. It is not accepted as proof of email ownership and cannot bypass central identity deduplication.

`SESSION_SECRET` must contain at least 32 characters. Preserve it for deterministic voter fingerprints. Shared source-address limits use keyed hourly PostgreSQL buckets. No local marketing list or subscription is created. The old encrypted-consent table is frozen: no new writes, automatic deletion or export. Existing records, if any, require separate owner-approved handling.

Real ballot creation and confirmation remain unconditionally disabled in this preview. The owner must explicitly approve launch before implementing/enabling the real submission path. Its intended policy is syntax-only email validation plus normalized-email duplicate prevention, browser state and atomic counting—not verified ownership.

The optional, unchecked news choice is independent of voting and snapshotted with the ballot. Notification metadata stores yes/no and, only if yes, consent timestamp/source/wording. No usable email is stored. Existing voters are not retrospectively forwarded or subscribed.

## SONG notification contract and failure handling

The prepared sender targets the exact existing `SONG_FORM_URL?isAjax=1`, never the General/homepage destination. It uses only supported `FIRSTNAME`, `LASTNAME`, `EMAIL`, `SONG_REQUEST`, honeypot and locale fields. Since the existing hosted route requires both names, voters must enter actual first/surname; none are fabricated or stored by the site. The complete message is bounded to 500 characters, labelled CHRISTMAS CONTENDERS VOTE, and includes server-approved artist/title, stable ballot UUID reference and marketing opt-in YES/NO. No extra provider attributes or changes to ordinary SONG/General/Sponsorship submission contracts.

The preview route unconditionally calls a network-free simulator. No public flag can enable live forwarding. The future live adapter accepts only explicit provider `success:true` as acceptance, not HTTP 200, HTML or redirects. Provider acceptance is NOT inbox delivery. No real emails were used for validation. Existing hosted-form list/automation behaviour has not been changed or verified; marketing yes/no is message text, not a provider list/automation switch. Confirm station handling of NO before authorising live forwarding.

A notification `sending` claim commits before any send. Concurrent calls/retries see the claim and cannot send again. Acceptance/simulation and confirmed ballot count then commit atomically. Definite rejection is uncounted and permits a user-initiated retry with transient details supplied again. Timeout, transport errors, malformed/unexpected responses or a crashed final commit remain pending/unknown; they are NOT automatically resent. Sending claims older than two minutes display as uncertain. The hosted form has no idempotency/lookup API, so exactly-once remote delivery cannot be guaranteed across a crash: the stable reference and manual station-side reconciliation are required. Protected staff tools can resolve an uncertain DEMO as simulated acceptance (count once) or not accepted (allow retry), never send or count a live vote. Existing completed ballots never trigger retrospective notifications.

`repeatDemo` defaults to false and can be enabled only in protected voting settings (enabled in the current development preview at the owner's request). It permits a fresh explicit demo attempt with the same email; retries of one attempt remain idempotent. The listener uses **Test another demo ballot** after a result. This applies only to demo entries, never genuine entries or real counts. Shared abuse limits, availability checks and simulated confirmation still apply. Existing votes are not reset.

## Launch dependencies

- Owner-authorized real launch path using the chosen syntax-only policy; verification delivery is not required.
- Confirm the existing SONG route’s station-side notification/list behaviour and optional-consent/unsubscribe handling with the owner before live use. The yes/no text is NOT automatic marketing-list enrolment. No provider settings, lists or automations were changed.
- Supply and manually screen real entries and obtain media/broadcast rights.
- Owner chooses any earlier submission cutoff; do not invent one.
- Confirm storage/schema/signing in the eventual hosting environment before launch, through the approved deployment process, not request-time migration.
- At the owner's launch instruction, reset isolated test votes and turn off repeat-demo testing; retain the one-voter rule for real ballots. Do not clear votes before that instruction.

SONG submissions serialize the original message plus full-lyrics/instrumental, audio, artwork and rights details into the existing `SONG_REQUEST` field. The entire payload must fit 500 characters. General and sponsorship destinations and contracts are unchanged. Files are secure links, not unsupported provider attachments.
