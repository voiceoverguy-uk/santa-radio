import { SONG_FORM_URL, SONG_REQUEST_TIMEOUT_MS } from '../src/lib/songSubmission.js';
import { normalizeVotingEmail } from './contender-consent.js';

const validName = value => typeof value === 'string' && value.trim().length > 0 &&
  value.length <= 200 && !/[\u0000-\u001f\u007f]/.test(value);
export const validVoteContact = value => validName(value?.firstName) && validName(value?.lastName) &&
  Boolean(normalizeVotingEmail(value?.email));
const invalid = () => Object.assign(new Error('The existing song form requires your actual first name, surname and a valid email. Nothing was forwarded.'), {status:400});

// The existing hosted SONG form requires names and cannot accept the public
// email-only ballot contract. Keep it isolated until a compatible route exists.
export const EMAIL_ONLY_BREVO_ROUTING_READY = false;
export const preparePreviewVoteNotification = () => async () => ({ delivery: 'simulated' });

// Same hosted SONG destination and actual supported fields as songSubmission.js.
// No invented visitor names, extra Brevo attributes or lyrics/media attachments.
export function buildSongVotePayload({firstName,lastName,email,artist,title,voteReference,marketingOptIn=false}) {
  if (!validVoteContact({firstName,lastName,email}) ||
      !/^[a-f0-9-]{36}$/.test(voteReference || '') ||
      typeof artist !== 'string' || !artist.trim() || artist.length > 120 ||
      typeof title !== 'string' || !title.trim() || title.length > 160) throw invalid();
  const message = [
    'CHRISTMAS CONTENDERS VOTE',
    `Vote reference: ${voteReference}`,
    `Artist: ${artist}`,
    `Song: ${title}`,
    `Marketing opt-in: ${marketingOptIn ? 'YES' : 'NO'}`,
  ].join('\n');
  if (message.length > 500) throw Object.assign(new Error('The complete vote notification exceeds the song form’s 500-character message limit. Nothing was forwarded.'), {status:400});
  const body = new FormData();
  for (const [key,value] of Object.entries({
    FIRSTNAME:firstName.trim(), LASTNAME:lastName.trim(), EMAIL:normalizeVotingEmail(email),
    SONG_REQUEST:message, email_address_check:'', locale:'en',
  })) body.append(key,value);
  return {destination:`${SONG_FORM_URL}?isAjax=1`,body};
}

// Prepared adapter for an explicitly authorised future launch. NOT called by the
// preview route. Hosted forms offer no idempotency key or inbox-delivery receipt.
export async function sendSongVoteNotification(payload, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(payload.destination, {
      method:'POST',body:payload.body,signal:AbortSignal.timeout(SONG_REQUEST_TIMEOUT_MS),
      redirect:'error',credentials:'omit',cache:'no-store',
    });
    const data = await response.json();
    if (response.type === 'opaque' || response.type === 'opaqueredirect') return {delivery:'unknown'};
    if (response.ok && data?.success === true) return {delivery:'accepted'};
    if ((response.ok || [400,422].includes(response.status)) && data?.success === false) return {delivery:'failed'};
  } catch { /* Never log/return provider bodies, addresses, names or error URLs. */ }
  return {delivery:'unknown'};
}

// Every public preview confirmation uses this; there is no live flag or request
// field that can opt into network forwarding.
export async function simulateSongVoteNotification(_payload, scenario = 'accepted') {
  return {delivery:scenario === 'accepted' ? 'simulated' : scenario === 'rejected' ? 'failed' : 'unknown'};
}
