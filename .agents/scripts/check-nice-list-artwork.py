"""Allow only approved logo/title edits; protect all other artwork and examples."""
from io import BytesIO
from pathlib import Path
import math
import zipfile
import subprocess
import tempfile
import re

import pymupdf
from PIL import Image, ImageChops, ImageStat, ImageOps

root = Path(__file__).resolve().parents[2]
with zipfile.ZipFile(root / "attached_assets/Santa-Radio-Nice-List-Editable-Pack_1792688054818.zip") as archive:
    original = pymupdf.open(stream=archive.read(
        "Santa-Radio-Nice-List-Editable-Pack/Santa-Radio-Nice-List-A4.pdf"), filetype="pdf")
master = pymupdf.open(root / "public/certificates/nice-list/master.pdf")
assert len(master) == 1 and master[0].rect == original[0].rect
assert master[0].get_text() == original[0].get_text()
assert master.metadata == original.metadata
source_content = original.xref_stream(original[0].get_contents()[0])
logo = b"q\n187.0866 0 0 63.90237 327.4016 491.6882 cm\n/FormXob.f1e46eefde6d0d719a564ec74673f77e Do\nQ\n"
old_title = b"BT 1 0 0 1 229.4569 447.874 Tm /F2+0 34 Tf 40.8 TL (Official Nice List Certificate) Tj T* ET"
new_title = b"BT 1 0 0 1 195.6649 480 Tm /F2+0 40 Tf 48 TL (Official Nice List Certificate) Tj T* ET"
assert source_content.count(logo) == source_content.count(old_title) == 1
assert master.xref_stream(master[0].get_contents()[0]) == source_content.replace(logo, b"").replace(old_title, new_title)
title = next(span for block in master[0].get_text("dict", flags=0)["blocks"]
             for line in block["lines"] for span in line["spans"]
             if span["text"] == "Official Nice List Certificate")
assert title["size"] == 40 and title["color"] == 0xf1d995
assert abs((title["bbox"][0] + title["bbox"][2]) / 2 - master[0].rect.width / 2) < .01
assert title["bbox"][1] > 31.2 and title["bbox"][3] < 161.5
for info in master[0].get_image_info(xrefs=True):
    if pymupdf.Rect(info["bbox"]).round() == master[0].rect.round():
        image = Image.open(BytesIO(master.extract_image(info["xref"])["image"])).convert("RGB")
        # Independently reconstruct the approved pre-trial treatment, then check
        # every background pixel: 80% old scene + 20% existing deep dark teal.
        size = (1782, 1260)
        with Image.open(root / "public/images/north-pole-hero.webp") as hero:
            before = ImageOps.fit(hero.convert("RGB"), size, Image.Resampling.LANCZOS,
                                  centering=(.5, 1))
        overlay = Image.new("RGBA", size)
        pixels = overlay.load()
        for y in range(size[1]):
            lettering = math.exp(-((y / size[1] - .63) / .32) ** 8)
            for x in range(size[0]):
                centre = math.exp(-((x / size[0] - .5) / .34) ** 6)
                pixels[x, y] = (2, 20, 23, round(255 * (.20 + .24 * centre * lettering)))
        before = Image.alpha_composite(before.convert("RGBA"), overlay).convert("RGB")
        expected = Image.blend(before, Image.new("RGB", size, (2, 20, 23)), .20)
        assert image.size == size
        assert ImageChops.difference(image, expected).getbbox() is None, "Background must retain exactly 80% of the prior scene"
        print("Exact 20% dark-teal background blend verified")
        # The old opaque left extension had no variation. Check multiple
        # regions, away from foreground lettering and the gold border.
        for box in [(0, 0, .25, .35), (0, .35, .25, .7), (0, .7, .25, 1)]:
            bounds = tuple(round(v * image.size[i % 2]) for i, v in enumerate(box))
            before_detail = max(ImageStat.Stat(before.crop(bounds)).stddev)
            after_detail = max(ImageStat.Stat(image.crop(bounds)).stddev)
            assert before_detail > 8, "Lost original left-hand landscape detail"
            # A uniform 20% blend reduces variation by 20% too. Allow only
            # 8-bit pixel rounding, not loss of the snowy scene.
            assert abs(after_detail - .8 * before_detail) < .5, "Lost left-hand landscape detail"
    else:
        raise AssertionError("No image placements except the full-bleed background are authorised")

# Everything except the background and the exact two stream edits stays original.
background_xrefs = {info["xref"] for info in master[0].get_image_info(xrefs=True)
                    if pymupdf.Rect(info["bbox"]).round() == master[0].rect.round()}
assert len(background_xrefs) == 1
assert master.xref_length() == original.xref_length()
# Saving canonicalises dictionary key order and single-item filter arrays.
# Compare through the same serializer, not the source's incidental syntax.
with pymupdf.open(stream=original.tobytes(deflate=True, no_new_id=True), filetype="pdf") as canonical:
    for xref in range(1, canonical.xref_length()):
        if xref not in background_xrefs | set(master[0].get_contents()):
            assert master.xref_object(xref) == canonical.xref_object(xref), xref
            if canonical.xref_is_stream(xref):
                assert master.xref_stream(xref) == canonical.xref_stream(xref), xref

names_source = (root / "src/lib/santaCertificateExamples.js").read_text()
names = re.findall(r"'([A-Z][a-z]+)'", names_source.split("];")[0])
assert len(names) == 11
for name in names:
    with pymupdf.open(root / f"generated-artifacts/certificate-examples/{name.lower()}.pdf") as example:
        assert re.fullmatch(re.escape(master[0].get_text() + name + "\n") +
                            r"Based on behaviour this year, you are awarded (?:7[5-9]|8[0-9]|9[0-5])% Nice status!\n",
                            example[0].get_text())
        status = next(span for block in example[0].get_text("dict", flags=0)["blocks"]
                      for line in block["lines"] for span in line["spans"]
                      if span["text"].startswith("Based on behaviour"))
        assert status["font"] == title["font"] and status["color"] == title["color"]
        assert status["bbox"][1] > title["bbox"][3] + 3
        assert status["bbox"][3] < 161.5 - 3
        assert abs((status["bbox"][0] + status["bbox"][2]) / 2 - master[0].rect.width / 2) < .01
        assert example[0].rect == master[0].rect
        # pdf-lib wraps the unchanged master stream, then appends the name.
        streams = [example.xref_stream(xref) for xref in example[0].get_contents()]
        assert master.xref_stream(master[0].get_contents()[0]) in streams
        assert example.metadata == master.metadata | {"format": "PDF 1.7"}
        with tempfile.TemporaryDirectory() as directory:
            stem = str(Path(directory) / name)
            subprocess.run(["pdftoppm", "-singlefile", "-scale-to-x", "1800", "-scale-to-y", "-1",
                            "-png", str(root / f"generated-artifacts/certificate-examples/{name.lower()}.pdf"), stem], check=True)
            subprocess.run(["cwebp", "-quiet", "-q", "85", stem + ".png", "-o", stem + ".webp"], check=True)
            assert Path(stem + ".webp").read_bytes() == (root / f"public/certificates/examples/{name.lower()}.webp").read_bytes()
        print(f"{name}: preview matches browser-personalised PDF exactly")
print("Only authorised logo/title changes; other foreground, metadata and snowy background verified")
