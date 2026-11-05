# Workshop recording inventory over HTTPS

The owner keeps the extended-message recordings under the existing public
`names/personalised-message/` directory. Recording bytes are already readable
over HTTPS. Listing the folders is separate: the existing `names-index.php`
lists name recordings only, and directory URLs do not provide a working index.
No FTP login is required by this inventory approach.

## One-time owner upload

Download `/downloads/workshop-index.php` and upload **one file** as
`workshop-index.php` inside the existing `personalised-message` directory,
alongside the `AGES`, `Achievment`, `Trying Hard at`, `countries`, `treats`,
`sports` and **`funny`** folders. The funny folder is the exact sibling
`personalised-message/funny`, not `Funny` or a child of `sports`.
Preserve their existing case and spelling. Replace the previous
`workshop-index.php` with this refreshed download. Do not replace
`names-index.php`, move any recordings, or upload this script to WordPress.

The expected public URL is:

`https://stagcommunications.com/santaradio/names/personalised-message/workshop-index.php`

It should return JSON with five required categories (`age`, `activity`,
`achievement`, `place`, `treat`), optional talent groups (`sports`, `funny`), any available optional
regional groups and exact relative filenames. The
script reads metadata only, accepts no visitor-supplied filesystem paths,
ignores non-audio files, rejects symlinks, limits scan/output size and time,
and reports excluded audio counts. It does not rename, upload, delete or play
recordings. It does not expose FTP credentials or private absolute paths.

## Website integration

### Step 4 activity subdivisions

Step 4 remains one required `activity` recording. Its two browsing buttons reuse
the Talent controls: **Trying hard at** (fresh default) and **More Sports**.
The server assigns explicit membership for the owner's 56 exact approved paths;
this is not a new hosted category or another audio slot. All other activity
recordings stay in Trying hard at, including future MP3 additions. No path,
filename, ID, connector, access rule or cache lifetime changes.

The approved membership is server-only in `server/workshop-more-sports.js`.
Missing or empty recordings are never fabricated. The selected category is
restored on Review editing; switching categories discards only the current
activity and its search. Talent remains independent. Both selections reach the
existing review and stitch positions once each.

New More Sports recordings use the established neutral letter context and exact
selected display detail, not guessed sporting praise. Original activities retain
their curated contexts. Talent still adds no letter prose. Page-local variation
and document geometry are unchanged.

See [the private recording check](studio-more-sports-inventory.md) for inventory
differences and audio evidence. This note is repository documentation, not a
public recording catalogue.

**Live discovery status, 5 November 2026 (UTC):** a fresh read of the hosted
index returns all five required categories plus 50 sports and 26 funny choices.
One actual recording from each of these seven groups downloaded and decoded
successfully. Safe local renders with hosted categories and a synthetic name
passed with Talent selected and skipped; all temporary outputs were removed.
This is not listening evidence or wording approval. No private name import ran.
The website's read-only
`/api/santa-workshop-catalogue` endpoint fetches that fixed URL, validates exact
relative paths and SHA-256 identities, and caches the complete inventory for
five minutes. It does not send a recipient's searches or choices to the host.
The endpoint is available in Vite, Node and the serverless API.

The workshop keeps selected recording IDs in memory and displays friendly
labels without renaming source files. Age choices include month recordings
and year recordings from the actual index. Countries and other real places
are not labelled as fantasy locations; known fictional destinations have
explicit fantasy labels, and the Moon/Mars are marked as space destinations.
Missing/unavailable inventory shows an error and Retry, never offline samples.
The original five groups remain required. A missing/empty optional sports or
funny group returns no choices; visitors must deliberately skip Talent or choose
from an available group. No demonstration options are inserted into the live
builder. Invalid optional paths/IDs are rejected just as strictly as required
groups. Changing category clears its line and search, even on switching back.

### Optional state and county recordings

The updated index discovers `.wav` or `.mp3` recordings (case-insensitive
extension) in the five fixed sibling folders `usa-states`, `england-counties`,
`scotland-counties`, `wales-counties` and `northern-ireland-counties`. Each is
mapped only to its own country's existing recording. See
[the regional trial handoff](studio-regional-trial.md) for exact upload
instructions, the owner checklist and verification limitations.

Existing entries in `countries` remain independent destinations. They are not
silently moved, relabelled as parents or used to fabricate regional choices.
Hyphens/underscores become spaces in the display label; the source filename,
extension and SHA-256 recording identity stay unchanged. The existing non-empty,
supported-format, path and size checks still apply.

