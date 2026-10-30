---
name: Studio letter preview geometry
description: Why the sample letter retains print geometry inside its enlargement.
---
The complete sample letter is a fixed A4 document, not a responsive article that grows vertically. On narrow screens its enlargement may pan horizontally; the surrounding controls must still reflow and respect enlarged interface text.

**Why:** The approved letterhead and complete supplied wording must stay together on one portrait page. Reflowing the document at phone or enlarged interface-text sizes defeats that requirement.

**How to apply:** Preserve the distinction between scalable document typography and responsive interface controls. Check the actual visible paragraph bounds against the artwork's header and footer, including the longest displayed name and choices; do not hide overflow to conceal a fit failure.
