# Santa Tracker handover — attach BOTH download ZIPs

The complete, lossless source archive is approximately 191 MB. The attachment
service accepts files up to 100 MiB, so delivery uses two smaller ZIPs. **No
website source, public artwork or tracker assets were removed to fit.**

Download and attach both:

1. `santa-radio-tracker-handover-part-1-of-2.zip`
2. `santa-radio-tracker-handover-part-2-of-2.zip`

The receiving Replit agent should extract both into the **same empty directory**.
Shared instruction files in both ZIPs are identical and can be overwritten.
There will then be two numbered binary chunks, `assemble-handover.py`, and the
complete archive's `.sha256` file.

Run:

```sh
python3 assemble-handover.py
```

The script joins the chunks, checks the complete archive's SHA-256 and ZIP CRCs,
then writes:

`santa-radio-current-source-tracker-handover-2026-10-27.zip`

Extract that completed ZIP. Read `README-TRACKER-HANDOVER.md`, `TRACKER-GUIDE.md`
and `VERIFICATION.md` at its root. The final ZIP contains the entire sanitised
source snapshot and required public assets, plus its file manifest. The
numbered chunks are transport pieces, **not** independently usable website
archives. Do not treat the first part as the whole source export.

`DOWNLOAD-PARTS.sha256`, supplied separately, checks the two download ZIPs.
The complete-source `.zip.sha256` inside each part checks the reconstructed
archive. Its manifest checks each individual source/document/asset file.

## Paste into the other project's chat

I've attached BOTH parts of the current Santa Radio source handover. Extract
both into the same directory, run python3 assemble-handover.py, then extract
the verified complete ZIP and read README-TRACKER-HANDOVER.md, TRACKER-GUIDE.md
and VERIFICATION.md. Public reference: https://www.santaradio.co.uk/santa-tracker
and homepage https://www.santaradio.co.uk/. This is the current source, including
the enlarged homepage map, not the old transfer archive. It is a clock-driven
estimated journey, not GPS: no tracking backend, API key, database or original
Replit server is required. Preserve its logic and appearance. Native iOS/tvOS
adaptation and real Apple-device validation remain this project's work.
