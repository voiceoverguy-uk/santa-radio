---
name: Provider appearance verification
description: Why third-party sign-in styling needs a rendered check rather than source inspection.
---
Check computed resting and interactive styles when changing provider-owned controls.
Do not assume that an appearance declaration wins against the provider's styling.

**Why:** Clerk's rendered primary-button shadow did not match the appearance
object during verification. Internal `.cl-*` structural overrides also triggered
a provider warning about future component updates.

**How to apply:** Prefer the supported appearance-class mechanism and check the
rendered result without submitting credentials. Avoid depending on provider-owned
DOM structure for decorative changes.
