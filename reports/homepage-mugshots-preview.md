# Homepage Mugshots preview verification

## Delivered

- Approved copy rendered as live, selectable text; no cartoon icon or empty icon wrapper.
- Evergreen background, corner-only SVG pine and fairy lights, gold photograph frames and a red gallery button.
- Four distinct approved records initially, using the unchanged sampler and eligibility data. Following the owner's additional request, a fresh batch starts every ten seconds and replaces the four slots left to right, 350ms apart. Each next batch excludes the currently visible profiles; this is not a visit-history policy.
- A soft reveal accompanies each replacement. Hovering over the grid, keyboard focus inside it, hiding the tab, or using the new pause control suspends refreshes. Resume starts a fresh ten-second countdown, and pending staggered updates are cancelled on pause or unmount. Reduced motion removes the visual reveal.
- Original photographs are contained within taller frames, without cropping. Names, roles, descriptive alt text and individual profile destinations retain their record associations.
- Homepage-only image sizing and styling; shared Portrait fallback, main gallery, profile pages, navigation branding and homepage section order remain unchanged.
- Decoration is hidden from assistive technology and does not capture input. Keyboard focus is visible; reduced motion disables transitions and hover movement.

## Checks

`npx playwright test tests/homepage-mugshots-rotation.spec.js tests/homepage-mugshots-redesign.spec.js tests/homepage-mugshots.spec.js tests/mugshot-shutter.spec.js tests/mugshot-card-layout.spec.js --project=chromium --reporter=list`

**33 passed.** Includes all four sampled profile links and the gallery button, record bindings, deterministic reload/interaction sampling checks, desktop/mobile layout, keyboard access, portrait failure, and mouse/touch/keyboard shutter behaviour. New virtual-clock checks confirm the exact ten-second cadence, 350ms left-to-right order, distinct approved records and matching photo/name/role/alt/link during every intermediate state, pause/resume midway through a row, hover/focus/tab pausing, reduced motion and navigation cleanup.

`npm run build`

**Passed:** browser bundle, server bundle and 1,576 prerendered canonical pages. Existing large-chunk and runtime-resolved asset warnings remain.

`git diff --check`

**Passed.**

## Broader gallery checks outside this change

`tests/mugshots.spec.js`: **8 passed, 4 failed** in the broader run.

- The imported-image report expects the old Amelle Berrabah photograph path, while the catalogue has a replacement. Neither catalogue nor import report was changed.
- A Steve Davis detail-page test expects a social link that the current profile does not expose. Profile rendering and data were not changed.
- The removed-profile navigation sweep encountered a browser crash.
- The existing detail-photo failure test aborts original-image requests but not the responsive thumbnails; the image can still load. The new homepage failure test intercepts both and passes.

These are not a claim that the whole gallery suite is green. No catalogue repair or broader test cleanup was undertaken. The affected old homepage icon, numeric-copy, square-crop and gallery-button selectors were updated to the approved design; gallery square-photo expectations remain intact.

## Visual review

- Desktop: 1440px viewport, four large framed photographs in one row.
- Mobile: 390px viewport, two columns with wrapped names and roles, complete supporting copy.
- The screenshots capture the full section rather than a flattened implementation. Different people in desktop and mobile captures are expected because the real sampler is retained.
- Browser visual review used Chromium; real iPhone Safari and VoiceOver were not verified.

The development preview remains running on port 5000. No publishing or production deployment was performed.
