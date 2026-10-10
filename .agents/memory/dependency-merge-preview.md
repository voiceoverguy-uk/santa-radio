---
name: Preview after dependency merges
description: Running dev processes can retain imports from a replaced dependency installation.
---
A dependency merge can leave a running development server using module paths from the old installation, even when installed packages match the updated lockfile.

**Why:** A security dependency update replaced Vite while the existing process still referenced its previous internal chunks, breaking Preview despite a valid installation.

**How to apply:** After dependency merges, verify Preview against a freshly started workflow before assuming missing internal modules mean package corruption or reinstalling dependencies.
