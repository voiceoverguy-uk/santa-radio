# Hosted Santa names

The message maker searches `/api/santa-names?q=...`. The website backend reads
`https://stagcommunications.com/santaradio/names/names-index.php` and fetches a
selected WAV only when creating the message. No FTP credentials are required.

## One-time host setup

1. Download `/downloads/names-index.php` from the website preview, or take
   `public/downloads/names-index.php` from this project.
2. Upload it unchanged beside the WAV files in the existing `santaradio/names/`
   folder. Do not upload it into this app's API folder or run it through WordPress.
3. Open `https://stagcommunications.com/santaradio/names/names-index.php`.
   It should return JSON with `version: 1` and a `names` array.
4. Confirm the list contains the intended recordings, then publish the website
   separately when ready. External host setup is not performed by this project.

The script runs independently of WordPress and uses PHP 5.4-compatible syntax.
It does not modify recordings, expose non-WAV files or follow file symlinks.
It assumes regular WAV filenames containing letters A–Z, numbers, apostrophes,
hyphens or underscores, such as `demrie.wav`. Keep filenames unique irrespective
of case or underscore/hyphen spelling. Non-matching files are excluded.

Names default to title-cased filename text, with underscores/hyphens displayed
as spaces. Where a pronunciation variant or spelling needs a custom label,
extend the index's entries with a validated `name` and optional `aliases`
array; distinct recordings must have distinct identifiers. Do not silently
merge different pronunciation recordings.

## Runtime behaviour

- The validated inventory is cached for 60 seconds per server process; failures
  are cached for 10 seconds to avoid repeatedly hitting a broken host.
- Searches are debounced and superseded responses discarded. Results contain
  only name identifiers, display labels and safe download filenames.
- Existing bundled recordings remain available if the hosted index fails, with
  an explicit visitor warning. Unknown hosted names are never guessed.
- The renderer revalidates the selected identifier against the inventory,
  downloads its exact filename from the fixed approved directory, refuses
  redirects and applies 10-second/10-MiB download limits.
- Standard PCM/float WAVs with one or two channels and duration 0.05–30 seconds
  are accepted. Corrupt audio, HTML responses and unsupported audio formats
  fail visibly rather than producing a greeting with the wrong name.
- Only the name source is replaced. Shared intro/outro preparation, supplied
  outro padding and bell mixing are unchanged. Temporary files are removed
  after each request; completed messages are not pre-generated or catalogued.

## Verification

Run `node --test scripts/santa-name-library.test.mjs scripts/hosted-santa-render.test.mjs`
for inventory/security/cache/mixer checks. The integration test uses a supplied
local WAV as a mocked hosted source; it is not proof that all remote names work.
Run the hosted-name browser tests and existing message allowance/access tests.
After host setup, independently verify real search and actual MP3 generation;
local preview checks do not prove live Vercel behaviour.

The owner's uploaded index was verified with 64 entries. Every listed remote WAV
passed format/duration validation and every name appeared through the real
Preview search endpoint. A mobile browser generated, played and downloaded
Demrie's greeting through the real mixer; only the Brevo access response was
mocked to avoid creating a test contact. Publishing and live Vercel verification
are separate steps.
