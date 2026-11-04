---
name: Keyboard focus checks
description: Browser input modality affects whether programmatic focus activates focus-visible styles.
---
When verifying keyboard focus styling, use genuine keyboard navigation. Calling focus() after pointer interactions can focus an element without activating its :focus-visible styling.

**Why:** Chromium checks of a correctly styled control reported no focus glow because the previous input was a pointer action. Programmatic focus alone did not establish keyboard input modality.

**How to apply:** Keep assertions about having focus separate from assertions about visible keyboard focus. Use Tab navigation for the latter; do not change working CSS to satisfy a pointer-modality test.

Native dialog close events and focus restoration can run later than the apparent close, including with a frozen browser clock.

**Why:** Repeated modal cycles under a mocked clock intermittently restored focus after a test had moved it away, unintentionally pausing automatic rotation. Waiting solely for the native close event could also stall. A real-clock check also lost its suggestion list when late dialog focus restoration followed filling a search field.

**How to apply:** Keep uninterrupted rotation checks separate from modal interaction checks; use fresh visits between independent modal examples rather than depending on cross-cycle focus timing. For deliberate sequential keyboard cycles, wait for a DOM signal that React has cleared the modal's selected view, not just restored opener focus: the browser may restore focus before the close listener restores it again. When checking a name after closing a modal, wait for lookup completion and explicitly refocus with keyboard navigation before choosing; fill() alone is not proof that focus stayed in the field.
