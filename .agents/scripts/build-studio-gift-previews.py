"""Render the approved, recipient-free master; never edit the download source."""
from pathlib import Path
import io
import pymupdf
from PIL import Image

root = Path(__file__).resolve().parents[2]
document = pymupdf.open(root / "public/certificates/nice-list/master.pdf")
page = document[0]
assert "Santa Claus" in page.get_text()
pixmap = page.get_pixmap(matrix=pymupdf.Matrix(2, 2))
Image.open(io.BytesIO(pixmap.tobytes("png"))).convert("RGB").save(
    root / "public/certificates/examples/blank-master.webp", quality=92)
with Image.open(root / "attached_assets/santa-radio-letterhead_1793234026246.png") as image:
    image.convert("RGB").save(root / "public/images/santa-radio-letterhead.webp", quality=92)
    width, height = image.size
    image.crop((0, 0, width, round(width * .35))).convert("RGB").save(
        root / "public/images/santa-letter-header.webp", quality=92)
    image.crop((0, height - round(width * .32), width, height)).convert("RGB").save(
        root / "public/images/santa-letter-footer.webp", quality=92)
    image.crop((0, height // 2, width, height // 2 + 1)).convert("RGB").save(
        root / "public/images/santa-letter-sides.webp", lossless=True)
    print("Paper colour:", image.getpixel((width // 2, height // 2)))
print(page.get_text())
