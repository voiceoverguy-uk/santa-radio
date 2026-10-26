# Extended Santa: two offline listening samples

## Scope and sources

These are voice-only proofs, not a new maker. The website, working simple
maker, name inventory, certificates, signup/sharing behaviour and hosted files
are unchanged. Nothing was uploaded or deployed.

- Supplied archive: `attached_assets/test_stitch_1793023789241.zip`.
- Script checked against both PDF pages:
  `attached_assets/Santa_Script_1793021421721.pdf`.
- Name: the existing `server/santa-audio/names/arabella.wav`.
- Confirmed public source root:
  **https://stagcommunications.com/santaradio/names/personalised-message/**
  (the task's prior HEAD checks established selected URLs, not a complete
  hosted-library audit). These demos use the ZIP, not remote replacements.
- 28 audio files extracted: free intro MP3, six numbered fixed WAVs,
  six ages, five activities, two achievements, four treats and four locations.
  All 28 plus Arabella fully decoded without errors or warnings.
- Archive paths were checked before extraction; absolute paths, traversal,
  backslashes, symlinks, duplicate entries and oversized audio are rejected.
  macOS metadata is ignored. Originals were not modified.
- The folder really is `Achievment`. Python's ZIP filename view of the unusual
  treat is `treats/pfeffernu╠êsse.wav`; its exact stored interpretation was
  retained. Neither sample uses it. Do not silently rename the hosted library.

## Downloads and selections

The two MP3s are delivered as downloadable asset cards in the task conversation.
Local copies and full measurements are in the ignored
`generated-artifacts/extended-santa/` directory.

| | Sample 1 | Sample 2 |
| --- | --- | --- |
| File | `extended-santa-sample-1.mp3` | `extended-santa-sample-2.mp3` |
| Name, in both positions | Arabella | Arabella |
| Age | `AGES/9-year.wav` | `AGES/13-year.wav` |
| Activity | `Trying Hard at/teamwork.wav` | `Trying Hard at/playing-your-musical-instrument.wav` |
| Achievement | `Achievment/completing-a-jigsaw-puzzle.wav` | `Achievment/planting-and-caring-for-a-garden.wav` |
| Treat | `treats/buche-de-noel.wav` | `treats/turron.wav` |
| Location | `countries/the-enchanted-forest.wav` | `countries/camelot.wav` |
| Sum of ordered decoded source durations | 87.211167 s | 87.627063 s |
| Final MP3 decoded at 48 kHz for comparison | 87.211188 s | 87.627083 s |
| Assembly + MP3 encode after clip preparation | 1.415 s | 1.407 s |
| Final measured integrated loudness | −18.24 LUFS | −18.22 LUFS |
| Final measured true peak | −3.48 dBTP | −3.48 dBTP |
| Decoding errors or full-scale clipping | None | None |

Total extraction, preparation, both renders and technical verification took
18.84 seconds in this workspace. It excludes PDF inspection, automated
transcription and tool/model installation. These are local, single-run timings,
not production performance promises.

## Exact assembly and pause verification

Both follow this order, with **the same prepared name bytes** used twice:

`free-intro → Arabella → 1st → age → 2nd → activity → achievement →
3rd → treat → 4th → location → 5th → Arabella → 6th`

Every complete recording is decoded to 48 kHz stereo float PCM. Each receives
one constant gain, targeting −18 LUFS but capped at a predicted −3 dBTP.
The loudness analyser measures only; its dynamically processed output is
discarded. Actual clip processing is constant multiplication, not compression
or dynamic normalisation. Plain sample concatenation follows, with no fades,
trimming, silence insertion, overlap, crossfade, limiter delay or background
bells/music. This differs deliberately from the simple maker's filter and
does not modify or reuse its production rendering path.

Before MP3 encoding, each segment is byte-compared with its prepared clip at
its expected offset, and joined frames must equal the exact sum of source
frames. Gain preserves zero samples and the timing of all non-zero samples.
Synthetic tests independently check leading, internal and trailing pauses.
The final 192 kbit/s, 44.1 kHz stereo MP3s are fully decoded, their format is
checked with ffprobe, and their sample/true peaks are measured again.

Both final decoded durations differ by just **one 48 kHz comparison frame
(0.020833 ms)** after 44.1 kHz MP3 encoding/resampling. This is sample-rate
rounding, not an inserted join gap. MP3 container durations are 87.249 s and
87.667 s because they include encoder frame padding; gapless decoding removes
that padding. Lossy MP3 can alter very quiet samples, so the exact preservation
claim applies to the PCM assembly and timing, not bit-identical MP3 waveforms.
No input decoded sample reached full scale either.

## Wording and transitions for the owner's review

**No listening verification was performed.** The technical checks establish
decodability, ordering, timing and peak safety, not natural delivery,
pronunciation or editorial approval.

A locally run `faster-whisper` base.en model, with FFmpeg decoding and no audio
sent to a third party, produced these **automated, unapproved transcriptions**:

- Jigsaw: “I was also delighted to hear how amazing you've been completing
  that jigsaw puzzle.”
- Garden: “I was also delighted to hear how amazing you've been, planting and
  caring for a garden.”

