// Run only in a trusted workspace process. Never print request bodies, cookies,
// configured voucher values, raw exceptions or personalised response data.
import { workshopSettings, workshopConfigured, workshopCodeOpen, SCHOOL_TEST_DEADLINE, WORKSHOP_CODE_SLOTS } from '../server/santa-workshop-settings.js';

const report = { environment: 'Replit workspace preview', configurationValid: false,
  voucherEntryAccepted: false, sessionVerified: false, expiryCapped: false,
  independentSessions: false, catalogueAvailable: false, allowanceAvailable: false };
try {
  const config = workshopSettings();
  const entry = config.codes.find(item => item.id === String(WORKSHOP_CODE_SLOTS));
  const origin = new URL(`https://${process.env.REPLIT_DEV_DOMAIN}`).origin;
  report.configurationValid = workshopConfigured(config) && workshopCodeOpen(config, entry, Date.now());
  if (!report.configurationValid) throw new Error();
  const login = async () => {
    const response = await fetch(`${origin}/api/santa-workshop-access`, {
      method: 'POST', redirect: 'error',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: entry.code }),
    });
    if (!response.ok) throw new Error();
    const data = await response.json();
    const cookie = response.headers.get('set-cookie')?.split(';')[0];
    if (!data.authorized || !cookie) throw new Error();
    return { cookie, expiresAt: data.expiresAt };
  };
  const first = await login();
  const second = await login();
  report.voucherEntryAccepted = true;
  report.expiryCapped = [first, second].every(session => Number.isSafeInteger(session.expiresAt)
    && session.expiresAt <= Math.min(SCHOOL_TEST_DEADLINE, config.expiresAt, Date.now() + 12 * 3600000));
  report.independentSessions = first.cookie !== second.cookie;
  const get = path => fetch(`${origin}${path}`, { redirect: 'error',
    headers: { Cookie: first.cookie }, cache: 'no-store' });
  const status = await get('/api/santa-workshop-access');
  report.sessionVerified = status.ok && (await status.json()).authorized === true;
  const catalogue = await get('/api/santa-workshop-catalogue');
  report.catalogueAvailable = catalogue.ok && !!(await catalogue.json()).categories;
  const allowance = await get('/api/santa-studio-message');
  const state = allowance.ok ? await allowance.json() : null;
  report.allowanceAvailable = state?.successes === 0 && state?.remaining === 2;
} catch {
  report.verificationFailed = true;
}
console.log(JSON.stringify(report, null, 2));
if (Object.values(report).some(value => value === false) || report.verificationFailed) process.exitCode = 1;
