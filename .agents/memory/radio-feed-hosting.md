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

Read song metadata from the user-confirmed public HTTPS feeds on stagcommunications.com, not the retiring Heart Internet host. Do not add a fallback to that host, FTP credentials or paid services. The owner confirms automation already uploads Nowplaying.txt; history collection must reuse it rather than request another export.

**Why:** The user supplied working replacement feeds independent of the main website domain and explicitly ruled out fallback to the retiring host.

**How to apply:** Keep reads in the existing website service, with brief shared caching and bounded failures isolated from audio. The site is deployed separately through GitHub to Vercel; development changes do not authorise pushing or publishing. Do not promise exact audio synchronization: broadcast metadata may lead a listener’s buffered stream.

The owner authorises code for persistent song history, but production storage and independently running collector hosting must be confirmed before activation.

**Why:** The Top Ten request explicitly distinguishes code readiness from live collection and does not authorise publication, remote schema changes, paid provisioning or a production worker.

**How to apply:** Obtain approval before remote activation and verify durable storage plus collection with no visitors before claiming station-wide history is active.

The automation's upcoming slots can include station announcements with an empty artist, not just songs.

**Why:** A live feed contained ` - Santa Radio Free Message ID - VO` between two songs. Requiring an artist rejected the entire queue.

**How to apply:** The user clarified these entries are jingles and must be ignored. Filter them out, preserving the remaining songs' broadcast order. Never promise that three upcoming slots always mean three songs.

The owner reports that PHP on the hosting used for the FTP-supplied now/next song data has been upgraded from 5.4 to 8.4.

**Why:** The owner supplied this hosting update.

**How to apply:** Account for PHP 8.4 compatibility when advising on scripts on that hosting. Do not assume other hosting environments received the same upgrade.

The owner confirms the iPhone app consumes website data. Treat now/next duplication as a shared-service issue worth investigating, not an app-only issue requiring native source first.

**Why:** The owner explicitly confirmed the dependency when showing the same song as current and first upcoming.

**How to apply:** Fix and verify the website's shared contract. Separately establish the app's exact request URL and polling from evidence; the dependency alone does not identify either or prove device success.
