// Server-only configuration. Never return this object from an API or log it.
export const workshopSettings = (env = process.env) => ({
  codes: Array.from({ length: 5 }, (_, index) => ({
    id: String(index + 1), code: env[`SANTA_STUDIO_TEST_CODE_${index + 1}`]?.trim(),
  })).filter(entry => entry.code),
  signingSecret: env.SESSION_SECRET,
  expiresAt: Date.parse(env.SANTA_STUDIO_TEST_EXPIRES_AT || ''),
});

// Deliberately contains only fixed identifiers and booleans, never values,
// lengths, hashes, cookies, database addresses or raw exceptions.
export function workshopConfigurationChecks(config) {
  const codes = Array.isArray(config?.codes) ? config.codes : [];
  const entriesValid = codes.every(entry => entry && /^[1-5]$/.test(entry.id)
    && typeof entry.code === 'string' && entry.code.length > 0 && entry.code.length <= 80);
  return {
    activeCodesValid: codes.length > 0 && codes.length <= 5 && entriesValid,
    slotIdsUnique: new Set(codes.map(entry => entry?.id)).size === codes.length,
    codesDistinct: new Set(codes.map(entry => entry?.code)).size === codes.length,
    expiryParseable: Number.isSafeInteger(config?.expiresAt),
    signingSecretValid: typeof config?.signingSecret === 'string' && config.signingSecret.length >= 32,
  };
}

export const workshopConfigured = config => Object.values(workshopConfigurationChecks(config)).every(Boolean);
