"""Replace only the supplied PDF's background, preserving its vector foreground.

Run from the repository root with Python, Pillow and PyMuPDF installed.
The original editable-pack upload is read-only; no font/layout recreation.
"""
from pathlib import Path
import math
import zipfile

import pymupdf
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "generated-artifacts/nice-list"
OUTPUT.mkdir(parents=True, exist_ok=True)
PACK = ROOT / "attached_assets/Santa-Radio-Nice-List-Editable-Pack_1792688054818.zip"
SOURCE_PDF = "Santa-Radio-Nice-List-Editable-Pack/Santa-Radio-Nice-List-A4.pdf"
DARK_TEAL = (2, 20, 23)
BACKGROUND_FADE = .20

with zipfile.ZipFile(PACK) as archive:
    document = pymupdf.open(stream=archive.read(SOURCE_PDF), filetype="pdf")
page = document[0]
original_text = page.get_text()
original_content = document.xref_stream(page.get_contents()[0])
original_metadata = document.metadata
# Identify the full-bleed image by its placement, not an unstable object number.
backgrounds = [
    info for info in page.get_image_info(xrefs=True)
    if pymupdf.Rect(info["bbox"]).round() == page.rect.round()
]
assert len(backgrounds) == 1
background = backgrounds[0]
size = (1782, 1260)
with Image.open(ROOT / "public/images/north-pole-hero.webp") as hero:
    # Bottom-align a proportional A4 landscape crop. This keeps the snowy
    # foreground on BOTH sides rather than spending half the page on the sky.
    scene = ImageOps.fit(hero.convert("RGB"), size, Image.Resampling.LANCZOS,
                         centering=(.5, 1))

# A translucent, symmetric contrast treatment, never an opaque side extension.
# Even the strongest part retains most of the underlying scenery.
overlay = Image.new("RGBA", size)
pixels = overlay.load()
for y in range(size[1]):
    yy = y / size[1]
    for x in range(size[0]):
        xx = x / size[0]
        centre = math.exp(-((xx - .5) / .34) ** 6)
        lettering = math.exp(-((yy - .63) / .32) ** 8)
        alpha = .20 + .24 * centre * lettering
        pixels[x, y] = (*DARK_TEAL, round(255 * alpha))
scene = Image.alpha_composite(scene.convert("RGBA"), overlay).convert("RGB")
# Reproduce the pre-trial master for comparison; never fade an already-faded
# master. Only the raster background changes, not any foreground PDF objects.
scene.save(OUTPUT / "snowy-background-before.png")
document.update_object(background["xref"],
                       f"<</Type /XObject /Subtype /Image /Width {size[0]} "
                       f"/Height {size[1]} /ColorSpace /DeviceRGB /BitsPerComponent 8>>")
document.update_stream(background["xref"], scene.tobytes(), compress=True)
document.save(OUTPUT / "before.pdf", deflate=True, no_new_id=True)
scene = Image.blend(scene, Image.new("RGB", size, DARK_TEAL), BACKGROUND_FADE)
scene.save(OUTPUT / "snowy-background.png")
# Replace the image object's data directly: this leaves the original page
# stream (all text, strokes and seal paths) byte-for-byte unchanged.
document.update_object(background["xref"],
                       f"<</Type /XObject /Subtype /Image /Width {size[0]} "
                       f"/Height {size[1]} /ColorSpace /DeviceRGB /BitsPerComponent 8>>")
document.update_stream(background["xref"], scene.tobytes(), compress=True)
assert document.xref_stream(page.get_contents()[0]) == original_content
assert page.get_text() == original_text
assert document.metadata == original_metadata
target = ROOT / "public/certificates/nice-list/master.pdf"
document.save(target, deflate=True, no_new_id=True)
document.close()
with pymupdf.open(target) as result:
    assert len(result) == 1
    assert abs(result[0].rect.width - 297 * 72 / 25.4) < .1
    assert abs(result[0].rect.height - 210 * 72 / 25.4) < .1
    assert result[0].get_text() == original_text
    assert result.metadata == original_metadata
    assert result.xref_stream(result[0].get_contents()[0]) == original_content
    result[0].get_pixmap(matrix=pymupdf.Matrix(1.5, 1.5)).save(OUTPUT / "blank.png")
print(f"Rebuilt {target.relative_to(ROOT)}; original foreground preserved")
