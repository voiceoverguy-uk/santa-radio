# Artist backgrounds

Open `/santa-dashboard#artist-backgrounds` and unlock with the existing owner token.
Search artist names, select a result, edit the plain text and press **Save background**.
Previous/Next moves alphabetically through artists. Unsaved edits prompt before switching;
failed saves retain the draft. Reload saved text retrieves the latest saved version.

An artist has one override, shared by all song pages with the same artist credit
(case and whitespace normalised; distinct acts and joint credits remain separate).
Before an override is saved, the editor uses the first catalogue background for that artist.
The public pages retain their existing text when there is no override or the service is offline.
New visits fetch saved overrides; open pages refresh within a minute while visible.
The text is rendered as plain text, with paragraph breaks preserved.

`GET /api/artist-backgrounds` returns public overrides. `GET ?edit=1` and POST require
the existing Studio owner token. POST additionally requires a matching origin and JSON body.
The server validates the artist key and 1–8,000 character text; parameterised queries store it.
Revision checks reject stale writes with HTTP 409; reload before retrying.

`database/artist-backgrounds.sql` creates the additive table during the existing production
postbuild migration. No request creates schema or rewrites the bundled catalogue.
Relient K's malformed bundled biography is separately corrected so it also renders cleanly
before the public override request completes.

Validation: `node --test scripts/artist-backgrounds.test.mjs`; Playwright
`tests/artist-background-editor.spec.js` covers desktop/mobile search, save failure recovery,
saving, unsaved navigation, reload and public display. Production verification saves the
user-approved Relient K paragraph via the real authenticated endpoint and reads it back.
