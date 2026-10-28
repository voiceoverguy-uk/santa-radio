---
name: Preview cookie attributes
description: Replit preview can rewrite SameSite while preserving secure browser cookies.
---

Do not weaken the server's cookie attributes to satisfy a preview-browser assertion.

**Why:** The server issued HttpOnly, Secure, SameSite=Lax checkout cookies, but the proxied preview browser received SameSite=None with HttpOnly and Secure intact. This made an otherwise working checkout test fail its Lax assertion.

**How to apply:** Assert the server's intended SameSite header in direct handler tests and inspect HttpOnly/Secure in the proxied browser. Keep explicit same-origin and cross-site rejection on checkout POSTs; do not rely on SameSite alone for request protection.
