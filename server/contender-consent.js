export const MARKETING_CONSENT_TEXT = 'Send me occasional Santa Radio updates';
export const MARKETING_CONSENT_SOURCE = 'christmas-contenders-2026:preview-ballot';

export function normalizeVotingEmail(value) {
  if (typeof value !== 'string' || value.length > 254) return null;
  const email = value.trim().normalize('NFKC').toLowerCase();
  if (email.length > 254) return null;
  const [local, domain, extra] = email.split('@');
  if (extra !== undefined || !local || local.length > 64 || !domain ||
      !/^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(local) ||
      local.startsWith('.') || local.endsWith('.') || local.includes('..') ||
      !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(domain)) return null;
  return email; // Syntax only. No ownership, existence or deliverability claim.
}

