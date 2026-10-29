---
name: SSR context reloads
description: Investigating missing-provider errors that disappear after restarting Vite.
---
A passing cold development render and production bundle do not rule out a context identity mismatch after development module reloads.

**Why:** Re-evaluating a provider through Vite while retaining previously loaded consumers reproduced a null-context error despite a correctly mounted provider. Ordinary full-tree invalidation and concurrent cold requests did not reproduce it.

**How to apply:** Check warm-module identity explicitly when an intermittent SSR context error disappears after restart. Keep context identity independent of hot-reloaded provider implementation; do not hide a genuine missing provider with default state or a process-global playback store.
