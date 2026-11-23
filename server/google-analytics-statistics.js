import { sign } from 'node:crypto';

// Credentials are server-only. Never return Google responses or tokens to the browser.
export function createVisitorReport({ env = process.env, fetcher = fetch, now = () => Date.now() } = {}) {
  let cached, expires = 0, pending;
  async function load() {
    const key = JSON.parse(env.GOOGLE_ANALYTICS_SERVICE_ACCOUNT_JSON || 'null');
    if (!key?.client_email || !key?.private_key) throw new Error('Analytics is not configured.');
    const property = env.GOOGLE_ANALYTICS_PROPERTY_ID || '371094204';
    if (!/^\d+$/.test(property)) throw new Error('Invalid Analytics property.');
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const seconds = Math.floor(now() / 1000);
    const unsigned = encode({ alg: 'RS256', typ: 'JWT' }) + '.' + encode({
      iss: key.client_email, scope: 'https://www.googleapis.com/auth/analytics.readonly',
      aud: 'https://oauth2.googleapis.com/token', iat: seconds, exp: seconds + 3600,
    });
    const assertion = unsigned + '.' + sign('RSA-SHA256', Buffer.from(unsigned), key.private_key).toString('base64url');
    const tokenResponse = await fetcher('https://oauth2.googleapis.com/token', {
      method: 'POST', signal: AbortSignal.timeout(10000),
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    });
    if (!tokenResponse.ok) throw new Error('Analytics authentication failed.');
    const token = await tokenResponse.json();
    const end = new Date(new Intl.DateTimeFormat('en-CA', { timeZone: env.GOOGLE_ANALYTICS_TIME_ZONE || 'America/Los_Angeles', year:'numeric', month:'2-digit', day:'2-digit' }).format(now()) + 'T12:00:00Z');
    end.setUTCDate(end.getUTCDate() - 1);
    const start = new Date(end); start.setUTCDate(start.getUTCDate() - 29);
    const date = d => d.toISOString().slice(0, 10);
    const response = await fetcher(`https://analyticsdata.googleapis.com/v1beta/properties/${property}:runReport`, {
      method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ dateRanges: [{ startDate: date(start), endDate: date(end) }],
        dimensions: [{ name: 'date' }], metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }],
        dimensionFilter: { filter: { fieldName: 'hostName', inListFilter: { values: ['santaradio.co.uk', 'www.santaradio.co.uk'] } } },
        orderBys: [{ dimension: { dimensionName: 'date' } }], limit: 30 }),
    });
    if (!response.ok) throw new Error('Analytics reporting failed.');
    const report = await response.json();
    const rows = new Map((report.rows || []).map(row => [row.dimensionValues[0].value, row.metricValues]));
    const days = Array.from({ length: 30 }, (_, index) => {
      const day = new Date(start); day.setUTCDate(day.getUTCDate() + index);
      const values = rows.get(date(day).replaceAll('-', ''));
      return { date: date(day), visitors: Number(values?.[0]?.value || 0), views: Number(values?.[1]?.value || 0) };
    });
    return { days, timeZone: report.metadata?.timeZone || env.GOOGLE_ANALYTICS_TIME_ZONE || 'America/Los_Angeles', fetchedAt: new Date(now()).toISOString() };
  }
  return async () => {
    if (cached && now() < expires) return cached;
    if (!pending) pending = load().then(result => { cached = result; expires = now() + 15 * 60 * 1000; return result; }).finally(() => { pending = null; });
    return pending;
  };
}
export const visitorReport = createVisitorReport();
