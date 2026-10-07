---
name: Personalised Santa audio scope
description: Audio-only product direction and incremental name-library rollout.
---
The user wants personalised Santa audio messages ending in an MP3, not video. Start with Arabella as an experiment and a typed first-name box; they intend to upload thousands of recorded names later.

**Why:** The user explicitly corrected the proposed video and described the intended audio workflow.

**How to apply:** Use the supplied recorded voice, not voice synthesis. Keep unavailable names explicit; future library integration should resolve typed names to verified recordings.

Do not pre-create completed messages for the name catalogue. Store the source name recordings; when a user selects their child's name, build the mixed MP3 at that time and then offer the download. Provide live name suggestions as they type.

**Why:** The user explicitly corrected batch generation: “We don't want a database full of completed names.”

**How to apply:** Future work must replace the pre-rendered experiment with on-demand assembly. Do not batch-render newly uploaded names. Temporary output retention should be bounded rather than a permanent catalogue of completed MP3s.

Preserve the outro's supplied opening padding.

**Why:** The user deliberately added padding to the replacement outro and confirmed that the shorter outro should be used for all messages.

**How to apply:** Do not automatically trim leading silence from the outro when mixing or replacing recordings.
