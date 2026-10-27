# Workshop recording inventory over HTTPS

The owner keeps the extended-message recordings under the existing public
`names/personalised-message/` directory. Recording bytes are already readable
over HTTPS. Listing the folders is separate: the existing `names-index.php`
lists name recordings only, and directory URLs do not provide a working index.
No FTP login is required by this inventory approach.

## One-time owner upload

Download `/downloads/workshop-index.php` and upload **one file** as
`workshop-index.php` inside the existing `personalised-message` directory,
alongside the `AGES`, `Achievment`, `Trying Hard at`, `countries` and `treats`
folders. Preserve their existing case and spelling. Do not replace
`names-index.php`, move any recordings, or upload this script to WordPress.

The expected public URL is:

`https://stagcommunications.com/santaradio/names/personalised-message/workshop-index.php`

It should return JSON with five categories and exact relative filenames. The
script reads metadata only, accepts no visitor-supplied filesystem paths,
ignores non-audio files, rejects symlinks, limits scan/output size and time,
and reports excluded audio counts. It does not rename, upload, delete or play
recordings. It does not expose FTP credentials or private absolute paths.

## Website integration

The uploaded index is now readable over HTTPS. The website's read-only
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

### Source files held for review

Two destination files have technical rather than destination filenames:

- `countries/1b.wav`
- `countries/Santa Audio messages Raw File EQ_01.wav`

They remain on the host and in the source index, but are not selectable.
The page reports held-file counts. Empty recordings or age files that cannot
be labelled safely are also held for review. Unsupported/unreadable files
reported by the PHP index are disclosed separately. An invalid identity/path
or missing category fails the whole response rather than silently using a
partial list.

Filename inventory is not remote audio decoding/playback verification,
catalogue wording approval, or permission to connect message rendering.
The workshop remains a design preview without audio generation or playback.
