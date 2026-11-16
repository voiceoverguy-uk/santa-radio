import { subscribeFreeMessageContact } from './free-message-marketing.js';
import { FREE_MARKETING_COPY, FREE_MARKETING_VERSION } from '../src/lib/freeMessageMarketing.js';
import { createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { databasePool } from './name-request-store.js';
import { sealContact, openContact } from './name-request-contact.js';
import { freeMessageCodeEmail } from './free-message-code-email.js';

export const VERIFICATION_COOKIE = '__Host-santa-free-verification';
const problem = (message, status = 400) => Object.assign(new Error(message), { status });
const digest = value => {
  if ((process.env.SESSION_SECRET || '').length < 32) throw new Error('Signing unavailable');
  return createHmac('sha256', process.env.SESSION_SECRET).update(`free-verification:${value}`).digest('hex');
};
export async function sendFreeMessageCode({ email, code, marketingOptIn = false }, fetcher = fetch, env = process.env) {
  if (!env.BREVO_API_KEY) throw new Error('Brevo unavailable');
  const content = freeMessageCodeEmail(code, { marketingOptIn });
  const response = await fetcher('https://api.brevo.com/v3/smtp/email', {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
    headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sender: { name: 'Santa Radio', email: 'santa@santaradio.co.uk' },
      to: [{ email }], subject: 'Your free Santa message verification code',
      htmlContent: content.html, textContent: content.text }),
  });
  if (!response.ok || typeof (await response.json()).messageId !== 'string') {
    throw problem('We couldn’t send your code. Please try again shortly.', 503);
  }
}
export function verificationBinding(req) {
  const values = String(req.headers.cookie || '').split(';').map(v => v.trim())
    .filter(v => v.startsWith(`${VERIFICATION_COOKIE}=`));
  const value = values.length === 1 ? values[0].slice(VERIFICATION_COOKIE.length + 1) : '';
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}
export async function requestFreeMessageCode(fields, { pool = databasePool(), send = sendFreeMessageCode } = {}) {
  const email = fields.EMAIL.trim().normalize('NFKC').toLowerCase();
  const identity = digest(`email:${email}`);
  // Shared per-address limit survives different browsers/IPs and server instances.
  const now = Date.now(), end = (Math.floor(now / 3600000) + 1) * 3600000;
  const limited = await pool.query(`INSERT INTO santa_name_request_limits(bucket_key,attempts,expires_at)
    VALUES($1,1,$2) ON CONFLICT(bucket_key) DO UPDATE SET attempts=santa_name_request_limits.attempts+1
    WHERE santa_name_request_limits.attempts<3 RETURNING bucket_key`,
  [`free-code:${identity}:${Math.floor(now / 3600000)}`, new Date(end)]);
  if (!limited.rowCount) throw Object.assign(problem('Too many codes requested. Please try again later.', 429),
    { retryAfter: Math.ceil((end - now) / 1000) });
  await pool.query('DELETE FROM santa_free_message_verifications WHERE expires_at <= now()');
  const id = randomUUID(), binding = randomBytes(32).toString('base64url');
  const code = String(randomInt(0, 1000000)).padStart(6, '0');
  await pool.query(`INSERT INTO santa_free_message_verifications(id,binding_hash,code_hash,contact,expires_at)
    VALUES($1,$2,$3,$4,now()+interval '15 minutes')`,
  [id, digest(`binding:${binding}`), digest(`${id}:${code}`), sealContact({ email, firstName: fields.FIRSTNAME.trim(), lastName: fields.LASTNAME.trim(),
    marketingOptIn: fields.marketingOptIn === true, consentVersion: FREE_MARKETING_VERSION })]);
  try {
    await send({ email, code, marketingOptIn: fields.marketingOptIn === true });
    await pool.query('UPDATE santa_free_message_verifications SET delivered=true WHERE id=$1', [id]);
  } catch (error) {
    await pool.query('DELETE FROM santa_free_message_verifications WHERE id=$1', [id]);
    throw error;
  }
  return { id, binding };
}
export async function confirmFreeMessageCode({ id, code, binding }, pool = databasePool(), subscribe = subscribeFreeMessageContact) {
  if (!/^[a-f0-9-]{36}$/.test(id || '') || !/^\d{6}$/.test(code || '') || !binding) {
    throw problem('Enter the six-digit code from your email.');
  }
  const client = await pool.connect();
  let email, failure, marketingStatus = 'not-requested';
  try {
    await client.query('BEGIN');
    const row = (await client.query(`SELECT *,expires_at>now() AS fresh FROM santa_free_message_verifications
      WHERE id=$1 AND binding_hash=$2 FOR UPDATE`, [id, digest(`binding:${binding}`)])).rows[0];
    if (!row || !row.fresh || !row.delivered || row.attempts >= 5) {
      failure = problem('This code has expired or reached its attempt limit. Please request a new code.', 409);
    } else if (!timingSafeEqual(Buffer.from(row.code_hash), Buffer.from(digest(`${id}:${code}`)))) {
      await client.query('UPDATE santa_free_message_verifications SET attempts=attempts+1 WHERE id=$1', [id]);
      failure = problem('That code doesn’t match. Check your email and try again.');
    } else {
      const contact = openContact(row.contact);
      email = contact?.email;
      if (!email) throw new Error('Verification contact unavailable');
      if (contact.marketingOptIn === true && contact.consentVersion === FREE_MARKETING_VERSION) {
        marketingStatus = await subscribe(contact);
        await client.query(`INSERT INTO santa_free_message_consents
          (verification_id,email_key,consent_version,consent_copy,subscription_status,confirmed_at)
          VALUES($1,$2,$3,$4,$5,now()) ON CONFLICT(verification_id) DO NOTHING`,
        [id, digest(`email:${email}`), FREE_MARKETING_VERSION, FREE_MARKETING_COPY, marketingStatus]);
      }
      await client.query('DELETE FROM santa_free_message_verifications WHERE id=$1', [id]);
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
  if (failure) throw failure;
  return { email, marketingStatus };
}
