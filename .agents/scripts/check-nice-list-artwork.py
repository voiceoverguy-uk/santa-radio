"""Check preserved foreground and that examples use the actual current master."""
from io import BytesIO
from pathlib import Path
import zipfile

import pymupdf
from PIL import Image, ImageChops, ImageStat

root = Path(__file__).resolve().parents[2]
with zipfile.ZipFile(root / "attached_assets/Santa-Radio-Nice-List-Editable-Pack_1792688054818.zip") as archive:
    original = pymupdf.open(stream=archive.read(
        "Santa-Radio-Nice-List-Editable-Pack/Santa-Radio-Nice-List-A4.pdf"), filetype="pdf")
master = pymupdf.open(root / "public/certificates/nice-list/master.pdf")
assert master[0].get_text() == original[0].get_text()
assert master.metadata == original.metadata
assert master.xref_stream(master[0].get_contents()[0]) == original.xref_stream(original[0].get_contents()[0])
for info in master[0].get_image_info(xrefs=True):
    if pymupdf.Rect(info["bbox"]).round() == master[0].rect.round():
        image = Image.open(BytesIO(master.extract_image(info["xref"])["image"])).convert("RGB")
        # The old opaque left extension had no variation. Check multiple
        # regions, away from foreground lettering and the gold border.
        for box in [(0, 0, .25, .35), (0, .35, .25, .7), (0, .7, .25, 1)]:
            crop = image.crop(tuple(round(v * image.size[i % 2]) for i, v in enumerate(box)))
            assert max(ImageStat.Stat(crop).stddev) > 8, "Lost left-hand landscape detail"
    else:
        assert master.extract_image(info["xref"]) == original.extract_image(info["xref"])

for name in ("Edward", "Ayla"):
    with pymupdf.open(root / f"generated-artifacts/nice-list/examples/{name.lower()}.pdf") as example:
        assert example[0].get_text() == master[0].get_text() + name + "\n"
        page = example[0]
        pix = page.get_pixmap(matrix=pymupdf.Matrix(1800 / page.rect.width, 1800 / page.rect.width), alpha=False)
        expected = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        webp = BytesIO()
        expected.save(webp, format="WEBP", quality=85, method=6)
        assert webp.getvalue() == (root / f"public/certificates/examples/{name.lower()}.webp").read_bytes()
        print(f"{name}: preview matches browser-personalised PDF exactly")
print("Original vector foreground, metadata and full snowy background verified")
