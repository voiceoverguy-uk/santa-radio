---
name: Christmas Contenders scope
description: Owner decisions for the preview competition and future launch.
---
The owner wants one song per ballot in the first build, with no forced second choice; they said that rule is still under discussion. November votes inform December consideration, not guaranteed airplay.

**Why:** These are the owner's competition rules, not a request for ranked voting or automatic playlist publication.

**How to apply:** Preserve one-choice ballots unless the owner changes the rule. Obtain the owner's submission-cutoff decision rather than inventing an earlier deadline.

The owner chose NO email ownership verification for the simple launch flow: syntax validation and normalized-email duplicate prevention only. Different or fake addresses can bypass this; never call the identity verified.

**Why:** The owner explicitly replaced the earlier verification-delivery launch requirement.

**How to apply:** Keep real voting disabled until separately authorized, but do not reintroduce verification delivery as a launch prerequisite. Marketing is a separate optional, unchecked choice; preview must not enrol demo voters.

Voter contact details must travel through the EXISTING SONG SUBMISSION Brevo destination, never general/homepage. Store only keyed fingerprints, counts and minimal consent/notification metadata—not new readable/recoverable email storage or a marketing list. Keep raw contact details transient, with no persisted retry payloads.

**Why:** The owner explicitly replaced local encrypted marketing-email retention with station-side forwarding, and prohibited deleting existing retained test records.

**How to apply:** The public ballot must stay email-only despite the existing SONG form's required names. Do not fabricate names or send an invalid payload. Compatible email-only Brevo routing is unresolved until separately confirmed; isolate the named sender rather than coupling vote success to it. No new service provisioning or real sends now. Preview forwarding stays simulated. Keep duplicate/uncertain-result protections; never reset totals or activate real forwarding without approval.

The owner wants minimum reading and steps: one compact ballot with choice, email, optional unchecked “Send me occasional Santa Radio updates” and “Submit vote”. No public names, simulation controls, review step or implementation/provider/fingerprint prose. While storage is down, show one brief “Preview — voting unavailable” notice; never fake success.

**Why:** The owner explicitly approved this bounded UX simplification and said technical detail stays out of the visitor journey.

**How to apply:** Allow unticking/switching before submission, preserve all nine compact song rows and waveforms, and retain duplicate guards and disabled real voting. Confirmed demo wording is “Test vote recorded.”; eventual real success is “Thanks—your vote is in!”.

The owner requested repeat voting while testing, with test votes reset and the one-voter limit restored when they are happy and choose to go live.

**Why:** The owner asked for temporary repeat testing, not a permanent change to the competition rules.

**How to apply:** Keep repeat testing isolated from real ballots. Do not reset totals or publish now; include the reset and restored restriction in the eventual owner-authorized launch work.

The owner has 20 submissions and wants a scannable listening list, not large artwork cards or an email form per entry. Listener-facing preview wording should be concise; technical identity and storage explanations belong outside the song rows.

**Why:** The owner liked the draft but said its enormous artwork and repeated forms made the page far too long for their submissions.

**How to apply:** Keep small square artwork and compact horizontal rows, one accessible song selection and one shared ballot area. Do not invent public entrants.

The owner prohibits ALL public artist/song descriptions or promotional information: only artist and song title as entry text, alongside artwork and controls. No bios, charity appeals, backstories or description tooltips/expanders; no public-description input in management.

**Why:** The owner wants voting uninfluenced by promotional material and explicitly superseded the earlier short-description requirement.

**How to apply:** Preserve existing stored information privately and keep screening materials/lyrics intact. Never clear it on entry edits. Keep public rows compact and free of descriptions when adding entrants.

Use the owner's Santa-with-headphones/music-notes image for contenders without supplied artwork, not generated substitutes.

**Why:** The owner explicitly supplied that image for entries with no cover.

**How to apply:** Prefer a supplied artist/song cover; use the supplied Santa fallback when missing. Artwork alone is not a playable entry—wait for the corresponding recording rather than inventing audio.

The owner wants a compact hero with a short listening invitation, one unboxed live countdown and a plain closing-date line; screening and editorial explanations belong in How it works below.

**Why:** The owner said the earlier hero had too many words and boxes and wanted songs to appear sooner.

**How to apply:** Do not restore separate opening-date/status panels or repeat the rules above the listening list.

The owner wants long gold interactive waveforms from real recording peaks, not native audio controls or decorative/fabricated waveforms. Audio should load on demand rather than downloading the whole list.

**Why:** The owner expects the listening list to remain compact and practical with around 20 tracks.

**How to apply:** Preserve wide, roughly 40px-high waveform seeking, keyboard access and radio coordination when changing the listening rows.

Shuffle all displayed songs, including Bob, freshly once on every full load/reload, without stored ordering or a fixed session seed. Keep the order steady for playback, selection, forms and total polling, whether database-backed or source fallback.

**Why:** The owner explicitly requires a fresh unbiased shuffle; chance repeats are acceptable.

**How to apply:** Keep order only in page memory. Stable artist anchors and share-target highlighting/scrolling must not pin the target first.

Studio A = full Message Maker Studio; Studio B = free Santa message; Studio C = song contenders.

**Why:** The owner supplied this naming context.

**How to apply:** Use these meanings when asked to name studios; do not rename other product areas without a request.
