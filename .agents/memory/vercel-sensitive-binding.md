---
name: Vercel sensitive binding inspection
description: Sensitive connection settings can return metadata without a value even on a successful API response.
---
Vercel's single-variable API can return HTTP 200 with metadata only for a
sensitive DATABASE_URL. The serving deployment's environment-name list confirms
presence, not the destination database. Do not treat either as binding proof.

**Why:** A secure live investigation encountered this write-only-secret
behaviour; official Vercel documentation confirms saved Secret values are not
readable. Replit production schema findings alone cannot identify Vercel's
database.

**How to apply:** Inspect the deployment actually assigned to the www domain,
not merely the latest project target, which may still be building. If the secret
is unreadable and no resource association proves the destination, use a
read-only production-build binding check, private runtime events or an
authorised staff diagnostic. Do not make staff sign-in a prerequisite for a
recording repair. Build binding evidence is not serving-runtime verification.
Do not rotate, replace or expose credentials to work around the limitation,
and obtain approval before deployment or database changes.

The owner confirmed in Replit's Production Database Settings that its connection
hostname contains the endpoint used by Vercel's production build. This database
is Replit-managed; a separate Neon account connection is not required.

**Why:** The owner privately compared the masked connection setting and
explicitly confirmed the hostname match on 3 November 2026.

**How to apply:** Use Replit's supported production schema-sync process, not
custom production DDL. Reverify if the configured connection changes. Review the
whole pending diff before any approval; do not bundle unrelated migrations.

Do not infer separate databases merely because a Neon endpoint ID differs from
the endpoint returned by Replit's read-only production query connection.

**Why:** Production reads may use a replica endpoint. Different compute
endpoints do not, by themselves, establish different branches or ownership.

**How to apply:** Verify the project/branch relationship through trusted
provider metadata before choosing external-database DDL versus Replit's
managed production schema-sync path.
