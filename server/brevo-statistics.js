// Aggregate reporting only: never expose recipients or the API credential.
export async function brevoStatistics({env=process.env, fetchImpl=fetch}={}) {
  if (!env.BREVO_API_KEY) return {error:'not_configured'};
  const response=await fetchImpl('https://api.brevo.com/v3/smtp/statistics/aggregatedReport?days=30', {
    headers:{'api-key':env.BREVO_API_KEY,accept:'application/json'},
    signal:AbortSignal.timeout(8000)
  });
  if (!response.ok) return {error:response.status===401||response.status===403?'access_denied':response.status===429?'rate_limited':'service_unavailable'};
  const body=await response.json();
  if (!body || typeof body!=='object' || !Object.hasOwn(body,'range')) return {error:'invalid_response'};
  const result={range:typeof body.range==='string'?body.range:null};
  for (const key of ['requests','delivered','hardBounces','softBounces','blocked','spamReports']) {
    if (body[key] == null) { result[key]=null; continue; }
    if (!Number.isSafeInteger(body[key]) || body[key]<0) return {error:'invalid_response'};
    result[key]=body[key];
  }
  return result;
}
