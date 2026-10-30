---
name: Native audio control styling
description: Browser-native audio players may paint their own panel over the element background.
---

Finished free Santa greetings must keep the standard browser-native player appearance, not a gold-themed surface. This does not apply to the radio or other players.

**Why:** The owner rejected the gold free-message player, while retaining the compact player/share layout and surrounding gold styling.

**How to apply:** Avoid colour overrides on the audio element and browser-specific media-control panels. Inspect painted controls, not only computed backgrounds: Chromium can paint an internal panel over the element background. Preserve native playback and keyboard focus.

Compare native-control screenshots with a small rasterisation tolerance rather than exact PNG equality.

**Why:** Identical native controls can differ at fractional coordinates in their edge and text antialiasing. Exact equality falsely rejects the unchanged native surface.

**How to apply:** Compare against an unthemed control rendered by the same browser and exclude corner backdrop differences; retain a strict enough pixel threshold to reject a recoloured panel.
