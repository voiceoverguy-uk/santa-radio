# Contender display assets

The listing uses `src/lib/contender-display.json` to map original approved media URLs to small public display derivatives. Originals remain unchanged for playback and voting-picture downloads.

- Artwork: WebP, maximum 320 px, quality 75; lazy loaded with fixed aspect dimensions.
- Waveforms: 120 real peaks, prepared offline; loaded within 300 px of the viewport.
- Audio: no src attribute until Play. Seeking before Play only records the desired position. Missing waveform data never causes MP3 fetching or decoding.
- Players are memoized so the page countdown does not redraw every waveform each second.

After publishing or replacing entries, run `node scripts/prepare-contender-display.mjs`, test with `node --test scripts/contender-display.test.mjs`, and deploy the generated manifest and display directory. `FFMPEG_PATH` can select an installed ffmpeg. Existing URL-keyed derivatives are reused; use `--refresh-artwork` to rebuild thumbnails. New entries without prepared data still play on demand and display their original artwork lazily, with a simple progress control until waveform preparation is run. This command is explicit, not an automatic production job.

Verification 28 November 2026: 30 thumbnails, 646,512 bytes total, largest 46,634 bytes; 30 waveforms, 21,590 bytes total, largest 740 bytes. Local production-build browser verification recorded zero MP3 requests before Play (including a seek); pressing Play fetched only the selected recording and playback started. Subsequent player switching also worked. Public voting and Brevo submissions were not exercised; the local preview blocked writes.
