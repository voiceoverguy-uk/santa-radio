"""Build a self-contained before/after trial sheet from real personalised PDFs."""
import base64
from io import BytesIO
from pathlib import Path
import subprocess

import pymupdf
from PIL import Image

root = Path(__file__).resolve().parents[2]
output = root / "generated-artifacts/nice-list"
subprocess.run([
    "node", ".agents/scripts/personalise-certificate-examples.mjs",
    str(output / "before.pdf"), str(output / "before-examples"),
], cwd=root, check=True)
sections = []
for name in ("Edward", "Ayla"):
    figures = []
    for label, directory in (("Before", "before-examples"), ("After — 20% background fade", "examples")):
        with pymupdf.open(output / directory / f"{name.lower()}.pdf") as doc:
            page = doc[0]
            pix = page.get_pixmap(matrix=pymupdf.Matrix(1.5, 1.5), alpha=False)
            image = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
            image.save(output / f"{name.lower()}-{'before' if directory == 'before-examples' else 'after'}.png")
            buffer = BytesIO()
            image.save(buffer, format="WEBP", quality=90)
            data = base64.b64encode(buffer.getvalue()).decode()
            figures.append(f'<figure><figcaption>{label}</figcaption><img alt="{name}: {label}" src="data:image/webp;base64,{data}"></figure>')
    sections.append(f'<h2>{name}</h2><div class="pair">{"".join(figures)}</div>')
html = """<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nice List certificate — background trial</title>
<style>body{background:#102326;color:#fff8e7;font:17px system-ui;margin:24px}
h1{font-size:26px}p{max-width:850px;line-height:1.5}.pair{display:grid;grid-template-columns:1fr 1fr;gap:20px}
figure{margin:0}figcaption{margin-bottom:10px}img{width:100%;height:auto}
@media(max-width:800px){.pair{grid-template-columns:1fr}}</style>
<h1>Nice List certificate: 20% background fade</h1>
<p>Left: previous background. Right: 80% of that background blended with 20% of its existing deep dark teal.
The original gold wording, border, signature, seal and personalised name are unchanged.
These views come from the same local PDF personalisation used for downloads.</p>
""" + "".join(sections) + "</html>"
(output / "background-comparison.html").write_text(html)
print(output / "background-comparison.html")
