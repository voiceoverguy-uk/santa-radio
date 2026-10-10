# Music credit verification

Checked 10 October 2026. This reviews every music row in the SEO editorial report, not Mugshot identities. Existing biographies, performer display credits, source records, lyrics, artwork and paths are unchanged. James M Caddell's video was subsequently replaced as described below. Sources establish identity, not whether a video plays.

## Supported classifications

| Catalogue credit | Decision and evidence |
| --- | --- |
| Tom Jones & C Matthews | Two people, Tom Jones and Cerys Matthews, not a permanent group. [Matthews's official release page](https://cerysmatthews.co.uk/product/baby-its-cold-outside/) explicitly describes this song sung with Tom Jones; the supplied biography spells out Matthews's name. |
| Madison Fayre | MusicGroup: a sister duo. [Piper Madison's official biography](https://pipermadison.com/about/) identifies the duet name and their recording of California Christmas. No individual member identities are added. |
| X-mas Donkey & The Glittering Balls | MusicGroup: the shared recording project, without replacing its character-style display credit with human names. The artist's own Bandcamp credits identify Casper Berkhout and Freerk van Oudheusden as instruments/vocals on [At The Christmas Ball](https://xmasdonkey.bandcamp.com/track/at-the-christmas-ball) and [It's Christmas Time](https://xmasdonkey.bandcamp.com/track/its-christmas-time); [Decorate The Christmas Tree](https://xmasdonkey.bandcamp.com/track/decorate-the-christmas-tree-a-corona-christmas) is a further release under the same act name. Writers and session musicians are not added as separate byArtist entities. |
| Paul Burling & Joseph Bell | Two people, a collaboration. The supplied release biography identifies Paul and his friend Joe Bell. The release's [YouTube metadata](https://www.youtube.com/oembed?format=json&url=https://www.youtube.com/watch?v=hH00gU0kyrI) confirms “ANOTHER CHRISTMAS SONG- Joseph Bell & Paul Burling”, uploaded by Another Xmas Song. Do not associate this Joseph Bell with the unrelated Shrewsbury singer found in search results. |
| Peter Lemongello | Person. His [official biography](https://www.peterlemongello.com/bio) explicitly identifies the singer and Love '76, matching the supplied biography. |
| Kate Grom | Person. Her [published interview](https://www.indiemusicdiscovery.com/interview-kate-grom) describes her own singing/songwriting and Americana Christmas recording, matching the supplied biography. |
| Nicholas Wells | Person. His [official biography](https://nicholaswellsmusic.com/bio) identifies the solo artist, and [official discography](https://www.nicholaswellsmusic.com/albums-and-singles) lists I Haven't Wrapped a Single Gift on One Little Season. |
| Kate Neve | Person. The supplied biography explicitly describes Kate singing and acting; the recording's [label-distributed YouTube metadata](https://www.youtube.com/oembed?format=json&url=https://www.youtube.com/watch?v=cQLglf-A_PM) confirms Honey Come Home for Christmas under Kate Neve - Topic. No association with similarly named Kate Neave or Kate Nerone. The former HearNow link now returns a 404 and is not identity evidence. |
| Trent Cokley | Person. The [Kennedy Center biography](https://www.kennedy-center.org/artists/c/co-cz/trent-cokley) identifies the individual vocalist and solo EP. The artist's [Songtradr profile](https://www.songtradr.com/trentcmusic) search result also lists Miss Us performed by Trent Cokley, but a full fetch failed; the classification relies on the fetched Kennedy Center biography. |

These overrides apply only to music. They do not broaden shared biography heuristics or change Mugshot subject entities.

## Investigated but not safely resolved

| Catalogue credit | Findings and specific remaining question |
| --- | --- |
| Andrew Collins — Another Christmas Time | Supplied copy identifies a Bournemouth songwriter and collaboration with Monique de los Santos. Searches also find unrelated Andrew Collins/Colyer musicians, writers and actors; none safely identifies this release's performing roles. The supplied Spotify track is verification-gated and its embed provides no usable credit. The linked YouTube upload is titled Another Christmas Time but belongs to ElGamma PenumbraENTERTAINMENT, not an identifiable artist/label source. Keep no byArtist entity until release/label credits establish who actually sings and whether Collins is also a performer. |
| James M Caddell — Have Yourself A Merry Little Christmas | The supplied artist website no longer resolves. [IBDB](https://www.ibdb.com/broadway-cast-staff/james-caddell-98440) lists a Broadway performer James Caddell, consistent with the supplied copy, but does not link the exact artist name to this recording. The previous video `-tJtsKngXJU` identifies Frank Sinatra / FrankSinatraVEVO, not Caddell. On 10 October 2026 the owner supplied [hFF9T4BiCSU](https://www.youtube.com/watch?v=hFF9T4BiCSU), uploaded by James Caddell and titled “You're a Mean One Mr. Grinch”. After being informed of the different song, the owner explicitly approved using it despite the title/lyrics mismatch. Only the video reference changed; no recording identity or byArtist classification is established by this substitution. Release credits for the catalogue's original song remain unresolved. Playback results are recorded in the video audit. |
| Jade 10 and Sisters Noel — My Ugly Sweater | [Mosaic Rain's official site](https://mosaicrain.com/) identifies Jade 10 as one of its changing lead vocalists and [official videos page](https://mosaicrain.com/videos) lists the exact joint credit. This verifies the release but does not identify Sisters Noel as real people, a permanent group or characters. Keep the whole joint credit unsplit; a partial entity would omit the unresolved collaborator. Ask the label for the full performing credit and entity types. |

All seven existing character-performance rows remain unchanged (Elsa and Anna twice, David Brent, Bo Selecta, Geraldine McQueen, Rizzo Gonzo and Miss Piggy). No real-person substitutions.

## Gladys Knight & The Pips legacy recording

The legacy `/artist?s=14` stores the artist and shortened title “It's Christmas Everyday”, with no recording media or lyrics. The retained catalogue recording is “When You Love Someone (It's Christmas Everyday)”.

- [AllMusic's Home for the Holidays: Pop Favorites track list](https://www.allmusic.com/album/home-for-the-holidays-pop-favorites-mw0001347118) explicitly lists the full title performed by Gladys Knight & the Pips (disc 2, track 9).
- Local `docs/live-lyrics-audit.md` records the owner's supplied title/lyrics correction for the same retained catalogue record.
- Local `src/data/matchLiveSong.js` already explicitly maps that exact artist and old title to the retained recording, whose slug preserves the shortened historical title.

Together these support a narrowly scoped artist/title alias. The route still requires a unique matching catalogue artist and full title; it is not a numeric 14→212 lookup, substring match or general parentheses-stripping rule. Other titles/artists cannot inherit it. Unknown legacy IDs remain 404; the redirect retains non-identity query parameters and goes directly to the established canonical path.
