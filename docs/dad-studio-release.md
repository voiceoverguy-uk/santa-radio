# Dad Studio release

Route: `/dad-message-maker`. Separate from the Kids Studio; no homepage/nav promotion yet.
One successful audio creation per paid purchase; MP4 generation retries reuse that recording in the open browser. Output is MP4 only. Download before leaving; no account archive or digital gifts.

Five generated Christmas scenes are selected after the name, age, habits, viewing choice and treat, immediately before review/recording. Name and age appear at their actual clip starts; habits/viewing at clip ends; treat at its clip start plus one second. Nice List uses the second name cue. All source PCM is retained; no padding is inserted at the section-five/treat join.

## Payment activation pending morning review

Stripe account `acct_1SSOVl8OzIo5fGDT` currently has no active Dad product. The £5 price `price_1SblcD8OzIo5fGDTEBF6BnkA` belongs to the archived legacy Bespoke Santa Message product `prod_TYtPRoPDOyPSlw`; it has not been changed or reused.

After confirming Mark's intended product/price, configure `DAD_STUDIO_PRODUCT_ID`, `DAD_STUDIO_PRICE_ID`, `DAD_STUDIO_SALES_ENABLED=true`, and enable the Dad-specific database sales flag. Checkout verifies the product is active, live, GBP, one-time, exactly 500p; fulfillment validates paid Checkout, payment intent, line item and signed browser claim. Existing signed Stripe webhook dispatches by the Dad offer metadata. Recovery emails use separate tokens/cookies/outbox; the existing retry worker processes Dad messages when configured.

Existing Studio owner admin access can review and create Dad messages without a purchase. Ordinary Kids or friend access does not grant Dad access.

## Audio publication

233 losslessly verified FLACs: 83 ages (18–100), 48 habits, 45 viewing choices, 50 treats, 7 fixed script sections. Private Blob prefix `dad-library/`, active pointer `dad-library/active.json`. The release publisher checks each upload hash before activating its manifest. It never copies or rewrites the Kids/name libraries.

Original WAVs remain untouched. Local conversion report/FLACs: `Dad migration reports` beside the original site workspace. `scripts/prepare-dad-library.mjs` is the local conversion source, and `scripts/publish-dad-library.mjs` is the production-OIDC publication script. Publication assets are private build inputs, never public routes or committed audio.

## Verification

`node --test scripts/dad-studio.test.mjs` uses disposable local PostgreSQL. Optional `DAD_TEST_PGLITE_MODULE` can point to an isolated PGlite package when PostgreSQL binaries are unavailable. Real-audio integration test requires local private `server/dad-release` inputs; browser tests use synthetic audio and a small catalogue fixture, so they need no private recordings. No customer payment or allowance is used by tests.

Artwork generated with built-in image generation: (1) crumb-covered armchair Dad with TV, crisps, drink and amused wife; (2) Dad tangled in lights assembling a toy; (3) Dad asleep after Christmas dinner while dog steals sausage; (4) proud Dad presenting an overcooked turkey; (5) Dad playing air guitar with wrapping-paper tube. Shared prompt constraints: 16:9 warm humorous realism, SantaRadio.co.uk / Your Message From Santa, blank evergreen lower caption panel with gold trim.
