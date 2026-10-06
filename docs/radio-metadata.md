# Radio track feeds

The player reads `/api/radio-metadata`. Vite serves this endpoint during development
and preview; Vercel serves it as a Node function. The server reads only the two
fixed HTTPS feeds, with timeouts, response size limits and a ten-second in-process
cache. Browsers refresh approximately every fifteen seconds while visible.

Feed filenames are case-sensitive: `Nowplaying.txt` and `Next3.txt`.
Upstream cache-busting is necessary because the legacy host advertises a two-day
cache lifetime. No FTP credentials are needed.

## Before moving the main domain

The feeds currently live at `https://www.santaradio.co.uk/radiodocs/`.
If this domain moves to the new Vercel site, keep these paths routed to the
original radio metadata host, or update the fixed upstream root to a stable
HTTPS hostname serving those files. Otherwise the new site will fetch itself
instead of the original feeds. HTML is rejected rather than displayed as music.

Broadcast metadata can lead buffered audio. No precise synchronization or
upcoming start times are promised.
