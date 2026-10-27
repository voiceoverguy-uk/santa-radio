"""Build the explicit, sanitised source handover; never reads environment secrets."""
import hashlib
import json
import pathlib
import re
import shutil
import subprocess
import zipfile
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "generated-artifacts/tracker-handover"
NAME = "santa-radio-current-source-tracker-handover-2026-10-27"
STAGE = OUT / NAME
tracked = subprocess.check_output(
    ["git", "ls-files", "-z"], cwd=ROOT
).decode().split("\0")
runtime_scripts = {
    "artwork-feed-plugin.mjs", "build-public-pages.mjs", "build-tracker-pages.mjs",
    "prepare-santa-audio.mjs", "santa-audio-filters.mjs", "santa-audio-recipe.mjs",
    "radio-history-collector.mjs", "render-santa-message.mjs",
}
root_files = {
    "index.html", "index.js", "package.json", "package-lock.json",
    "vite.config.js", "vercel.json", "playwright.config.js",
}
audio = {
    "server/santa-audio/free-intro.mp3", "server/santa-audio/free-outro-1.mp3",
    "server/santa-audio/free-outro-2.mp3", "server/santa-audio/sleighbells.mp3",
}

def allowed(p):
    return (
        p in root_files or p in audio
        or p.startswith("src/")
        or p.startswith("public/") and not p.startswith("public/downloads/")
        or p.startswith(("server/", "api/")) and p.endswith(".js")
        or p.startswith("database/") and p.endswith(".sql")
        or p.startswith("scripts/") and pathlib.PurePosixPath(p).name in runtime_scripts
        or p == "tests/santa-tracker.spec.js"
    )

selected = sorted(p for p in tracked if p and allowed(p))
for p in selected:
    file = ROOT / p
    if file.is_symlink() or not file.is_file():
        raise RuntimeError(f"Non-regular source file: {p}")
    if any(part in {"node_modules", ".git", ".cache", "dist", "test-results"} for part in file.relative_to(ROOT).parts):
        raise RuntimeError(f"Forbidden export path: {p}")
    if file.suffix.lower() in {".zip", ".log", ".sqlite", ".db", ".gz", ".tgz"} or file.name.startswith(".env"):
        raise RuntimeError(f"Forbidden export type: {p}")

if STAGE.exists():
    shutil.rmtree(STAGE)
STAGE.mkdir(parents=True)
for p in selected:
    dest = STAGE / p
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(ROOT / p, dest)

guide = ROOT / "docs/tracker-handover"
for source, dest in {
    "README.md": "README-TRACKER-HANDOVER.md",
    "TRACKER-GUIDE.md": "TRACKER-GUIDE.md",
    "RECEIVING-AGENT-MESSAGE.txt": "RECEIVING-AGENT-MESSAGE.txt",
    "VERIFICATION.md": "VERIFICATION.md",
    "check-tracker.cjs": "handover/check-tracker.cjs",
    "inspect-package.mjs": "handover/inspect-package.mjs",
    "check-browser.mjs": "handover/check-browser.mjs",
    "check-static-build.mjs": "handover/check-static-build.mjs",
}.items():
    target = STAGE / dest
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(guide / source, target)
for source in sorted((ROOT / "docs/santa-tracker-transfer").iterdir()):
    if source.name not in {"TRANSFER.md", "MANIFEST.json", "DEPENDENCIES.json", "VERIFICATION.txt", "INTEGRATION.md"}:
        continue
    target = STAGE / "historical-transfer" / source.name
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)

scope = {
    "snapshotUtc": datetime.now(timezone.utc).isoformat(),
    "sourcePolicy": "Allowlisted current working-tree files, copied unchanged; no uploaded tracker ZIP.",
    "includedOriginalPaths": selected,
    "publicData": "Intentionally published catalogues, biographies, publicity artwork, certificates and audio demos only; schema without records.",
    "excluded": [
        "All environment files, .replit configuration, credentials and secret values",
        "Repository history, agent memories, local tool configuration and task records",
        "Dependencies, builds, caches, prepared audio, logs and test artefacts",
        "Private database records, users, subscribers, staff identities, sessions and requests",
        "Local name recordings and generated greetings",
        "All attached_assets, temp_unzip, reports, old archives and public/downloads operational tools",
        "Unrelated import/editorial utilities and non-tracker tests",
    ],
}
(STAGE / "EXPORT-SCOPE.json").write_text(json.dumps(scope, indent=2) + "\n")

# Pattern-based static scan of shareable text, not a read of any secret store.
patterns = {
    "private key": r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
    "provider credential": r"\b(?:sk_(?:live|test)_[A-Za-z0-9]{12,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|xkeysib-[a-f0-9]{20,})",
    "credentialed database URL": r"postgres(?:ql)?://[^:\s/]+:[^@\s]+@",
    "hardcoded sensitive assignment": r"""(?i)(?:password|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*["'][^"'\n]{12,}["']""",
}
findings = []
for file in STAGE.rglob("*"):
    if not file.is_file():
        continue
    if file.suffix in {".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".json", ".md", ".txt", ".sql", ".html", ".css"}:
        text = file.read_text()
        for label, pattern in patterns.items():
            if re.search(pattern, text):
                findings.append({"path": str(file.relative_to(STAGE)), "category": label})
if findings:
    raise RuntimeError("Export blocked by static scan: " + json.dumps(findings))

manifest = []
for file in sorted(STAGE.rglob("*")):
    if file.is_file():
        content = file.read_bytes()
        manifest.append({
            "path": file.relative_to(STAGE).as_posix(),
            "bytes": len(content), "sha256": hashlib.sha256(content).hexdigest(),
        })
(STAGE / "FILE-MANIFEST.json").write_text(json.dumps({
    "algorithm": "SHA-256", "excludesSelf": True, "files": manifest,
}, indent=2) + "\n")
archive = OUT / f"{NAME}.zip"
with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for file in sorted(STAGE.rglob("*")):
        if file.is_file():
            z.write(file, f"{NAME}/{file.relative_to(STAGE).as_posix()}")
with zipfile.ZipFile(archive) as z:
    if z.testzip() is not None:
        raise RuntimeError("ZIP CRC verification failed")
    for entry in z.infolist():
        path = pathlib.PurePosixPath(entry.filename)
        if path.is_absolute() or ".." in path.parts or "\\" in entry.filename:
            raise RuntimeError("Unsafe ZIP path")
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
(OUT / f"{archive.name}.sha256").write_text(f"{digest}  {archive.name}\n")
print(json.dumps({
    "archive": str(archive.relative_to(ROOT)), "bytes": archive.stat().st_size,
    "sha256": digest, "sourceFiles": len(selected), "archiveFiles": len(manifest) + 1,
    "staticSecretPatternFindings": findings,
}, indent=2))
