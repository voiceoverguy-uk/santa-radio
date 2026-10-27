"""Join the two lossless delivery chunks and verify the original source ZIP."""
import hashlib
import pathlib
import zipfile

HERE = pathlib.Path(__file__).resolve().parent
NAME = "santa-radio-current-source-tracker-handover-2026-10-27.zip"
expected, filename = (HERE / (NAME + ".sha256")).read_text().strip().split()
if filename != NAME or len(expected) != 64:
    raise SystemExit("Invalid checksum descriptor.")
target = HERE / NAME

def digest(file):
    h = hashlib.sha256()
    with file.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            h.update(chunk)
    return h.hexdigest()

if target.exists():
    if digest(target) != expected:
        raise SystemExit("A different ZIP already exists; move it before assembling.")
else:
    chunks = [HERE / (NAME + suffix) for suffix in (".001", ".002")]
    for chunk in chunks:
        if not chunk.is_file():
            raise SystemExit(f"Missing {chunk.name}; extract BOTH delivery ZIPs here.")
    temporary = HERE / (NAME + ".assembling")
    try:
        with temporary.open("xb") as dest:
            for chunk in chunks:
                with chunk.open("rb") as source:
                    while block := source.read(1024 * 1024):
                        dest.write(block)
        if digest(temporary) != expected:
            temporary.unlink()
            raise SystemExit("SHA-256 mismatch: download/extract both parts again.")
        temporary.rename(target)
    except FileExistsError:
        raise SystemExit("An unfinished .assembling file exists; inspect/remove it before retrying.")
with zipfile.ZipFile(target) as archive:
    if archive.testzip() is not None:
        raise SystemExit("ZIP integrity check failed.")
print(f"Verified complete source archive: {target.name}")
print(f"SHA-256: {expected}")
print("Extract it and read README-TRACKER-HANDOVER.md before adapting the tracker.")
