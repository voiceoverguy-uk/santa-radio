---
name: Native audio control styling
description: Browser-native audio players may paint their own panel over the element background.
---

Style the `<audio>` element background and, in Chromium/WebKit, `::-webkit-media-controls-panel` and `::-webkit-media-controls-enclosure` when the native controls need a visible themed surface. Keep native controls and verify the actual rendered player, not only the element's computed background.

**Why:** Chromium's audio controls rendered as a white panel despite a gold background on the `<audio>` element.

**How to apply:** When changing the greeting player's visual theme, inspect its rendered controls in supported browsers and preserve native playback and keyboard behavior.
