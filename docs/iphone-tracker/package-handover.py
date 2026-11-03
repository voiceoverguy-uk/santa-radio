"""Make a bounded, inspected handover ZIP; no repository-wide recursion."""
from pathlib import Path
import hashlib
import sys
import zipfile

source = Path(sys.argv[1]).resolve()
target = Path(sys.argv[2]).resolve()
allowed_dirs = {"src", "scripts", "reference", "dist"}
allowed_files = {
    "README.md", "RECEIVING-DEVELOPER.txt", "VERIFICATION.md", "SOURCE-MANIFEST.json",
    "package.json", "package-lock.json", "tsconfig.json", "vite.config.js",
    "index.html", ".gitignore",
}
files = []
for item in sorted(source.iterdir()):
    if item.name in allowed_files and item.is_file():
        files.append(item)
    elif item.name in allowed_dirs and item.is_dir():
        files.extend(p for p in sorted(item.rglob("*")) if p.is_file())
for file in files:
    relative = file.relative_to(source)
    if file.is_symlink() or any(part in {"node_modules", ".git", ".cache"} or part.startswith(".env") for part in relative.parts):
        raise SystemExit(f"Forbidden path: {relative}")
    if file.suffix in {".zip", ".tgz", ".log"}:
        raise SystemExit(f"Forbidden generated input: {relative}")
manifest = "\n".join(
    f"{hashlib.sha256(file.read_bytes()).hexdigest()}  {file.relative_to(source).as_posix()}" for file in files
) + "\n"
(source / "FILE-MANIFEST.sha256").write_text(manifest)
files.append(source / "FILE-MANIFEST.sha256")
target.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for file in files:
        archive.write(file, "santa-radio-iphone-tracker/" + file.relative_to(source).as_posix())
with zipfile.ZipFile(target) as archive:
    if archive.testzip():
        raise SystemExit("ZIP integrity failure")
if target.stat().st_size >= 100 * 1024 * 1024:
    raise SystemExit("Archive exceeds 100 MiB")
digest = hashlib.sha256(target.read_bytes()).hexdigest()
target.with_suffix(".zip.sha256").write_text(f"{digest}  {target.name}\n")
print(f"{len(files)} files; {target.stat().st_size:,} bytes")
print(f"SHA-256 {digest}")
