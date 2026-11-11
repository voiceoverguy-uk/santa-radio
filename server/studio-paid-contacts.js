import { verifiedLiveSession } from './studio-live-stripe.js';
import { purchaserFirstName } from './studio-live-access.js';
import { emailDigest } from './studio-live-store.js';

// Server-only opt-in. A missing connection never affects payment or Studio access.
export function paidContactConfig(env = process.env) {
  if (env.STUDIO_BREVO_SYNC_ENABLED !== 'true') return null;
  const listId = Number(env.STUDIO_BREVO_PAID_LIST_ID);
  if (!env.BREVO_API_KEY || !Number.isSafeInteger(listId) || listId < 1) {
    throw new Error('STUDIO_CONTACT_SYNC_NOT_CONFIGURED');
  }
  return { key: env.BREVO_API_KEY, listId };
}

export async function upsertPaidContact({ email, firstName, connection, fetcher = fetch }) {
  const endpoint = `https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`;
  const request = (url, method, body) => fetcher(url, {
    method, redirect: 'error', signal: AbortSignal.timeout(6000),
    headers: { 'api-key': connection.key, 'Content-Type': 'application/json', Accept: 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const current = await request(endpoint, 'GET');
  if (current.ok) {
    const contact = await current.json();
    const attributes = firstName && !contact.attributes?.FIRSTNAME ? { FIRSTNAME: firstName } : {};
    if (contact.listIds?.includes(connection.listId) && !Object.keys(attributes).length) return;
    // Never modify EMAIL, blacklist flags, consent or other list memberships.
    const updated = await request(endpoint, 'PUT', { attributes, listIds: [connection.listId] });
    if (!updated.ok) throw new Error('STUDIO_CONTACT_UPDATE_FAILED');
    return;
  }
  if (current.status !== 404) throw new Error('STUDIO_CONTACT_LOOKUP_FAILED');
  const created = await request('https://api.brevo.com/v3/contacts', 'POST', {
    email, attributes: firstName ? { FIRSTNAME: firstName } : {}, listIds: [connection.listId],
    emailBlacklisted: true, smsBlacklisted: true, updateEnabled: false,
  });
  // Purchase is not marketing consent. New contacts remain excluded from campaigns.
  // A concurrent create returns an error; Stripe retries and takes the update path.
  if (!created.ok) throw new Error('STUDIO_CONTACT_CREATE_FAILED');
}

export async function syncPaidStudioContact({ config, stripe, pool, sessionId,
  connection = paidContactConfig(), send = upsertPaidContact } = {}) {
  if (!connection) return { enabled: false };
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['payment_intent', 'line_items.data.price.product'],
  });
  const email = session.customer_details?.email;
  if (session.id !== sessionId || !verifiedLiveSession(session, config)
    || typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('STUDIO_CONTACT_PAYMENT_NOT_VERIFIED');
  }
  const saved = await pool.query(`SELECT 1 FROM public.santa_studio_live_purchases
    WHERE checkout_session_id=$1 AND email_sha256=$2`, [sessionId, emailDigest(email, config)]);
  if (!saved.rowCount) throw new Error('STUDIO_CONTACT_PURCHASE_NOT_RECORDED');
  await send({ email: email.trim().toLowerCase(), firstName: purchaserFirstName(session), connection });
  return { synced: true };
}
