// No script/connect/default-src restrictions: existing external media, Clerk,
// Brevo and Stripe remain compatible. Permit Replit preview and Upstream Studio frames.
export const browserHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "base-uri 'self'; object-src 'none'; frame-ancestors 'self' https://replit.com https://*.replit.com https://*.replit.dev https://studio.upstream.so",
};
export function browserSecurity(_req, res, next) {
  for (const [name, value] of Object.entries(browserHeaders)) res.setHeader(name, value);
  next?.();
}
