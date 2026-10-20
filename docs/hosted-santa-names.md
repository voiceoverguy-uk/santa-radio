# Hosted Santa names

The maker searches `/api/santa-names?q=...`. The backend reads the fixed HTTPS
index at `https://stagcommunications.com/santaradio/names/names-index.php`.
Only a selected source is downloaded when Create message is pressed. No FTP
credentials, remote writes, batch downloads or pre-generated greetings are needed.

## Observed real-host evidence — 20 October 2026

The real index returned HTTP 200, version-1 JSON with **9,774** entries. The actual
website parser accepted it, as well as the supplied 9,773-entry snapshot
(`attached_assets/names-index.php_1792525203782.json`).

Exact-filename comparison found one added filename, `caidhain.mp3`, and ten
case-only changes: Alaria, Colbee, Colbey, Colbie, Emilia, Franklyn, Haiden,
Isabela, Jaheim and Toree now have lower-case filename stems. Those case changes
are observed differences, not a request to rename anything. The net increase is
one recording. We did not upload a recording or test a new-upload refresh.

The original arithmetic was 9,997 − 9,773 = **224**. With the later live count it
is 9,997 − 9,774 = **223**. No complete directory listing was supplied. We cannot
identify the omitted filenames or reconcile all directory entries from a
filtered inventory. In particular, we cannot claim that 224 (or 223) entries
are invalid, non-audio or all caused by one exclusion rule. The owner's removal
of `ana_kayla.mp3` is known, but it is not evidence for the rest of the difference.

### Real Preview verification

The opt-in browser test used the real proxied Preview, real inventory and real
`demrie.mp3` (not a bundled name). Only Brevo's acceptance response was mocked in
an isolated browser context with fictional adult details; nothing was sent to
Brevo and no application access controls were changed.

Preview displayed **9,774 names available to download** before typing. Typing
Demr found Demrie. Search did not render audio. Two actual Create message
requests returned MP3s, both played with advancing browser playback time and no
media error, and both downloaded as `Santa-message-for-Demrie.mp3`.
The third creation was disabled and both earlier download links remained.

Both 1,015,056-byte downloads matched the browser's audio blobs. An independent
mix using the freshly fetched exact remote `demrie.mp3`, the existing prepared
intro/outro (including opening padding), and existing sleighbells matched both
downloads **byte for byte**:

`ad9193e08fe4e8c32a0fabc1f24bf0b28443a57b733c41f71ac2b5cc96f4dcf8` (SHA-256).

This establishes source identity and the unchanged name/music/intro/outro mix,
not a human editorial judgement of the filename's pronunciation. The generated
sample is available for listening. Other filenames used in automated round-trip
tests are **fixtures**, not claims that those files are already on the real host.
The screenshot tool can only show the unauthenticated landing/access page;
the isolated browser test also captured the unlocked result page.

No production-release verification, website publication, remote upload or Git
push was performed. Preview success does not establish production success.

## Owner upload: exactly one replacement PHP

1. Download `/downloads/names-index.php` and upload it as `names-index.php`
   beside the MP3/WAV recordings, **not into WordPress**.
2. `/downloads/names-index.php.txt` is identical source, offered **only as an
   alternative download** if the browser displays PHP. If using it, remove
   `.txt` before uploading. Do not upload both; there is only one script.
3. The replacement returns version **2**, with a distinct ID derived from each
   exact filename's SHA-256. It needs no mbstring or intl and uses PHP
   5.4-compatible syntax. Runtime tests here used PHP 8.2 with optional
   extensions disabled; an actual PHP 5.4 runtime was not available.
4. The website accepts both the currently hosted version 1 and replacement
   version 2 during this transition. Deploy/merge the compatible website before
   the owner changes the external script. This work does not upload it for you.
5. After the owner's upload, check the JSON, refresh Preview after the 60-second
   backend cache, and search an existing accented/space-containing recording.
   This future external-host transition has not been claimed as verified.

No further bulk renaming or deletions are requested. MP3/WAV stems support up to
80 Unicode letters/combining marks/digits and internal ordinary spaces, straight
or curly apostrophes, hyphens and underscores. Examples: `Seán.mp3`,
`Seán.mp3`, `Mary Jane.MP3`, `O'Conner.mp3`, `O’Conner.mp3`, `dixie3.wav`,
`ana_kayla.mp3` and `ana-kayla.mp3`. The exact filename bytes, case and extension
are retained and percent-encoded once under the fixed approved HTTPS origin.
Separators, traversal, controls, URL punctuation and symlinks are rejected.

