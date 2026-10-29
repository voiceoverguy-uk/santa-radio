---
name: Raw exported request targets
description: Leading doubled separators must be tested through middleware, not just route resolution.
---
Test Search Console's exact request targets through every serving layer before concluding a resolver repair works.

**Why:** Exported `//` paths exposed URL parsing failures in middleware that runs before the document resolver. A correct resolver alone could still leave development returning 500, while missing historical resources could become 200 app shells.

**How to apply:** Preserve separators when interpreting an HTTP request target as a path, never as a protocol-relative hostname. Keep redirects evidence-backed and exact; do not turn this parsing rule into arbitrary slash normalization or host redirection.