The server refreshes the index after its five-minute cache TTL; an already-open
builder keeps its loaded catalogue until reloading/retrying. Discovery is not
audio generation or proof that a recording plays. Do not rename existing files
just to change their labels.

The folder name does **not** make every entry a country. Known states and
counties remain real-place choices, not countries; unknown new labels are not
automatically declared countries either. Their exact selected labels reach the
letter, and their original IDs reach the existing audio selection. Until bespoke
writing is curated, new entries get a neutral named-place sentence and private
editorial-review flag, never invented geography, weather, customs or residence.

Synthetic checks exercise parser discovery, selected-detail review, stable
stories and message request IDs, plus the existing server-side audio resolution,
without uploading or changing real recordings.

Regional browsing replaces the country wheel, never adds another required
step. A selected region replaces the country recording in the existing audio
slot. Empty or absent regional groups leave the country-only path available.
Town/city hierarchies, aliases and additional recordings are not part of this work.

### Talent recordings and shared introduction

Keep the owner's original filenames, including spaces: for example,
`funny/stealing the remote control.wav`. Do **not** rename that file with `%20`;
encoding happens only when constructing the HTTPS download URL.
The shared introduction stays at `personalised-message/1-5.wav`, not inside
either talent folder. Visible step numbers do not rename any connector.

The previous `1-5.wav` decoded successfully on 2 November 2026. Its source
SHA-256 is
`fb6a1a7af4a1bf9556af3520e701c2fb1cb7eb04e7c820a2d617d518aef468d8`.
Lossless FLAC packaging was verified by comparing every decoded PCM sample.
Local automated transcription (not listening) returned:
“Now, Head Elf tells me you have quite the talent … apparently there's something
you're especially good at.” This confirms talent rather than sports wording,
but does **not** confirm the exact approved wording:

> Now, my Head Elf tells me you have quite a talent! Apparently, there’s something you’re especially good at… In particular...

The Talent step appends the currently selected sports/activity or funny
recording's exact display label to this introduction. “FUNNY or SPORT” is not
literal preview text. Unchosen, unavailable and skipped talent states append
no label; switching category clears the old label. This is display wording
only: changing that display text does not alter the hosted recording, packaged
FLAC or audio sequence.

**Current revision, 5 November 2026:** the hosted connector has changed since
the transcription above. Its replacement is now packaged losslessly, alongside
the other seven refreshed fixed speech elements. The historical transcription
does not describe or approve the new audio. Exact private hashes and native
properties are in `server/santa-audio/studio/sources.json`; see
`docs/studio-source-refresh.md` for local verification and release status.

**Owner action:** listen to the current connector and confirm/replace it if exact
wording is required. Merely changing the helper text does not change speech.
If replacing the hosted recording, retain `1-5.wav` and tell the maintainer:
the packaged private `1-5.flac` must also be refreshed losslessly. This task
does not modify external hosting or generate/edit speech.

After uploading the index, open its URL and check that `sports` and `funny`
contain the expected filenames and non-zero sizes. Wait up to five minutes
for the server catalogue cache, then reload Studio. Confirm each category's
real lines appear. Generate sports, funny and skipped messages and listen:
selected talent follows age and the shared introduction; skip omits both.
The exact chosen name recording is used twice. Keep the other connector
filenames, letter, certificate and free greeting maker unchanged.

Read-only real-asset verification is reproducible with
`node scripts/studio-talent-hosted-check.mjs`. It generates three ignored local
MP3s using real hosted base choices, direct known Tennis / Stealing the remote
control sources, the packaged connector and the existing Arabella name sample.
On 2 November 2026 all three decoded successfully: sports 94.94s (16 positions),
funny 96.21s (16), skip 84.85s (14). These are **not listening checks** and do not
exercise discovery of missing live talent groups. The application still rejects
talent choices absent from its authorised catalogue.

### Source files held for review

Two destination files have technical rather than destination filenames:

- `countries/1b.wav`
- `countries/Santa Audio messages Raw File EQ_01.wav`

They remain on the host and in the source index, but are not selectable.
The page reports held-file counts. Empty recordings or age files that cannot
be labelled safely are also held for review. Unsupported/unreadable files
reported by the PHP index are disclosed separately. An invalid identity/path
or missing required category fails the whole response rather than silently using a
partial list.

Filename inventory is not remote audio decoding/playback verification or
catalogue wording approval.
Studio now has its separately authorised message-generation path; regional
playback cannot be verified until the updated index and real recordings are available.
Authorised Studio message rendering is connected independently of the free maker
and does not activate live paid checkout.
