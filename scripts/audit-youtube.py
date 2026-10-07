"""Read-only catalogue audit. oEmbed availability is not a playback guarantee."""
import concurrent.futures
import datetime
import json
import pathlib
import time
import urllib.error
import urllib.request

root = pathlib.Path(__file__).resolve().parents[1]
songs = json.loads((root / "src/data/songs.json").read_text())
ids = sorted({s["youtube"] for s in songs if s.get("youtube")})


def check(video):
    url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video}&format=json"
    result = {"video": video}
    for attempt in range(2):
        try:
            with urllib.request.urlopen(url, timeout=20) as response:
                data = json.load(response)
                return {**result, "status": "metadata_available", "http": 200,
                        "title": data.get("title"), "channel": data.get("author_name")}
        except urllib.error.HTTPError as error:
            result.update(http=error.code, status="needs_review" if error.code in (400, 401, 403, 404, 410) else "inconclusive")
        except Exception as error:
            result.update(status="inconclusive", error=type(error).__name__)
        time.sleep(1)
    return result


with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    results = list(pool.map(check, ids))
for result in results:
    result["pages"] = [
        {"artist": s["artist"], "song": s["song"],
         "path": f"/christmas-artist/{s['id']}-{s['link']}"}
        for s in songs if s.get("youtube") == result["video"]
    ]
report = {
    "checkedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "method": "YouTube oEmbed; failed requests retried once. Metadata availability does not prove playback or regional/embed permission. Failures require review, not automatic removal.",
    "songCount": len(songs), "uniqueVideos": len(ids),
    "results": results,
}
out = root / "docs/editorial/youtube-audit.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps({status: sum(r["status"] == status for r in results)
                  for status in ("metadata_available", "needs_review", "inconclusive")}))
