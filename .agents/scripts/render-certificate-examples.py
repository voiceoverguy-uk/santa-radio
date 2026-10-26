"""Render the supplied named examples without cropping or changing their artwork."""
from pathlib import Path
import fitz
from PIL import Image

output = Path("public/certificates/examples")
output.mkdir(parents=True, exist_ok=True)
for name in ("Edward", "Ayla"):
    source = next(Path("attached_assets").glob(f"Santa-Radio-Nice-List-Certificate-{name}_*.pdf"))
    with fitz.open(source) as document:
        page = document[0]
        pixmap = page.get_pixmap(matrix=fitz.Matrix(1800 / page.rect.width, 1800 / page.rect.width), alpha=False)
        image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
        image.save(output / f"{name.lower()}.webp", quality=85, method=6)
        print(name, image.size, (output / f"{name.lower()}.webp").stat().st_size)
