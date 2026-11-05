---
name: Studio letter preview geometry
description: Why the sample letter retains print geometry inside its enlargement.
---
The complete sample letter keeps A4 proportions rather than reflowing as an article. Its enlargement must now show the whole page at once, including the bottom border, without horizontal or vertical panning.

**Why:** The approved letterhead and complete supplied wording must stay together on one portrait page. The owner subsequently asked to see the whole letter in the popup after the lower part was cut off.

**How to apply:** Scale the document uniformly to both available popup dimensions after reserving room for the close toolbar. Keep interface controls responsive, including enlarged text, and refit on rotation. Check the actual paragraph bounds against the header/footer and the complete sheet against the popup; do not hide overflow to conceal a fit failure.

Keep the body type size, A4 page, letterhead, signature and watermarks unchanged.
The owner now explicitly approves adaptive line/paragraph spacing within an
invisible writing frame and curated shorter wording for exceptionally long
letters. This supersedes the previous unchanged-spacing decision and prohibition
on per-letter spacing adjustments or shortening.

**Why:** The owner's Edward screenshot showed ordinary letters bunching near
the top, and the owner authorised a content-aware fitting policy rather than
preserving that limitation.

**How to apply:** Keep ordinary wording where it fits. Compact wording must
retain every selected detail, age-appropriate contextual meaning, geographical
story, festive character, joke and closing. Make one deterministic wording
decision against both browser and embedded-PDF fonts before revealing the letter.
Resizing, animation and downloading must not select new wording. Never shrink,
clip, truncate, hide overflow or add a page to claim success.

The invisible writing frame ends at 85.3% of A4 height; rendered letter ink
must stay above 85% so the P.S. clears the lower holly and other ornaments.

**Why:** Same-size browser and PDF comparisons showed an 84% line-box limit left
the P.S. too high, while 86% put its ink slightly below the owner's target. The
85.3% frame places the Edward P.S. at 84.5% in the preview and keeps PDF ink
below 85%, matching the supplied screenshot with clearance above the artwork.
The PDF also needs an explicit 8pt gap after the decorative signature so its ink
does not overlap the following closing line.

**How to apply:** Keep the 85.3% line-box bound and 85% ink bound consistent in
browser previews, enlargements and PDF exports; rerun long-copy fit checks when
either position changes.

A CSS fallback-font override is not proof of testing a second installed font.
In the Linux workspace, Georgia and Times New Roman can both resolve to DejaVu
Serif, unlike the owner's device.

**Why:** The same letter can wrap differently from the supplied screenshot even
when shared font size and leading are applied correctly. Treating font aliases
as independent coverage can hide that distinction.

**How to apply:** Check actual font availability before describing fallback
coverage; measure the embedded PDF font separately and do not infer the source
build or installed fonts from a screenshot alone.

Use conventional left-aligned letter writing with a ragged right edge, not
centred lines or full justification. Keep the decorative letterhead unchanged.

**Why:** The owner requested the conventional letter structure in their
screenshot, including the greeting, signature and P.S.

**How to apply:** Keep shared promotional examples, review, enlargement and PDF
consistent. Retain a lower closing inset only for the decorative border; this
direction does not apply to certificate names or Santa-picture lettering.

Studio review must reuse the homepage certificate, picture and letter artwork,
including the watermarked enlargements. All three use the chosen written name;
the letter uses the actual age, activity, celebration, treat and destination.

**Why:** The user explicitly requested replacing the certificate-only name
preview with all three enlargeable keepsakes and a letter reflecting their
Studio selections.

**How to apply:** Review previews are complete and fixed, not rotating examples.
Written-spelling edits affect all three keepsakes without changing Santa’s
recorded name. Preserve homepage example rotation independently and keep names
and choices out of URLs and persistent browser storage.
