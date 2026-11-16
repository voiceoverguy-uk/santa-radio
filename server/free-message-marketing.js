// Verified, explicit email opt-in only. Never changes SMS or transactional suppression.
export async function subscribeFreeMessageContact({ email, firstName, lastName }, { fetcher = fetch, env = process.env } = {}) {
  if (!env.BREVO_API_KEY) throw new Error('BREVO_UNAVAILABLE');
  // Existing Santa Message Form list, confirmed in the Santa Radio Brevo account.
  const listId = 8;
  const endpoint = `https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`;
  const request = (url, method, body) => fetcher(url, {
    method, redirect: 'error', signal: AbortSignal.timeout(4000),
    headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const current = await request(endpoint, 'GET');
  const attributes = { FIRSTNAME: firstName, LASTNAME: lastName, OPT_IN: true, 'DOUBLE_OPT-IN': 1 };
  let response;
  if (current.ok) {
    const contact = await current.json();
    // A previous unsubscribe or suppression is not silently overwritten.
    if (contact.emailBlacklisted === true) return 'suppressed';
    response = await request(endpoint, 'PUT', { attributes, listIds: [listId] });
  } else if (current.status === 404) {
    response = await request('https://api.brevo.com/v3/contacts', 'POST', {
      email, attributes, listIds: [listId], updateEnabled: false,
    });
  } else throw new Error('BREVO_CONTACT_LOOKUP_FAILED');
  if (!response.ok) throw new Error('BREVO_SUBSCRIPTION_FAILED');
  return 'subscribed';
}
