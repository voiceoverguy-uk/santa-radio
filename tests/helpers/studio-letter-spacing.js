// Measure actual inline fragments, not just CSS declarations. WrittenText uses
// nested spans, so collapse duplicate fragment rectangles on the same line.
export async function measureLetterSpacing(paper) {
  return paper.evaluate(sheet => {
    const text = sheet.querySelector('.studio-letter__text');
    const scale = sheet.getBoundingClientRect().width / 595.2756;
    const paragraphs = [...text.querySelectorAll('p')].map(p => {
      const range = document.createRange();
      range.selectNodeContents(p);
      const lines = [...range.getClientRects()].filter(r => r.width > .01)
        .filter((r, i, rects) => rects.findIndex(other => Math.abs(other.top - r.top) < .1) === i);
      return { lines: lines.map(r => ({ top: r.top / scale, bottom: r.bottom / scale })),
        gap: parseFloat(getComputedStyle(p).marginBottom) / scale,
        font: parseFloat(getComputedStyle(p).fontSize) / scale };
    });
    const rect = sheet.getBoundingClientRect();
    const signature = text.querySelector('.studio-letter__signature').getBoundingClientRect();
    const end = text.getBoundingClientRect().bottom;
    return { paragraphs, pitch: paragraphs.flatMap(p => p.lines.slice(1)
      .map((line, i) => line.top - p.lines[i].top)),
    inkGaps: paragraphs.flatMap(p => p.lines.slice(1)
      .map((line, i) => line.top - p.lines[i].bottom)),
    end: (end - rect.top) / rect.height,
    signatureEnd: (signature.bottom - rect.top) / rect.height,
    sheet: { width: rect.width, height: rect.height } };
  });
}
