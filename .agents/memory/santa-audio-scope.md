---
name: Personalised Santa audio scope
description: Audio-only product direction and incremental name-library rollout.
---
The owner-hosted name folder can fail as a directory page while individual WAV URLs and a standalone PHP listing still work. In October 2026, the directory was routed through an incompatible WordPress/PHP installation, but an owner-uploaded standalone listing ran successfully.

**Why:** Repeated directory requests returned HTTP 500, but a directly addressed supplied WAV downloaded and produced a playable greeting.

**How to apply:** Verify individual audio and inventory discovery separately. Use an owner-uploaded standalone listing beside the recordings; do not change the external WordPress installation or request FTP credentials to fix discovery.

Hosted recording labels can contain digits, including numbered variants. Preserve these labels and identifiers rather than assuming every catalogue entry is a letters-only first name.

**Why:** A newly uploaded numbered WAV was readable and safely listed by the host, but letters-only display-label validation rejected the entire inventory.

**How to apply:** Keep label validation compatible with safe file-derived alphanumeric labels while retaining strict filename, identifier and path checks. Do not strip variant suffixes or merge separate recordings without the owner's editorial direction.

The user wants the number of names on FTP ready to go, displayed as “(number) names available to download.”
The input placeholder should say “Start typing, eg. (name), over (number) names available”, with a random popular-name example and the currently available count.
Choose random placeholder names from the user's supplied 200-entry British/American boys/girls list, not the recording database.

**Why:** The user asked for the hosted-library size beside the name search and explicitly requested their supplied list for random examples.

**How to apply:** Count entries in the hosted recording inventory, not the combined hosted and bundled catalogue. Do not substitute a zero total when the hosted list cannot be read.

The on-demand audio service must be portable to Vercel, not merely functional in Replit preview. Do not assume system-installed audio tools or source recordings are available in an external serverless runtime.

**Why:** Replit's preview and the Vercel deployment have different routing, file inclusion and executable availability; preview success alone does not establish that visitors can generate an MP3.

**How to apply:** Preserve on-demand mixing rather than batch-generating completed greetings. Package its runtime resources explicitly, handle the hosting provider's request format, and verify an actual MP3 response after a new live deployment.

The user wants personalised Santa audio messages ending in an MP3, not video. Start with Arabella as an experiment and a typed first-name box; they intend to upload thousands of recorded names later.

**Why:** The user explicitly corrected the proposed video and described the intended audio workflow.

**How to apply:** Use the supplied recorded voice, not voice synthesis. Keep unavailable names explicit; future library integration should resolve typed names to verified recordings.

Do not pre-create completed messages for the name catalogue. Store the source name recordings; when a user selects their child's name, build the mixed MP3 at that time and then offer the download. Provide live name suggestions as they type.

**Why:** The user explicitly corrected batch generation: “We don't want a database full of completed names.”

**How to apply:** Future work must replace the pre-rendered experiment with on-demand assembly. Do not batch-render newly uploaded names. Temporary output retention should be bounded rather than a permanent catalogue of completed MP3s.

Preserve the outro's supplied opening padding.

**Why:** The user deliberately added silence to the start of free-outro.wav to make the gap after the name sound more natural. They corrected the earlier choice of the shorter free-outro2.wav.

**How to apply:** Do not automatically trim leading silence from the outro when mixing or replacing recordings.

The user chose two free messages before a 30-minute wait.

**Why:** When asked whether the allowance before the wait should be two or three messages, the user selected “Two messages”.

**How to apply:** Use two messages and a 30-minute wait when planning or implementing the free-message allowance; do not substitute three.

Do not tell visitors about the limit until they have created their second message. Keep both generated greetings visible and downloadable, rather than replacing the first when they choose or create another.

**Why:** The user explicitly requested these behaviours after reviewing the initial allowance wording and single-result flow.

**How to apply:** Show the waiting notice only after the second success. Preserve earlier results while names change and while another creation is pending or fails.

Preparing reusable, lossless shared source clips is acceptable; pre-creating personalised greetings is not. Keep the supplied recordings and their editorial waveform/padding intact.

**Why:** The on-demand requirement is about assembling personalised messages at request time, not repeating invariant source processing. Lossless shared preparation reduces CPU and memory without creating a completed-message catalogue.

**How to apply:** Optimise invariant source processing separately from name selection and mixing. Validate waveform equivalence before lossy MP3 encoding; encoded file hashes alone are not an audio-quality comparison.

Missing-name request confirmations use “check back in a week” before 1 December, then “check back in a couple of days” from 1 December onwards.

**Why:** The owner explicitly requested this annual change in the suggested return interval, while saying visitors should check whether the name is available.

**How to apply:** Treat this as a seasonal invitation to check availability, not a guarantee that a recording will be created by that date.