Both therefore appear to contain the full achievement lead-in already; no
separate missing link was identified for these two choices, and none was added.
The jigsaw recording appears to say **“that”** rather than the filename's
**“a”**. The PDF says “how amazing you have been” and uses “starting
(school etc)” as an example; these supplied recordings use other achievements.
The final clip also appears to use “send you this little message” and “say
once again”, rather than the PDF's “leave you” and “one final big”.
The recordings were kept as supplied, not rewritten.

Please review these points while listening:

- Activity → achievement → `3rd`: about **29.24–35.26 s** in Sample 1,
  **30.55–36.87 s** in Sample 2. Is the complete achievement sentence and its
  recorded pause natural after the activity?
- Treat → `4th`: about **46.18–47.93 s** and **47.79–49.21 s**.
  The transcription misrecognised the foreign treat names, so it is not
  reliable evidence of their pronunciation.
- Location → `5th`: about **55.99–58.25 s** and **57.27–58.66 s**.
  These are fantasy locations, despite the folder being named `countries`.
- Repeated name → `6th`: about **73.84–75.23 s** and **74.26–75.64 s**.
  Check pace and tone after the Nice List line.
- Check the name and age joins too; all supplied pauses remain intentionally
  untouched. Constant loudness matching cannot establish matching mic tone
  or performance between recordings.

Before any later selectable maker: obtain owner wording/listening approval,
agree labels for the limited supplied choices (including the 11-month age
option), and separately verify exact hosted choice URLs and filename encoding.
The current ZIP is a small test set, not a complete selectable catalogue.
The sibling URL outside `names` is not an alternative; do not move files or
repair the external host as part of this proof.

## Reproduce

```sh
python3 -m unittest discover -s scripts -p 'santa_stitch_demo_test.py'
python3 scripts/santa_stitch_demo.py generated-artifacts/extended-santa-another-run
```

Use a fresh output directory. The renderer needs only Python's standard
library plus existing `ffmpeg` and `ffprobe`; no speech service or credentials.
`measurements.json` records per-source hashes, gain, sample counts, ordered join
offsets, final hashes and timings. `automated-transcripts.json` is supplementary
evidence from the one-off local transcription, not a rendering dependency.

## Additional owner-requested sleigh-bells version

After the two voice-only proofs, the owner requested **one extra version with
sleigh bells underneath, like the free message**. The original demos remain
unchanged. The extra download is
`santa-recorded-message-for-Arabella.mp3`, using all Sample 1 selections
(Arabella twice; age 9; teamwork; jigsaw; bûche de Noël; Enchanted Forest).

The supplied `attached_assets/sleigh-bells_1793024629484.mp3` fully decoded.
Its 2.20425-second recording is looped under the complete voice sequence.
It uses the simple maker's bells settings: −34 LUFS, −9 dBTP, LRA 7,
one-second bells fade-in, non-normalising mix, one-second final mix fade-out
and a 0.89 peak limiter. Limiter lookahead is compensated to keep the voice
timeline in place. The final one-second fade affects the mix, as in the free
maker; no voice joins, pauses or selections were edited.

The voice was rebuilt from the lossless source recordings, with each prepared
clip's hash checked against the original proof, rather than re-encoding the
previous MP3. The mixed PCM frame count equals the original voice frame count.

- Decoded final duration: **87.211188 seconds**.
- Voice preparation: **9.56 seconds**; mixing and MP3 encoding: **5.40 seconds**.
- MP3: **192 kbit/s, 44.1 kHz stereo**.
- Integrated loudness: **−18.15 LUFS**; true peak: **−3.39 dBTP**.
- Complete decoding passed; no full-scale clipping detected.
- No listening verification was performed. Please judge the bells level and
  the repeating bed by ear; technical checks do not establish seamless loops.
- No production maker, website or external hosted content was changed.

Full measurements: `generated-artifacts/extended-santa/bells-measurements.json`.
Reproduce after the original proof with
`python3 scripts/santa_stitch_bells_demo.py`; the new MP3 destination must not
already exist.

The owner subsequently requested uniform MP3 download filenames:
`santa-recorded-message-for-(NAME).mp3`. This now applies to local and hosted-name
maker downloads (including shared File objects), as well as the latest
downloadable bells sample. Only the output filename changed; the bells sample
audio is byte-identical to the prior delivery. Existing remote source and cache
URLs are deliberately not renamed or moved.

### Brighter bells listening comparison

At the owner's request, an additional **+3 dB bells-only** mix is available in
`generated-artifacts/extended-santa/bells-plus-3db/santa-recorded-message-for-Arabella.mp3`.
The supplied bells receive +3 dB of gain *after* their original background
loudness normalisation and before their fade-in and mixing; the speech's gain
and joins are unchanged. This is about 1.41 times the bells' signal amplitude,
not a 3 dB increase to the whole message. The original mix is retained.

This variant fully decoded as 87.211188 seconds, with −3.34 dBTP true peak
and no full-scale clipping or decoding errors. Mixing and encoding took
5.08 seconds locally after 7.01 seconds of voice preparation. Listening
approval is still needed, especially for perceived balance and bell-loop joins.

For a further comparison, change only the argument:
`python3 scripts/santa_stitch_bells_demo.py --bells-gain-db 3 --output-dir generated-artifacts/extended-santa/bells-plus-3db`.
Use a new directory rather than overwriting an earlier sample.
