---
name: Music artwork
description: User-supplied artist illustrations and temporary catalogue artwork policy.
---
The user is supplying artist illustrations in batches for /christmas-music. Reuse each artist's supplied image across their songs; use the user's supplied Santa cartoon for other artists until more artwork arrives.

In random catalogue order, artists with their own artwork must appear before artists using the Santa fallback. Shuffle within both groups; leave A–Z alphabetical.

**Why:** The user explicitly requested artwork-first random ordering so the initial grid showcases supplied portraits.

**How to apply:** Use the shared artwork resolver to decide priority, so newly supplied portraits join the first group without maintaining a separate priority list.

**Why:** The user requested replacing the circles and initials with their artwork, with a temporary Santa image for everyone else. They later supplied a new Santa cartoon and explicitly requested it for artists without cartoons.

**How to apply:** Match complete artist names, allowing accents and harmless formatting differences. Do not equate a solo performer with a band or collaboration without confirmation.

The user confirmed that their Holly Johnson request means Frankie Goes to Hollywood, and explicitly wants Holly Johnson's portrait used for that band.

**Why:** The user approved this specific exception to the solo-versus-band matching rule.

Use Paul Burling's supplied solo portrait for the Paul Burling & Joseph Bell joint credit too.

**Why:** The user explicitly approved this exception when asked about the joint credit.

**How to apply:** Keep this exception specific to that collaboration, not other joint credits or Joseph Bell alone.

Keep supplied uploads and legacy JPEG originals when creating optimised WebP delivery copies.

**Why:** Optimisation should not destroy the source artwork or break old direct image URLs; retaining originals also avoids using an already compressed WebP as a future editing master.

**How to apply:** Serve the optimised copy through the artwork mapping, but do not delete originals merely to reduce page downloads—the browser only downloads the referenced file.

Fit non-square supplied illustrations inside the square artwork canvas without stretching or cropping the composition.

**Why:** Landscape band portraits can have members near both edges; square cropping would remove them.

**How to apply:** Preserve aspect ratio and use transparent padding when making square delivery images.

Artwork updates are intended for both the website and the separate iOS app, using one shared live catalogue rather than independently maintained lists.

**Why:** The user reported new portraits appearing on the website but not in the iOS app and requested a shared update process.

**How to apply:** Preserve the shared-catalogue contract when adding artwork. Website changes must be published before a production mobile client can retrieve them; do not claim iOS verification without checking the separate app. Replacement images must invalidate mobile caches even when the current track is unchanged.

Share existing verified song-specific website assignments in the additive recording feed, without broadening their exact song scope or replacing artist portraits.

**Why:** The owner initially requested web-only song artwork, then authorised sharing the existing exact-recording assignments through an additive feed. This supersedes only the feed exclusion, not precise song assignments or native bundle approval.

**How to apply:** Generate recording entries from the website assignments, not a second list. Retain old artist fields and require older-consumer compatibility checks before publication. Native feed adoption and approved bundled-image migration remain separate work; website tests cannot establish device parity.

The astronaut-and-Nativity illustration supplied for Chris De Burgh replaces his shared artist picture; it is not a song-only exception.

**Why:** The owner clarified, “The image I uploaded was to overwrite the existing pic of Chris de burgh”.

**How to apply:** Treat this illustration as his shared artist artwork, including the existing artist-only feed. This specific clarification does not authorise shared replacements for other song-specific illustrations.

Include explicit Santa entries for all song-catalogue artists without supplied portraits in the shared feed, while keeping genuine portrait mappings separate.

**Why:** The user approved this server-side workaround for missing fallback artwork in the separate app, to avoid requiring an app update.

**How to apply:** Do not label Santa entries as genuine portraits or change artwork-first website ordering. New supplied portraits should automatically replace their feed entries; app behaviour still needs separate verification.

Keep artist-artwork lookup separate from native song/profile lookup when diagnosing app failures.

**Why:** A supplied native screenshot reported “No matching profile could be opened” for a shortened joint credit even though the public artist aliases and clean image bytes were available. An artist alias is not a profile alias.

**How to apply:** Verify the public image path read-only, then request the native catalogue source and lookup/refresh diagnostics before blaming missing artwork, stale data or caching. Website song aliases do not automatically change the separate app.
