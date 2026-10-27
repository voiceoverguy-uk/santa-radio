"""Transport the full export without dropping assets to fit attachment limits."""
import hashlib
import pathlib
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "generated-artifacts/tracker-handover"
NAME = "santa-radio-current-source-tracker-handover-2026-10-27.zip"
source = OUT / NAME
limit = 100 * 1024 * 1024
chunk_size = (source.stat().st_size + 1) // 2
checksums = []
with source.open("rb") as stream:
    for number in (1, 2):
        archive = OUT / f"santa-radio-tracker-handover-part-{number}-of-2.zip"
        payload = stream.read(chunk_size)
        with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_STORED) as z:
            z.writestr(NAME + f".00{number}", payload)
            z.write(ROOT / "docs/tracker-handover/DOWNLOAD-INSTRUCTIONS.md", "DOWNLOAD-INSTRUCTIONS.md")
            z.write(ROOT / "docs/tracker-handover/ATTACH-BOTH-MESSAGE.txt", "PASTE-INTO-OTHER-PROJECT.txt")
            z.write(ROOT / "docs/tracker-handover/assemble-handover.py", "assemble-handover.py")
            z.write(OUT / (NAME + ".sha256"), NAME + ".sha256")
        if archive.stat().st_size > limit:
            raise RuntimeError("Delivery part exceeds the attachment limit.")
        with zipfile.ZipFile(archive) as z:
            if z.testzip() is not None:
                raise RuntimeError("Delivery ZIP CRC failed.")
        checksum = hashlib.sha256(archive.read_bytes()).hexdigest()
        checksums.append(f"{checksum}  {archive.name}")
        print(f"{archive.name}: {archive.stat().st_size} bytes; SHA-256 {checksum}")
    if stream.read(1):
        raise RuntimeError("Unpackaged data remains.")
(OUT / "DOWNLOAD-PARTS.sha256").write_text("\n".join(checksums) + "\n")
(OUT / "DOWNLOAD-PARTS-SHA256.txt").write_text("\n".join(checksums) + "\n")
print(f"Complete source ZIP retained unchanged: {NAME}")
