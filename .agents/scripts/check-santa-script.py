"""Render the supplied script for visual verification; generated images stay ignored."""
from pathlib import Path
import fitz

output = Path("generated-artifacts/extended-santa-script")
output.mkdir(parents=True, exist_ok=True)
with fitz.open("attached_assets/Santa_Script_1793021421721.pdf") as document:
    for index, page in enumerate(document):
        page.get_pixmap(matrix=fitz.Matrix(1.3, 1.3)).save(output / f"page-{index + 1}.png")
