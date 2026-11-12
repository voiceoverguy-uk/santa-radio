import { createHash } from 'node:crypto';
const retired = new Set(['0ed8e643188dbd252706cded39c7d0da507eb827bf6f6ca97242c5b8a665fc2e','55e8776f2c233e447602660fb4b04bfac9c695880959bac6d9eea22ce3c9afa3','abb2649ebcb1fda00b8248939b3312298675879d400352a31e738b9763eb8155','ab20845d9a4da390ad71be5e9c967f0db780b2fa22fdc074f9837619dc33b520','bf04e4b212b7a2131b8169c4f0d9c5a1cfc733a2285e5aa729f79c47018f105c']);
// Server-only configuration. Never return this object from an API or log it.
export const WORKSHOP_CODE_SLOTS = 6;
export const SCHOOL_TEST_START = Date.parse('2026-11-03T00:00:00Z');
export const SCHOOL_TEST_DEADLINE = Date.parse('2026-11-11T00:00:00Z');
// Non-secret slot marker. The owner's selected voucher currently occupies
// slot 3; credential rotation within that slot must preserve its policy.
export const LIMITED_WORKSHOP_SLOT = '3';
// Only this owner-selected shared voucher has a per-visitor allowance.
export const limitedWorkshopCode = entry => entry?.limited === true;
export const workshopSettings = (env = process.env) => ({
  limitedSlot: env.SANTA_STUDIO_LIMITED_VOUCHER_SLOT || LIMITED_WORKSHOP_SLOT,
  codes: Array.from({ length: WORKSHOP_CODE_SLOTS }, (_, index) => ({
    id: String(index + 1), code: env[`SANTA_STUDIO_TEST_CODE_${index + 1}`]?.trim(),
    limited: String(index + 1) === (env.SANTA_STUDIO_LIMITED_VOUCHER_SLOT || LIMITED_WORKSHOP_SLOT),
     ...(index === 5 ? { startsAt: SCHOOL_TEST_START, expiresAt: SCHOOL_TEST_DEADLINE } : {}),
  })).filter(entry => entry.code),
  signingSecret: env.SESSION_SECRET,
  expiresAt: Date.parse(env.SANTA_STUDIO_TEST_EXPIRES_AT || ''),
});

export const workshopCodeDeadline = (config, entry) => Math.min(config.expiresAt, entry.expiresAt ?? config.expiresAt);
export const workshopCodeOpen = (config, entry, now) => !!entry
  && !retired.has(createHash('sha256').update(entry.code || '').digest('hex'))
  && (entry.startsAt === undefined || now >= entry.startsAt)
  && now < workshopCodeDeadline(config, entry);

// Deliberately contains only fixed identifiers and booleans, never values,
// lengths, hashes, cookies, database addresses or raw exceptions.
export function workshopConfigurationChecks(config) {
  const codes = Array.isArray(config?.codes) ? config.codes : [];
  const entriesValid = codes.every(entry => entry && /^[1-6]$/.test(entry.id)
    && typeof entry.code === 'string' && entry.code.length > 0 && entry.code.length <= 80
    && (entry.startsAt === undefined || Number.isSafeInteger(entry.startsAt))
    && (entry.expiresAt === undefined || Number.isSafeInteger(entry.expiresAt))
    && (entry.startsAt === undefined || entry.expiresAt === undefined || entry.startsAt < entry.expiresAt));
  return {
    limitedSlotValid: config?.limitedSlot === undefined || /^[1-6]$/.test(config.limitedSlot),
    activeCodesValid: codes.length > 0 && codes.length <= WORKSHOP_CODE_SLOTS && entriesValid,
    slotIdsUnique: new Set(codes.map(entry => entry?.id)).size === codes.length,
    codesDistinct: new Set(codes.map(entry => entry?.code)).size === codes.length,
    expiryParseable: Number.isSafeInteger(config?.expiresAt),
    signingSecretValid: typeof config?.signingSecret === 'string' && config.signingSecret.length >= 32,
  };
}

export const workshopConfigured = config => Object.values(workshopConfigurationChecks(config)).every(Boolean);
