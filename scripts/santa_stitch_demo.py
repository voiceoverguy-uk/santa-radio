"""Offline proof only. Never imported by the maker; never writes hosted audio.

Usage: python3 scripts/santa_stitch_demo.py [output-directory]
Requires Python's standard library, ffmpeg and ffprobe on PATH.
"""
import array
import hashlib
import json
import math
from pathlib import Path, PurePosixPath
import shutil
import stat
import subprocess
import sys
import time
import zipfile

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "attached_assets/test_stitch_1793023789241.zip"
NAME = ROOT / "server/santa-audio/names/arabella.wav"
PUBLIC_ROOT = "https://stagcommunications.com/santaradio/names/personalised-message/"
RATE = 48000
FRAME_BYTES = 8  # float32 stereo
SELECTIONS = [
    ("sample-1", ["AGES/9-year.wav", "Trying Hard at/teamwork.wav",
                  "Achievment/completing-a-jigsaw-puzzle.wav", "treats/buche-de-noel.wav",
                  "countries/the-enchanted-forest.wav"]),
    ("sample-2", ["AGES/13-year.wav", "Trying Hard at/playing-your-musical-instrument.wav",
                  "Achievment/planting-and-caring-for-a-garden.wav", "treats/turron.wav",
                  "countries/camelot.wav"]),
]


def audio_members(archive):
    """Validate the entire archive before returning audio entries to extract."""
    members, seen, total = [], set(), 0
    for entry in archive.infolist():
        path = PurePosixPath(entry.filename)
        mode = entry.external_attr >> 16
        if (path.is_absolute() or ".." in path.parts or "\\" in entry.filename
                or ":" in entry.filename or "\0" in entry.filename or stat.S_ISLNK(mode)):
            raise ValueError(f"Unsafe archive entry: {entry.filename!r}")
        if entry.is_dir() or any(p.startswith(".") or p == "__MACOSX" for p in path.parts):
            continue
        if path.suffix.lower() not in (".wav", ".mp3"):
            continue
        if len(path.parts) < 2 or path.parts[0] != "test stitch":
            raise ValueError("Audio outside expected archive root")
        relative = Path(*path.parts[1:])
        if relative in seen or entry.file_size > 10 * 1024**2:
            raise ValueError("Duplicate or oversized audio")
        seen.add(relative)
        total += entry.file_size
        if total > 50 * 1024**2:
            raise ValueError("Archive audio exceeds extraction budget")
        members.append((entry, relative))
    return members


def extract_audio(archive_path, destination):
    with zipfile.ZipFile(archive_path) as archive:
        members = audio_members(archive)
        for entry, relative in members:
            target = destination / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            # No overwrite and no filename reinterpretation/renaming.
            with archive.open(entry) as source, target.open("xb") as output:
                shutil.copyfileobj(source, output)
        return [relative.as_posix() for _, relative in members]


def ffmpeg(args, data=None):
    result = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostdin", "-threads", "1",
         "-filter_threads", "1", *args],
        input=data, capture_output=True, timeout=120, check=False,
    )
    if result.returncode:
        raise RuntimeError(result.stderr.decode(errors="replace"))
    return result


def decode(path):
    result = ffmpeg(["-v", "error", "-xerror", "-err_detect", "explode",
                     "-protocol_whitelist", "file,pipe", "-i", str(path),
                     "-map", "0:a:0", "-vn", "-sn", "-dn", "-ar", str(RATE),
                     "-ac", "2", "-c:a", "pcm_f32le", "-f", "f32le", "pipe:1"])
    if result.stderr or not result.stdout or len(result.stdout) % FRAME_BYTES:
        raise ValueError(f"Decode warnings/invalid PCM: {path.name}: {result.stderr!r}")
    return result.stdout


def floats(pcm):
    values = array.array("f")
    values.frombytes(pcm)
    if sys.byteorder != "little":
        values.byteswap()
    if not all(math.isfinite(value) for value in values):
        raise ValueError("Nonfinite PCM")
    return values


def loudness(pcm):
    result = ffmpeg(["-v", "info", "-f", "f32le", "-ar", str(RATE), "-ac", "2",
                     "-i", "pipe:0", "-af", "loudnorm=I=-18:TP=-3:LRA=11:print_format=json",
                     "-f", "null", "-"], pcm)
    text = result.stderr.decode()
    return json.loads(text[text.rfind("{"):text.rfind("}") + 1])


def scaled(pcm, gain_db):
    values = floats(pcm)
    factor = 10 ** (gain_db / 20)
    for index in range(len(values)):
        values[index] *= factor
    if sys.byteorder != "little":
        values.byteswap()
    return values.tobytes()


