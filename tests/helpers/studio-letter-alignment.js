import { expect } from '@playwright/test';

// Check painted text, not just the paragraph boxes (which span the full band
// even when their inline content is accidentally centred by a preview button).
export async function expectLeftAlignedLetter(paper) {
  const metrics = await paper.evaluate(sheet => {
    const text = sheet.querySelector('.studio-letter__text');
    const body = [...text.querySelectorAll(':scope > p')];
    const closing = [...text.querySelectorAll('.studio-letter__closing p')];
    const signature = text.querySelector('.studio-letter__signature');
    const measure = node => {
      const range = document.createRange();
      range.selectNodeContents(node);
      const rects = [...range.getClientRects()].filter(rect => rect.width > .01);
      const style = getComputedStyle(node);
      return {
        alignment: style.textAlign,
        left: node.getBoundingClientRect().left,
        firstLeft: rects[0].left,
        right: node.getBoundingClientRect().right,
        lines: rects.map(rect => ({ left: rect.left, right: rect.right })),
        wordSpacing: style.wordSpacing,
      };
    };
    return {
      bodyLeft: text.getBoundingClientRect().left,
      paragraphs: [...body, signature, ...closing].map(measure),
      gaps: body.slice(1).map((node, index) =>
        node.getBoundingClientRect().top - body[index].getBoundingClientRect().bottom),
      closingLeft: text.querySelector('.studio-letter__closing').getBoundingClientRect().left,
    };
  });
  for (const [index, paragraph] of metrics.paragraphs.entries()) {
    expect(paragraph.alignment).toBe('left');
    expect(paragraph.wordSpacing).toBe('0px');
    expect(Math.abs(paragraph.firstLeft - paragraph.left)).toBeLessThan(.5);
    expect(Math.abs(paragraph.left - (index < metrics.paragraphs.length - 2
      ? metrics.bodyLeft : metrics.closingLeft))).toBeLessThan(.5);
    for (const line of paragraph.lines) {
      expect(line.left).toBeGreaterThanOrEqual(paragraph.left - .5);
      expect(line.right).toBeLessThanOrEqual(paragraph.right + .5);
    }
  }
  // Positive, uniform spacing remains visible when scaled back to print size.
  expect(Math.min(...metrics.gaps)).toBeGreaterThan(0);
  expect(Math.max(...metrics.gaps) - Math.min(...metrics.gaps)).toBeLessThan(.1);
}
