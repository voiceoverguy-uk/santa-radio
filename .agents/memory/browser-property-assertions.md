---
name: Browser property assertions
description: Matching partial browser property values in this Playwright environment.
---
For a partial DOM property value, use `expect.poll` around the property read and
a normal string matcher, rather than an asymmetric matcher passed into
`toHaveJSProperty`.

**Why:** In this environment, passing `expect.stringContaining` to
`toHaveJSProperty` rejected a property value that visibly contained the expected
string.

**How to apply:** This is useful for browser-selected asset URLs such as
`currentSrc`, where the origin varies and only the filename should be matched.
