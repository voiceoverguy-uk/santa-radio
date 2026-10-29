// HTTP request targets starting // are local paths, not protocol-relative hosts.
// Keep all separators for exact-match routing; never normalize arbitrary paths.
export function publicRequestUrl(raw, origin = 'https://www.santaradio.co.uk') {
  return new URL(raw.startsWith('/') ? origin + raw : raw, origin);
}
