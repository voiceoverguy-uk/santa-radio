---
name: Legacy export encoding
description: Environment caveat when repairing old database export text.
---
Do not assume the workspace Node runtime correctly decodes Windows-1252 through TextDecoder; verify smart punctuation as well as accented letters.

**Why:** In this environment, the Windows-1252 decoder did not map euro/trademark bytes as expected, leaving common corrupted apostrophes untouched despite repairing accented letters.

**How to apply:** For legacy exports, use tested explicit byte mappings or a verified decoder, and reject invalid UTF-8 transformations rather than replacing valid text with replacement characters.
