---
name: Studio audio control focus
description: Preserve keyboard focus while the paid Studio example starts loading.
---

Keep the paid example’s play control focusable during media startup. Mark it busy
and ignore repeat activation rather than disabling it while a play request is
pending.

**Why:** Disabling the focused button during startup caused browsers to move
keyboard focus away before playback began.

**How to apply:** Use this for the shared Studio promotion’s audio control and
any similar asynchronous media-start control added there.
