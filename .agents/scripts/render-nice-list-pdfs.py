"""Render actual certificate downloads for visual checks (requires PyMuPDF)."""
from pathlib import Path
import pymupdf
import re

directory = Path("generated-artifacts/nice-list")
directory.mkdir(parents=True, exist_ok=True)
expected_names = {
    "normal": "Olivia",
    "long": "Alexandria-Catherine Elizabeth Montgomery-Worthington",
    "unicode": "Élodie O’Neill-Sáenz",
    "apostrophe": "Jean-Luc D'Ávila",
    "whitespace": "Olivia   Rose",
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
            assert re.fullmatch(re.escape(master_text + name + "\n") +
                                r"Based on behaviour this year, you are awarded (?:7[5-9]|8[0-9]|9[0-5])% Nice status!\n",
                                page.get_text())
            status = next(span for block in page.get_text("dict", flags=0)["blocks"]
                          for line in block["lines"] for span in line["spans"]
                          if span["text"].startswith("Based on behaviour"))
            assert status["font"] == "CertificateSerif-Regular"
            assert status["color"] == 0xf1d995
            assert 130 < status["bbox"][1] < status["bbox"][3] < 158
            assert abs((status["bbox"][0] + status["bbox"][2]) / 2 - page.rect.width / 2) < .01
            assert doc.metadata == master.metadata | {"format": "PDF 1.7"}
            # Every pixel outside the approved name safe area stays identical.
            expected = master_pix.samples
            actual = pix.samples
            changed_x, changed_y = [], []
            left, right = 38 * 72 / 25.4 * 1.5, 259 * 72 / 25.4 * 1.5
            top, bottom = 77 * 72 / 25.4 * 1.5, 101 * 72 / 25.4 * 1.5
            for y in range(pix.height):
                row_start = y * pix.stride
                for x in range(pix.width):
                    offset = row_start + x * 3
                    if top - 1 <= y <= bottom + 1 and actual[offset:offset + 3] != expected[offset:offset + 3]:
                        changed_x.append(x)
                        changed_y.append(y)
                if status["bbox"][1] * 1.5 - 1 <= y <= status["bbox"][3] * 1.5 + 1:
                    # Only the centred subtitle bounds may differ on these rows.
                    start, end = int(status["bbox"][0] * 1.5) - 1, int(status["bbox"][2] * 1.5) + 2
                    assert actual[row_start:row_start + start * 3] == expected[row_start:row_start + start * 3]
                    assert actual[row_start + end * 3:row_start + pix.stride] == expected[row_start + end * 3:row_start + pix.stride]
                elif top - 1 <= y <= bottom + 1:
                    for start, end in [(0, int(left) - 1), (int(right) + 2, pix.width)]:
                        assert actual[row_start + start * 3:row_start + end * 3] == expected[row_start + start * 3:row_start + end * 3]
                else:
                    assert actual[row_start:row_start + pix.stride] == expected[row_start:row_start + pix.stride]
            assert changed_x, (path, "name must actually render")
            assert abs((min(changed_x) + max(changed_x)) / 2 - pix.width / 2) < 2, (path, "ink is centred")
            assert min(changed_y) >= top - 1 and max(changed_y) <= bottom + 1
            spans = [span for block in page.get_text("dict")["blocks"] if block["type"] == 0
                     for line in block["lines"] for span in line["spans"]
                     if "GreatVibes" in span["font"] and 77 * 72 / 25.4 <= span["origin"][1] <= 101 * 72 / 25.4]
            assert spans and all(0 < span["size"] <= 22.6 * 72 / 25.4 + .01 for span in spans)
            if path.stem in ("normal", "two-first", "saved-audio"):
                assert abs(spans[0]["size"] - 22.6 * 72 / 25.4) < .01
            # The actual added font must contain drawable glyphs for every
            # visible character, not just a correct ToUnicode extraction map.
            font_info = next(info for info in page.get_fonts() if "GreatVibes" in info[3] and info[2] == "Type0")
            embedded = pymupdf.Font(fontbuffer=doc.extract_font(font_info[0])[3])
            for char in name:
                if not char.isspace():
                    glyph = embedded.has_glyph(ord(char))
                    assert glyph, (path, char, "missing embedded glyph")
                    assert embedded.glyph_bbox(ord(char)).get_area() > 0, (path, char)
        print(path.name, page.rect, repr(page.get_text()), doc.metadata)
