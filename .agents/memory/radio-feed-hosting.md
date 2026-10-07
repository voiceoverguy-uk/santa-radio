---
name: Radio feed hosting
description: External hosting constraint for live track information.
---
The homepage live video must autoplay muted and remain muted, with no embedded unmute controls; the radio audio player is separate.

**Why:** The owner explicitly requested “ALWAYS MUTED” when enabling automatic video playback.

**How to apply:** Preserve this constraint when replacing or updating the homepage stream player.

Starting Listen Live from the compact radio player should expand it, then minimise again after ten idle seconds without interrupting audio.

**Why:** The owner explicitly requested this feedback when starting playback from the minimised player.

**How to apply:** Keep pause/cancel separate from starting playback; do not expand merely because playback is paused.

Read song metadata from the user-confirmed public HTTPS feeds on stagcommunications.com, not the retiring Heart Internet host. Do not add a fallback to that host, FTP credentials, paid services or new storage.

**Why:** The user supplied working replacement feeds independent of the main website domain and explicitly ruled out fallback to the retiring host.

**How to apply:** Keep reads in the existing website service, with brief shared caching and bounded failures isolated from audio. The site is deployed separately through GitHub to Vercel; development changes do not authorise pushing or publishing. Do not promise exact audio synchronization: broadcast metadata may lead a listener’s buffered stream.

The automation's upcoming slots can include station announcements with an empty artist, not just songs.

**Why:** A live feed contained ` - Santa Radio Free Message ID - VO` between two songs. Requiring an artist rejected the entire queue.

**How to apply:** The user clarified these entries are jingles and must be ignored. Filter them out, preserving the remaining songs' broadcast order. Never promise that three upcoming slots always mean three songs.
