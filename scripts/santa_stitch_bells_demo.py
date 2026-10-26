"""One offline extended demo with the owner's bells, based on the simple maker.

Run after santa_stitch_demo.py. Does not change either maker or hosted files.
Optional: --bells-gain-db 3 --output-dir generated-artifacts/extended-santa/bells-plus-3db
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import tempfile
import time

from santa_stitch_demo import ROOT, NAME, RATE, FRAME_BYTES, decode, prepare, ordered, \
    SELECTIONS, ffmpeg, floats, loudness


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bells-gain-db", type=float, default=0)
    parser.add_argument("--output-dir", type=Path)
    options = parser.parse_args()
    if not math.isfinite(options.bells_gain_db) or not -12 <= options.bells_gain_db <= 12:
        parser.error("Bells gain must be finite and between -12 and +12 dB")
    root = ROOT / "generated-artifacts/extended-santa"
    output = options.output_dir or root
    output.mkdir(parents=True, exist_ok=True)
    bells = ROOT / "attached_assets/sleigh-bells_1793024629484.mp3"
    target = output / "santa-recorded-message-for-Arabella.mp3"
    if target.exists():
        raise FileExistsError("Use a different output directory to retain earlier samples")
    previous = json.loads((root / "measurements.json").read_text())
    tick = time.perf_counter()
    order = ordered(SELECTIONS[0][1])
    prepared = {}
    for key in dict.fromkeys(order):
        source = NAME if key == "@arabella" else root / "sources" / key
        pcm = decode(source)
        prepared[key], _ = prepare(pcm)
        # Rebuild losslessly, avoiding another decode/re-encode of the old MP3.
        assert hashlib.sha256(prepared[key]).hexdigest() == \
            previous["sources"][key]["prepared_pcm_sha256"]
    speech = b"".join(prepared[key] for key in order)
    bell_pcm = decode(bells)
    voice_preparation_seconds = time.perf_counter() - tick
    # Match santa-audio-filters.mjs: bells -34 LUFS / -9 dBTP / LRA 7,
    # one-second entry and full-mix exit fades, non-normalising mix, 0.89 limiter.
    # Compensate lookahead so the limiter does not shift the voice timeline.
    graph = (
        "[1:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,"
        "loudnorm=I=-34:TP=-9:LRA=7,aresample=48000,"
        f"volume={options.bells_gain_db}dB,afade=t=in:d=1[bells];"
        "[0:a][bells]amix=inputs=2:duration=first:normalize=0,"
        "areverse,afade=t=in:d=1,areverse,"
        "alimiter=limit=0.89:level=false:latency=true[out]"
    )
    with tempfile.TemporaryDirectory(prefix="bells-", dir=root) as directory:
        voice = Path(directory) / "voice.f32"
        voice.write_bytes(speech)
        tick = time.perf_counter()
        mixed = ffmpeg([
            "-v", "error", "-filter_complex_threads", "1",
            "-f", "f32le", "-ar", str(RATE), "-ac", "2", "-i", str(voice),
            "-stream_loop", "-1", "-i", str(bells),
            "-filter_complex", graph, "-map", "[out]",
            "-ar", str(RATE), "-ac", "2", "-c:a", "pcm_f32le", "-f", "f32le", "pipe:1",
        ]).stdout
        assert len(mixed) == len(speech), "Mix must not shorten or extend speech"
        assert mixed != speech, "Bells must actually be mixed in"
        assert max(abs(value) for value in floats(mixed)) <= .891
        result = ffmpeg([
            "-v", "error", "-f", "f32le", "-ar", str(RATE), "-ac", "2", "-i", "pipe:0",
            "-map_metadata", "-1", "-c:a", "libmp3lame", "-threads", "1",
            "-b:a", "192k", "-ar", "44100", "-n", str(target),
        ], mixed)
        assert not result.stderr
        render_seconds = time.perf_counter() - tick
    final = decode(target)
    delta = (len(final) - len(speech)) / FRAME_BYTES / RATE
    assert abs(delta) <= 2 / 44100
    peak = max(abs(value) for value in floats(final))
    measurement = loudness(final)
    assert peak < 1 and float(measurement["input_tp"]) < -1.5
    report = {
        "file": target.name, "based_on": previous["samples"][0]["file"],
        "selections": previous["samples"][0]["selections"], "name": "Arabella, twice",
        "ordered_clips": order, "bells_source": bells.name,
        "bells_sha256": hashlib.sha256(bells.read_bytes()).hexdigest(),
        "bells_decoded_seconds": len(bell_pcm) / FRAME_BYTES / RATE,
        "bells_processing": "-34 LUFS, -9 dBTP, LRA 7; looped, 1s fade-in",
        "bells_gain_db_above_original": options.bells_gain_db,
        "mix_processing": "1s final fade-out, 0.89 peak limiter with compensated lookahead",
        "source_voice_seconds": len(speech) / FRAME_BYTES / RATE,
        "final_decoded_seconds": len(final) / FRAME_BYTES / RATE,
        "duration_delta_seconds": delta,
        "voice_preparation_seconds": voice_preparation_seconds,
        "mix_and_encode_seconds": render_seconds,
        "final_sample_peak_dbfs": 20 * math.log10(peak),
        "final_true_peak_dbtp": float(measurement["input_tp"]),
        "final_lufs": float(measurement["input_i"]),
        "decode_errors": [], "listened": False,
        "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
    }
    (output / "bells-measurements.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