Search is case-insensitive and composed/decomposed-accent equivalent, with
straight/curly apostrophe equivalence. It does **not** make recording IDs
equivalent. When equivalent labels match multiple recordings, visitors must
choose a suggestion; exact filenames appear alongside ambiguous labels.
Accents are not stripped, and no separate recordings are silently merged.

## Safe directory diagnosis — no public unrelated-file listing

If a complete owner-supplied listing is unavailable, the **same PHP script**
offers a read-only **CLI-only** diagnostic. In the hosting terminal, the owner
or hosting administrator can run:

```sh
cd /actual/path/to/santaradio/names
php names-index.php --diagnose > "$HOME/santa-name-directory-report.json"
```

Use a private output location outside the public web root. The shell writes the
report only; the PHP reads directory metadata, never modifies recordings or
downloads their audio. There is no web `?diagnose` mode. If terminal access is
unavailable, ask the host to run this command or supply a private, complete
directory metadata export, including exact filename bytes, entry type,
symlink status and readability. Do not send credentials.

Counts use mutually exclusive reasons, in this order:
symlink, directory, not-regular-file, unreadable, non-MP3/WAV extension,
malformed UTF-8, unsupported filename, included. Counts include the PHP script
and other directory entries but exclude `.` and `..`.

Only audio-extension entries have filenames in the diagnostic. Each includes
its exact filename (or base64 bytes if not UTF-8), reason, space flag and whether
the old filename rule would have included it. Unrelated filenames are never
published or individually disclosed. Permissions reflect the CLI account;
have the host use the website's effective permissions if different.

Capture the current inventory at the same time and privately supply both JSON
files. Produce a readable report with:

```sh
node scripts/report-santa-directory.mjs private-diagnostic.json private-inventory.json generated-artifacts/private-name-report.txt
```

This report lists actual space-containing audio filenames, all excluded
audio-extension entries with reasons, and differences from the supplied
inventory. It distinguishes filename-filter exclusions from unexplained
omissions; it never calls a file corrupt based on its filename. Until this
evidence is supplied, no excluded-file list or definitive full reconciliation
is possible. `/downloads/hosted-names-verification.txt` records current evidence
and the diagnostic steps for the owner.

## Runtime limits and unchanged behaviours

- Inventory cache: 60 seconds; failure cache: 10 seconds. Visible pages refresh
  every 75 seconds or on returning to the tab. Fixture refresh tests do not prove
  an external upload refresh.
- Total counts inventory entries, not matches or bundled names; outages show
  unavailable, never a misleading zero.
- PHP: 20,000 recordings, 2 MiB normal output, 16 MiB private diagnostic output,
  100,000 directory entries and a 10-second scan deadline.
- Fetches: no redirects, 10 seconds, 2 MiB inventory / 10 MiB selected audio.
  Malformed UTF-8 inventory bytes and malformed query encoding fail explicitly.
- Existing bounded MP3 decoding/WAV validation remains: 0.05–30 seconds;
  forced MP3 demuxer/decoder, file/pipe protocols only, 31-second bounded
  decoding, mono 48 kHz intermediate, 10-second kill timeout and cleanup.
- Shared intro/outro padding, music, on-demand mixing, temporary cleanup,
  two concurrent renders and two-message/10-minute visitor allowance remain.
  Downloading earlier greetings does not consume another allowance.
- Missing-name requests, radio feeds and marketing submission code are unchanged.

## Repeatable checks

```sh
PHP_BINARY=/path/to/php node --test scripts/santa-name-library.test.mjs scripts/santa-name-index.test.mjs scripts/hosted-santa-render.test.mjs scripts/santa-message-api.test.mjs scripts/santa-directory-report.test.mjs
npx playwright test tests/hosted-santa-names.spec.js tests/santa-name-count.spec.js tests/santa-message-cooldown.spec.js tests/santa-message-access.spec.js
HOSTED_SANTA_LIVE_TEST=1 npx playwright test tests/hosted-santa-live.spec.js
```

The last command is opt-in and restricted to development hosts. It uses real
read-only host GETs and two Preview renders, not production or real Brevo.
PHP fixture tests enumerate more than 9,500 actual temporary files; hosted
render fixtures reuse Erin audio under clearly artificial names and do not
verify Irish pronunciation. PHP execution skips explicitly if PHP is unavailable.
