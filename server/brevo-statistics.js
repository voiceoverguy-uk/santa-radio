// Aggregate reporting only: never expose recipients or the API credential.
export async function brevoStatistics({env=process.env, fetchImpl=fetch}={}) {
  if (!env.BREVO_API_KEY) return null;
  const response=await fetchImpl('https://api.brevo.com/v3/smtp/statistics/aggregatedReport?days=30', {
    headers:{'api-key':env.BREVO_API_KEY,accept:'application/json'},
    signal:AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error('BREVO_REPORT_UNAVAILABLE');
  const body=await response.json();
  const result={range:typeof body.range==='string'?body.range:null};
  for (const key of ['requests','delivered','hardBounces','softBounces','blocked','spamReports']) {
    if (!Number.isSafeInteger(body[key]) || body[key]<0) throw new Error('BREVO_REPORT_INVALID');
    result[key]=body[key];
  }
  return result;
}
