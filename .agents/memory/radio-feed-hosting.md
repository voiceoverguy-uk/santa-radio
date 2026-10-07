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

The user’s radio automation uploads song metadata to the legacy Santa Radio web host through FTP. Keep that original host accessible when moving the public domain to a new deployment.

**Why:** The verified public metadata URLs use the same main domain as the website. Moving its DNS without preserving the feeds would make the metadata endpoint fetch the new website rather than the automation output.

**How to apply:** Before a domain cutover, establish a stable HTTPS address for the legacy metadata host or preserve routing for the feed paths. Do not promise exact audio synchronization: broadcast metadata may lead a listener’s buffered stream.

The automation's upcoming slots can include station announcements with an empty artist, not just songs.

**Why:** A live feed contained ` - Santa Radio Free Message ID - VO` between two songs. Requiring an artist rejected the entire queue.

**How to apply:** The user clarified these entries are jingles and must be ignored. Filter them out, preserving the remaining songs' broadcast order. Never promise that three upcoming slots always mean three songs.
