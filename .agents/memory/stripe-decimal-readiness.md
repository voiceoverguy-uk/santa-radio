---
name: Stripe decimal readiness
description: Live price checks must accept the SDK's exact decimal representation.
---
Stripe's installed SDK returns unit_amount_decimal as a Decimal object, although
JSON serialization displays it as the string "650". A strict comparison with a
string therefore rejects the valid pinned £6.50 price.

**Why:** A live read confirmed every account/product/price check passed except
the decimal comparison. JSON-only inspection initially obscured its object type.

**How to apply:** Compare the exact string representation without floating-point
rounding, retain the integer amount check and test real Stripe.Decimal instances,
including fractional mismatches. Do not change the product, price or keys to
work around an SDK representation mismatch.
