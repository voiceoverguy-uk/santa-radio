---
name: Workspace verification baselines
description: Earlier file observations and temporary comparison baselines may not survive a task-environment transition.
---
After a task-environment transition, verify the current files before relying on earlier edits or test baselines.

**Why:** During an accepted-task transition, early uncommitted artwork edits and a temporary feed baseline were absent from the subsequently observed workspace. Earlier successful tool results did not describe the later filesystem.

**How to apply:** Reconcile the current filesystem with the authorised plan. Do not assume temporary files persist across environments, or reconstruct a purported pre-change baseline from modified code. For feed compatibility, unchanged checked-in mappings, generator and source image bytes can provide a reliable reference.

Check the aggregate branch diff, not only a clean working-tree status, when completion flags unrelated deletions.

**Why:** A pre-merge checkpoint had already committed unrelated upload deletions before implementation began, so ordinary status showed none of them although the aggregate diff still contained them.

**How to apply:** Identify the earlier deletion commit, compare current paths before restoring, and recover only the missing original files from the preceding tree. Preserve later uploads and avoid regenerating unrelated catalogues.

Confirm the development server's actual listening port after restarting a workflow; a running status alone does not identify which server the preview reaches.

**Why:** A surviving Vite process held port 5000 while the replacement silently selected 5001. The preview and workflow were therefore served by different processes.

**How to apply:** Inspect the workflow's readiness log and process ownership. Stop the identified stale development processes, then restart the single configured workflow on port 5000; do not create another competing server.
