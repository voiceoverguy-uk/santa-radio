---
name: Keyboard focus checks
description: Browser input modality affects whether programmatic focus activates focus-visible styles.
---
When verifying keyboard focus styling, use genuine keyboard navigation. Calling focus() after pointer interactions can focus an element without activating its :focus-visible styling.

**Why:** Chromium checks of a correctly styled control reported no focus glow because the previous input was a pointer action. Programmatic focus alone did not establish keyboard input modality.

**How to apply:** Keep assertions about having focus separate from assertions about visible keyboard focus. Use Tab navigation for the latter; do not change working CSS to satisfy a pointer-modality test.
