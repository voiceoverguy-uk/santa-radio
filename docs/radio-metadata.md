# Radio track feeds

The player reads `/api/radio-metadata`. Vite serves this endpoint during development
and preview; Vercel serves it as a Node function. The server reads only the two
fixed HTTPS feeds, with timeouts, response size limits and a ten-second in-process
cache. Browsers refresh approximately every fifteen seconds while visible.

Feed filenames are case-sensitive:
- Now Playing: `https://stagcommunications.com/santaradio/Nowplaying.txt`
- Coming Up: `https://stagcommunications.com/santaradio/Next3.txt`

Existing upstream cache-busting is retained to keep metadata fresh.
No FTP credentials or cross-origin browser requests are needed. These sources
are independent of the main website domain; there is no fallback to the
retiring Heart Internet host. HTML is rejected rather than displayed as music.

Broadcast metadata can lead buffered audio. No precise synchronization or
upcoming start times are promised.
