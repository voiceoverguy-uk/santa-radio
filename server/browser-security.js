// No script/connect/default-src restrictions: existing external media, Clerk,
// Brevo and Stripe remain compatible. Permit Replit preview and Upstream Studio frames.
export const browserHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "base-uri 'self'; object-src 'none'; frame-ancestors 'self' https://replit.com https://*.replit.com https://*.replit.dev https://studio.upstream.so",
};
export function browserSecurity(req, res, next) {
  for (const [name, value] of Object.entries(browserHeaders)) res.setHeader(name, value);
  const path = new URL(req.originalUrl || req.url || '/', 'https://www.santaradio.co.uk').pathname;
  if (/^\/s[tr]yt\/?$/i.test(path)) res.setHeader('Content-Security-Policy', "base-uri 'self'; object-src 'none'; frame-ancestors 'self' https://upstream.so https://*.upstream.so");
  next?.();
}
