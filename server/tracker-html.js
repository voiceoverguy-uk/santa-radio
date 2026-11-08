import { getTrackerMetadata, TRACKER_IMAGE_ALT, TRACKER_URL } from '../src/tracker/lib/trackerBrand.js';

export function isTrackerPreview(pathname) {
  return /^\/santa-tracker\/preview\/?$/.test(pathname);
}

const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

// Supply route-specific metadata to social crawlers before React loads.
// Used by Vite, the existing Node server, and the static build output.
export function trackerPageHtml(html, pathname, now = new Date()) {
  const preview = isTrackerPreview(pathname);
  if (!preview && !/^\/santa-tracker\/?$/.test(pathname)) return html;
  const metadata = getTrackerMetadata(now);
  const title = preview ? 'Development Preview | Santa Tracker — Santa Radio' : metadata.title.absolute;
  const description = preview
    ? 'Development-only Santa Tracker time-jump controls. Simulated dates do not affect the visitor tracker.'
    : metadata.description;
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escape(title)}</title>`);
  const values = {
    description,
    robots: preview ? 'noindex, follow' : 'index, follow',
    'og:title': title, 'og:description': description, 'og:url': TRACKER_URL,
    'og:site_name': 'Santa Radio', 'og:type': 'website', 'og:locale': 'en_GB',
    'og:image': metadata.openGraph.images[0].url,
    'og:image:alt': TRACKER_IMAGE_ALT,
    'og:image:width': String(metadata.openGraph.images[0].width),
    'og:image:height': String(metadata.openGraph.images[0].height),
    'og:image:type': 'image/jpeg',
    'twitter:card': 'summary_large_image', 'twitter:title': title,
    'twitter:description': description, 'twitter:site': '@wearesantaradio',
    'twitter:creator': '@voiceoverman', 'twitter:image': metadata.twitter.images[0],
    'twitter:image:alt': TRACKER_IMAGE_ALT,
  };
  for (const [key, content] of Object.entries(values)) {
    const attribute = key.startsWith('og:') ? 'property' : 'name';
    const pattern = new RegExp(`<meta\\b[^>]*(?:name|property)=["']${key}["'][^>]*>`, 'gi');
    html = html.replace(pattern, '');
    html = html.replace('</head>', `<meta data-rh="true" ${attribute}="${key}" content="${escape(content)}" />\n</head>`);
  }
  html = html.replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi, '');
  if (!preview) {
    html = html.replace('</head>', `<link data-rh="true" rel="canonical" href="${TRACKER_URL}" />\n</head>`);
    html = html.replace('</body>', `<noscript><section style="padding:6rem 2rem;color:#fff;background:#0a1628"><h1>Santa Radio — Santa Tracker</h1><p>Follow Santa’s estimated 290-stop Christmas Eve journey around the world, with a countdown, festive facts and holiday postcards. His make-believe itinerary starts in Kiritimati at 10:00 UTC on 24 December and finishes in Honolulu, Hawaii, at 11:20 UTC on 25 December. This is not verified live tracking.</p><p>Enable JavaScript to see the updating regional maps and listen to Santa Radio.</p></section></noscript>\n</body>`);
  }
  return html;
}
