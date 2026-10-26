"""Regenerate examples from the current master using the real download flow.

Run from the repository root. Original uploaded examples are never read/written.
"""
from pathlib import Path
import subprocess
import pymupdf
from PIL import Image

subprocess.run(["node", ".agents/scripts/personalise-certificate-examples.mjs"], check=True)
output = Path("public/certificates/examples")
output.mkdir(parents=True, exist_ok=True)
for name in ("Edward", "Ayla"):
    source = Path(f"generated-artifacts/nice-list/examples/{name.lower()}.pdf")
    with pymupdf.open(source) as document:
        page = document[0]
        pixmap = page.get_pixmap(matrix=pymupdf.Matrix(1800 / page.rect.width, 1800 / page.rect.width), alpha=False)
        image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
        image.save(output / f"{name.lower()}.webp", quality=85, method=6)
        print(name, image.size, (output / f"{name.lower()}.webp").stat().st_size)
