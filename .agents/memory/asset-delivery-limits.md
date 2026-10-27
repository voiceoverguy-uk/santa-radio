---
name: Large asset delivery limits
description: Library attachment size limits and preserving large source handovers losslessly.
---
The asset-delivery callback rejects files over 100 MiB (104,857,600 bytes).
Do not remove required public artwork merely to make a complete source handover
fit that limit.

**Why:** A complete website source ZIP exceeded the verified attachment limit.
Lossless delivery ZIPs containing numbered binary chunks could preserve the
entire original archive and its SHA-256.

**How to apply:** For a large handover, provide smaller transport ZIPs, a simple
assembly script and checksums. Explain that all parts are required, test
extraction/assembly end to end, and distinguish transport chunks from the
complete source ZIP. Keep generated archives out of repository history.
