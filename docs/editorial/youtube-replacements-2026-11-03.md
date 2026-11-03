# Owner-supplied YouTube replacements

The shared catalogue now assigns the following supplied videos to both the
existing Christmas artist and Christmas karaoke/lyrics pages:

| Catalogue recording | Replacement | Verified YouTube title/channel |
| --- | --- | --- |
| Cher — DJ Play a Christmas Song | `-Z6AnCRjWX0` | Cher - DJ Play a Christmas Song (Official Lyric Video) / Cher |
| Burl Ives — Rudolph The Red-Nosed Reindeer | `lVFWMNrYpQo` | Rudolph The Red Nosed Reindeer / Burl Ives - Topic |
| Shane MacGowan & Popes — Christmas Lullaby | `l3HTMknXacU` | Christmas Lullaby / Shane MacGowan - Topic |
| James M Caddell — Have Yourself A Merry Little Christmas | `kbQ0p7gDc5E` | Have Yourself a Merry Little Christmas / James Taylor - Topic |

On 3 November 2026, all four oEmbed and watch-page requests returned HTTP 200.
Their initial player metadata reported `OK` and `playableInEmbed: true`.
These are metadata/permission checks, not proof of actual embedded playback.

The Caddell page explicitly labels its linked performance as James Taylor.
The previous Grinch title and its embedding restriction do not apply to this
replacement. The catalogue recording's original artist identity, biography,
lyrics, artwork and routes remain unchanged. This supplied video is not new
evidence for the original recording's credits.

See `youtube-audit.json` → `ownerReplacementChecks` for current results; its
older baseline results remain historical. Browser tests verify all eight page
surfaces, outbound links, external-media consent and retained lyrics using
isolated video frames. Real YouTube playback and published-site verification
are separate from these checks.
