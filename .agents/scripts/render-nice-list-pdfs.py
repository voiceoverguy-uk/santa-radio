"""Render actual certificate downloads for visual checks (requires PyMuPDF)."""
from pathlib import Path
import pymupdf

directory = Path("generated-artifacts/nice-list")
directory.mkdir(parents=True, exist_ok=True)
expected_names = {
    "normal": "Olivia",
    "long": "Alexandria-Catherine Elizabeth Montgomery-Worthington",
    "unicode": "Élodie O’Neill-Sáenz",
    "two-first": "Olivia",
    "two-second": "Élodie O’Neill-Sáenz",
    "saved-audio": "Arabella",
}
master = pymupdf.open("public/certificates/nice-list/master.pdf")
master_pix = master[0].get_pixmap(matrix=pymupdf.Matrix(1.5, 1.5))
master_text = master[0].get_text()
for path in directory.glob("*.pdf"):
    with pymupdf.open(path) as doc:
        assert len(doc) == 1
        page = doc[0]
        assert abs(page.rect.width - 297 * 72 / 25.4) < .1
        assert abs(page.rect.height - 210 * 72 / 25.4) < .1
        pix = page.get_pixmap(matrix=pymupdf.Matrix(1.5, 1.5))
        pix.save(path.with_suffix(".png"))
        if path.stem in expected_names:
            name = expected_names[path.stem]
            assert page.get_text().removesuffix(name + "\n") == master_text
            assert doc.metadata == master.metadata | {"format": "PDF 1.7"}
            # Every pixel outside the approved name safe area stays identical.
            expected = master_pix.samples
            actual = pix.samples
            left, right = 38 * 72 / 25.4 * 1.5, 259 * 72 / 25.4 * 1.5
            top, bottom = 77 * 72 / 25.4 * 1.5, 101 * 72 / 25.4 * 1.5
            for y in range(pix.height):
                row_start = y * pix.stride
                if top - 1 <= y <= bottom + 1:
                    for start, end in [(0, int(left) - 1), (int(right) + 2, pix.width)]:
                        assert actual[row_start + start * 3:row_start + end * 3] == expected[row_start + start * 3:row_start + end * 3]
                else:
                    assert actual[row_start:row_start + pix.stride] == expected[row_start:row_start + pix.stride]
            # The actual added font must contain drawable glyphs for every
            # visible character, not just a correct ToUnicode extraction map.
            font_info = next(info for info in page.get_fonts() if "CertificateSerif" in info[3] and info[2] == "Type0")
            embedded = pymupdf.Font(fontbuffer=doc.extract_font(font_info[0])[3])
            for char in name:
                if not char.isspace():
                    glyph = embedded.has_glyph(ord(char))
                    assert glyph, (path, char, "missing embedded glyph")
                    assert embedded.glyph_bbox(ord(char)).get_area() > 0, (path, char)
        print(path.name, page.rect, repr(page.get_text()), doc.metadata)
