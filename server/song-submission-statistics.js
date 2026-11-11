// This is the verified Song Suggestions list, not the general enquiry list.
// Brevo stores the latest message per contact, not a submission event ledger.
export async function songSubmissionStatistics({env=process.env, fetchImpl=fetch, offset=0}={}) {
  if (!env.BREVO_API_KEY) return {error:'not_configured'};
  const response = await fetchImpl(`https://api.brevo.com/v3/contacts/lists/10/contacts?limit=50&offset=${offset}&sort=desc`, {
    headers:{'api-key':env.BREVO_API_KEY,accept:'application/json'},
    signal:AbortSignal.timeout(8000),
  });
  if (!response.ok) return {error:[401,403].includes(response.status)?'access_denied':response.status===429?'rate_limited':'service_unavailable'};
  const body = await response.json();
  if (!Array.isArray(body.contacts) || !Number.isSafeInteger(body.count) || body.count<0) return {error:'invalid_response'};
  const text = value => typeof value==='string' ? value.slice(0,10000) : '';
  if (body.contacts.some(c=>!Number.isSafeInteger(c.id))) return {error:'invalid_response'};
  return {count:body.count,offset,nextOffset:offset+body.contacts.length<body.count && body.contacts.length ? offset+body.contacts.length : null,
    contacts:body.contacts.map(c=>({id:c.id,name:[text(c.attributes?.FIRSTNAME),text(c.attributes?.LASTNAME)].filter(Boolean).join(' '),
      message:text(c.attributes?.SONG_REQUEST),createdAt:text(c.createdAt),modifiedAt:text(c.modifiedAt)}))};
}
