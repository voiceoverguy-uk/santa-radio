---
name: Workspace verification baselines
description: Earlier file observations and temporary comparison baselines may not survive a task-environment transition.
---
After a task-environment transition, verify the current files before relying on earlier edits or test baselines.

**Why:** During an accepted-task transition, early uncommitted artwork edits and a temporary feed baseline were absent from the subsequently observed workspace. Earlier successful tool results did not describe the later filesystem.

**How to apply:** Reconcile the current filesystem with the authorised plan. Do not assume temporary files persist across environments, or reconstruct a purported pre-change baseline from modified code. For feed compatibility, unchanged checked-in mappings, generator and source image bytes can provide a reliable reference.