def prepare(pcm):
    measurement = loudness(pcm)
    integrated = float(measurement["input_i"])
    true_peak = float(measurement["input_tp"])
    if not math.isfinite(integrated) or not math.isfinite(true_peak):
        raise ValueError("Silent/unmeasurable source")
    # Constant gain only: no dynamics, fades, trimming, padding or limiter latency.
    gain = min(-18 - integrated, -3 - true_peak)
    prepared = scaled(pcm, gain)
    assert len(prepared) == len(pcm)
    values = floats(pcm)
    return prepared, {
        "frames": len(pcm) // FRAME_BYTES,
        "seconds": len(pcm) / FRAME_BYTES / RATE,
        "input_lufs": integrated, "input_true_peak_dbtp": true_peak,
        "gain_db": round(gain, 4),
        "input_sample_peak": max(abs(value) for value in values),
        "input_full_scale_samples": sum(abs(value) >= 1 for value in values),
        "source_pcm_sha256": hashlib.sha256(pcm).hexdigest(),
        "prepared_pcm_sha256": hashlib.sha256(prepared).hexdigest(),
    }


def ordered(selection):
    age, activity, achievement, treat, location = selection
    return ["free-intro.mp3", "@arabella", "1st.wav", age, "2nd.wav", activity,
            achievement, "3rd.wav", treat, "4th.wav", location, "5th.wav",
            "@arabella", "6th.wav"]


def main(output):
    # Fresh isolated directory required, avoiding stale inputs and overwrites.
    output.mkdir(parents=True, exist_ok=False)
    start = time.perf_counter()
    sources = output / "sources"
    files = extract_audio(ARCHIVE, sources)
    if len(files) != 28:
        raise ValueError(f"Expected 28 audio files, found {len(files)}")
    prepared, source_report = {}, {}
    for key in [*files, "@arabella"]:
        path = NAME if key == "@arabella" else sources / key
        pcm = decode(path)
        prepared[key], source_report[key] = prepare(pcm)
        source_report[key]["file_sha256"] = hashlib.sha256(path.read_bytes()).hexdigest()
    report = {"public_source_root": PUBLIC_ROOT, "archive_audio_count": len(files),
              "name": "Arabella (existing local recording; not a child's supplied details)",
              "processing": "48 kHz stereo float PCM; constant per-clip gain towards -18 LUFS, "
                            "capped at -3 dBTP; plain concatenation; voice only; MP3 192k/44.1k stereo",
              "listened": False, "decoding_errors": [], "sources": source_report, "samples": []}
    for label, selection in SELECTIONS:
        tick = time.perf_counter()
        order = ordered(selection)
        pcm = b"".join(prepared[key] for key in order)
        expected_frames = sum(source_report[key]["frames"] for key in order)
        assert len(pcm) == expected_frames * FRAME_BYTES
        boundaries, cursor = [], 0
        for key in order:
            segment = prepared[key]
            assert pcm[cursor:cursor + len(segment)] == segment
            boundaries.append({"clip": key, "start_seconds": cursor / FRAME_BYTES / RATE,
                               "end_seconds": (cursor + len(segment)) / FRAME_BYTES / RATE})
            cursor += len(segment)
        target = output / f"extended-santa-{label}.mp3"
        result = ffmpeg(["-v", "error", "-f", "f32le", "-ar", str(RATE), "-ac", "2",
                         "-i", "pipe:0", "-map_metadata", "-1", "-codec:a", "libmp3lame",
                         "-threads", "1", "-b:a", "192k", "-ar", "44100", "-n", str(target)], pcm)
        assert not result.stderr
        render_seconds = time.perf_counter() - tick
        decoded = decode(target)
        duration_delta = (len(decoded) - len(pcm)) / FRAME_BYTES / RATE
        # MP3 encoder priming/padding removed by decoder gapless metadata.
        assert abs(duration_delta) <= 2 / 44100, duration_delta
        measured = loudness(decoded)
        peak = max(abs(value) for value in floats(decoded))
        assert peak < 1 and float(measured["input_tp"]) <= -2
        probe = json.loads(subprocess.check_output(
            ["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(target)]))
        stream = probe["streams"][0]
        assert stream["codec_name"] == "mp3" and stream["sample_rate"] == "44100"
        assert stream["channels"] == 2 and stream["bit_rate"] == "192000"
        report["samples"].append({
            "file": target.name, "selections": dict(zip(
                ["age", "activity", "achievement", "treat", "location"], selection)),
            "ordered_clips": order, "boundaries": boundaries,
            "source_duration_seconds": expected_frames / RATE,
            "decoded_duration_seconds": len(decoded) / FRAME_BYTES / RATE,
            "duration_delta_seconds": duration_delta, "render_seconds": render_seconds,
            "decoded_sample_peak_dbfs": 20 * math.log10(peak),
            "decoded_true_peak_dbtp": float(measured["input_tp"]),
            "decoded_integrated_lufs": float(measured["input_i"]),
            "container_duration_seconds": float(probe["format"]["duration"]),
            "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
        })
    report["total_preparation_render_and_verification_seconds"] = time.perf_counter() - start
    (output / "measurements.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({key: report[key] for key in
                      ["archive_audio_count", "decoding_errors", "samples",
                       "total_preparation_render_and_verification_seconds"]}, indent=2))


if __name__ == "__main__":
    main(Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "generated-artifacts/extended-santa")
