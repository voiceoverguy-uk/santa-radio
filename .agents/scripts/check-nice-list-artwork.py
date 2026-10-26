"""Check preserved foreground and that examples use the actual current master."""
from io import BytesIO
from pathlib import Path
import math
import zipfile

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
assert master.xref_stream(master[0].get_contents()[0]) == original.xref_stream(original[0].get_contents()[0])
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
        assert master.extract_image(info["xref"]) == original.extract_image(info["xref"])

# Everything except the full-page image object must remain original, including
# vector paths, colours, opacity, fonts, signature, seal, metadata and page setup.
background_xrefs = {info["xref"] for info in master[0].get_image_info(xrefs=True)
                    if pymupdf.Rect(info["bbox"]).round() == master[0].rect.round()}
assert len(background_xrefs) == 1
assert master.xref_length() == original.xref_length()
# Saving canonicalises dictionary key order and single-item filter arrays.
# Compare through the same serializer, not the source's incidental syntax.
with pymupdf.open(stream=original.tobytes(deflate=True, no_new_id=True), filetype="pdf") as canonical:
    for xref in range(1, canonical.xref_length()):
        if xref not in background_xrefs:
            assert master.xref_object(xref) == canonical.xref_object(xref), xref
            if canonical.xref_is_stream(xref):
                assert master.xref_stream(xref) == canonical.xref_stream(xref), xref

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
