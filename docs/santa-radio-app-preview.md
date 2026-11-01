# Santa Radio App screenshot preview

Scope: the Santa Radio App section on `/apps` only. Its copy, download URLs and
existing portrait handset remain intact. Other app showcases are unchanged.

## Screens and interaction

The supplied full native screens appear in this order:
Radio → Tracker → MugShots → Artists → Games → Welcome → Radio.

- Automatic previews dissolve every five seconds using the existing 650 ms fade.
- The five bottom navigation targets inside the screenshot select their matching
  screen. These are real, keyboard-accessible buttons over the captured tabs.
- A separate labelled selector offers all six screens, including Welcome.
- Welcome's captured Continue button returns to the Radio preview.
- Manual selection holds that screen; Resume restarts the slideshow.
- Hover, keyboard focus and a hidden browser tab suspend automatic rotation.
- Reduced motion is static with manual selection still available. Its automatic
  preview control is explicitly disabled and labelled accordingly.
- A pending target keeps the currently decoded image visible. Loading and final
  failure messages are announced politely; unavailable images do not blank it.
- The interface is labelled as a screenshot preview, not a functioning native
  radio player or game. Native in-screen playback/game buttons are not simulated.

## Assets

`scripts/prepare-santa-radio-screens.mjs` prepares the six owner-supplied PNGs.
It scales the complete 1206 × 2622 captures by exactly half to 603 × 1311,
without cropping or generating interface content. Original uploads are retained.

The `src/assets/apps/santa-radio-ios-*.webp` deliveries total approximately
731 KB (58–224 KB each). Matching PNG recovery assets have exactly the WebPs'
decoded pixels. The two website/tab close-ups are references, not slideshow assets.

## Checks

```sh
npm run build
node --test scripts/apps-production.test.mjs
npx playwright test tests/apps-page.spec.js tests/apps-radio-preview.spec.js tests/apps-showcase.spec.js --project=chromium
```

Focused checks cover the six-image loop and exact five-second boundary; hover,
visibility and reduced motion; mouse/keyboard selection; manual hold and resume;
Welcome navigation; hotspot alignment and target size down to 320 px; held-image
loading and PNG recovery; uncropped images and other app showcases; unchanged
store links; server-rendered content and production image decoding.

The production test compares decoded pixels for the new WebP/PNG pairs, as well
as the other app deliveries. Physical iPhone Safari and VoiceOver have not been
verified by Chromium viewport checks. No publication was performed for this work.
