# Hosted Santa names

The message maker searches `/api/santa-names?q=...`. The website backend reads
`https://stagcommunications.com/santaradio/names/names-index.php` and fetches a
selected MP3 or WAV only when creating the message. No FTP credentials are required.

## One-time host setup

1. Download `/downloads/names-index.php.txt` from the website preview (safe for
   browsers that display PHP), then **rename it to `names-index.php`**.
   Alternatively download `/downloads/names-index.php` or take
   `public/downloads/names-index.php` from this project. Both downloads contain
   identical PHP source. Do not leave a `.txt` suffix or save a webpage as the file.
2. Upload the PHP file unchanged beside the MP3/WAV files in the existing `santaradio/names/`
   folder. Do not upload it into this app's API folder or run it through WordPress.
3. Open `https://stagcommunications.com/santaradio/names/names-index.php`.
   It must return HTTP 200 with JSON, for example:

   ```json
   {"version":1,"names":[{"id":"aafia","name":"Aafia","file":"aafia.mp3"},{"id":"dixie3","name":"Dixie3","file":"DiXiE3.MP3"}]}
   ```

   These are illustrative entries, not a manually maintained list. The script
   reads the actual directory on each request.
4. Confirm the list contains the intended recordings. In Preview, refresh the
   name list (allow 60 seconds for the backend cache), search a hosted-only name,
   select it, create a greeting through the existing adult access flow, and
   play/download the finished MP3. Verify the spoken name and intro/outro/music.
   Then upload a new uniquely named clip and check discovery after refresh.
5. Website publication is separate and requires the owner's approval. This task
   does not upload files to the external host, publish the website or push Git.

If that exact PHP URL still shows a WordPress database-error page after upload,
the host has an unresolved file placement, PHP execution or routing problem.
Ask the hosting administrator to ensure this real file is executed directly
instead of being routed to WordPress. A successful `aafia.mp3` GET does **not**
prove that index discovery or completed greeting creation works.

The script runs independently of WordPress and uses PHP 5.4-compatible syntax.
It does not modify recordings, expose non-audio files or follow file symlinks.
It lists readable regular MP3/WAV filenames containing letters A–Z, numbers,
apostrophes, hyphens or underscores, such as `aafia.mp3` or `DiXiE3.WAV`.
Exact filename case, extension and numbered variants are preserved. Identifiers
are lower-case with underscores changed to hyphens. Keep them unique across
both formats: `Anna.mp3` and `anna.wav`, or `Anna-Marie.mp3` and `Anna_Marie.wav`,
are ambiguous. The script returns HTTP 503 with the identifier and conflicting
filenames; it never silently picks one or returns a partial inventory. Rename
the intended variants distinctly (for example `anna2.wav`). Non-matching files
are excluded. Limits are 20,000 entries and 2 MiB of JSON; excess is an error.

Names default to title-cased filename text, with underscores/hyphens displayed
as spaces. Where a pronunciation variant or spelling needs a custom label,
extend the index's entries with a validated `name` and optional `aliases`
array; distinct recordings must have distinct identifiers. Do not silently
merge different pronunciation recordings.

## Runtime behaviour

- The validated inventory is cached for 60 seconds per server process; failures
  are cached for 10 seconds to avoid repeatedly hitting a broken host.
- The form shows “N names available to download”, counting only hosted inventory
  entries, not bundled recordings or filtered suggestions. It loads before
  typing and refreshes every 75 seconds while the page is visible, or when
  returning to the tab. If the list is unavailable, the total is unavailable,
   not zero. Counting reads the inventory only; it does not download recordings or
  create greetings.
- Searches are debounced and superseded responses discarded. Results contain
  only name identifiers, display labels and safe download filenames.
- Existing bundled recordings remain available if the hosted index fails, with
  an explicit visitor warning. Unknown hosted names are never guessed.
- The renderer revalidates the selected identifier against the inventory,
  downloads its exact filename from the fixed approved directory, refuses
  redirects and applies 10-second/10-MiB download limits.
- Standard PCM/float WAVs with one or two channels and duration 0.05–30 seconds
  are accepted. MP3s are decoded with the packaged `ffmpeg-static` executable,
  forced MP3 demuxer/decoder, strict decoding errors and a 10-second kill timeout.
  Decoding is bounded to 31 seconds of mono 48 kHz PCM (under 3 MiB) and the same
  0.05–30-second duration check; longer recordings are rejected, not shortened.
  Only file/pipe protocols are allowed; playlists cannot fetch external sources.
  Corrupt audio, HTML responses and unsupported formats fail visibly rather
  than producing a greeting with the wrong name.
- Only the name source is replaced. Shared intro/outro preparation, supplied
  outro padding and bell mixing are unchanged. Temporary files are removed
  after each request, including failed MP3 decodes. Two concurrent renders are
  allowed; excess requests receive HTTP 429. Downloaded sources are at most
  10 MiB each; decoded name audio is under 3 MiB per request. Completed messages
  are not pre-generated or catalogued.

## Verification

Run `node --test scripts/santa-name-library.test.mjs scripts/hosted-santa-render.test.mjs scripts/santa-message-api.test.mjs scripts/santa-name-index.test.mjs`
for inventory/security/cache/mixer checks. Set `PHP_BINARY` to a PHP CLI path if
PHP is not on PATH; the PHP execution test explicitly skips otherwise. It runs
the actual standalone index against 9,501 temporary files and collision cases.
The mixer tests use a supplied WAV and a locally encoded MP3 as mocked hosted
sources; they do not prove the external inventory or all remote names work.
Run the hosted-name browser tests and existing message allowance/access tests.
After host setup, independently verify real search and actual MP3 generation;
local preview checks do not prove live Vercel behaviour.

## Current external-host status

During this update, the exact HTTPS index URL returned HTTP 500 and a WordPress
“Database Error” HTML page. The new MP3 library has **not** been verified through
real inventory search and greeting creation: that check depends on the owner
uploading the standalone PHP file and the host serving JSON. Previous verification
of the old 64-WAV library is not evidence for this replacement library. Local
fixture tests, owner upload, Preview end-to-end verification and separately
approved live publication are distinct steps.
