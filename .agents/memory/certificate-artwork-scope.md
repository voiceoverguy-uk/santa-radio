---
name: Nice List certificate artwork scope
description: Owner-approved design and privacy boundaries for personalised certificates.
---
Use the supplied approved blank certificate, not a recreation. Add only the completed recording's canonical display name; no year or extra wording.

**Why:** The owner explicitly approved the larger decorative Santa Claus signature, gold wax-style seal, gold line and absence of a name-field rectangle.

**How to apply:** Keep personalisation local to the browser, separate from audio allowance and public invitation sharing. Certificate failure must not affect audio; do not add recipient storage or remote certificate delivery.

Named certificate PDFs supplied for previews are examples, not replacement personalisation masters. An audio attachment alongside those examples does not authorise replacing the existing example audio.

**Why:** The owner requested named examples as promotional previews while explicitly keeping both the personalised PDF generator and example recordings unchanged.

**How to apply:** Preserve the examples’ supplied artwork and names; treat changes to the certificate master or example audio as separate requests.

Keep the promotional certificate box aligned left with the introduction and sized to fit its text area, not centred at a strict percentage reduction. Keep automatic rotation, no name-selection buttons, no pause control and no “Showing…” status line. Clicking the visible example enlarges that example.

**Why:** After requesting a 30% reduction, the owner clarified that it looked too small and should align left and fit the outlined text area. They explicitly removed the extra controls and status text.

**How to apply:** Preserve enlargement and reduced-motion behaviour when refining the compact preview.

Embed the supplied font in full rather than subsetting it.

**Why:** The fontkit subset writer omitted visible letters from this particular supplied static font even though PDF text extraction returned the correct name. Full embedding rendered correctly.

**How to apply:** Verify the actual rasterised output, not only ToUnicode extraction. Keep full embedding unless a replacement implementation is visually checked with normal, long and accented/punctuated names.

Font changes must preserve both the visible name and its extracted PDF text.

**Why:** The supplied script font could render contextual ligatures correctly while PDF extraction substituted unrelated Unicode letters. A visual-only check would miss incorrect spelling for copying and assistive readers.

**How to apply:** When changing fonts or shaping options, compare extracted canonical names as well as actual ink bounds and rasterised PDFs, including long names containing common letter pairs.
