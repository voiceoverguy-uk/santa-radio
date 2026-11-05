# Studio MP3 preparation runner

The website Studio uses the supplied **Classic** Santa by default. This does not
affect the free maker or native app.

To explicitly opt into random costumes, change `STUDIO_RUNNER_MODE` in
`src/lib/studioPreparationRunner.js` from `'classic'` to `'random'`, then rebuild
the website. No visitor picker, URL switch, stored preference or server change
is involved. Other mode values retain Classic.

The allowlist contains exactly the eleven costumes supplied in the runner kit.
Selection happens once after the existing Create confirmation is accepted, not
when opening/cancelling the confirmation or rendering status updates. Each new
accepted retry chooses again; receiving bytes keeps the same mounted picture,
costume and animation. Request IDs, allowances and retry rules are independent
of this decorative selection.

Assets live in `public/images/studio-runners/`, copied without modification from
the supplied kit. There is no preload or costume cycling: the picture requests
only the selected costume. Its reduced-motion source is that costume's supplied
still PNG, so reduced-motion visitors do not download/play the animated WebP.
Travel and facing CSS animations are also disabled for reduced motion.

The runner is non-interactive, hidden from assistive technology and outside the
live status region. It exists only during the existing preparing/receiving busy
interval. The original indeterminate gold indicator and Cancel control remain.
