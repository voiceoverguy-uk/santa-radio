import { ORIGIN } from '../src/seo/catalogue.js';
import { canonicalPaths } from '../src/seo/routes.js';
export function sitemap() {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${canonicalPaths.map(path => `<url><loc>${ORIGIN}${path}</loc></url>`).join('')}</urlset>`;
}
export function robots() {
  return `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`;
}
export function publicPageHtml(template, result) {
  // Remove inherited homepage metadata and built-page schema before applying the route head.
  let html = template.replace(/<title>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta\b[^>]*(?:name|property)=["'](?:description|robots|og:[^"']+|twitter:[^"']+)["'][^>]*>/gi, '')
    .replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi, '')
    .replace(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, '');
  html = html.replace('</head>', `${result.head}\n</head>`);
  html = html.replace(/<div id="root"><\/div>/, `<div id="root">${result.markup}</div>`);
  html = html.replace('</body>', `<noscript><nav aria-label="No-JavaScript navigation" style="padding:1rem"><a href="/">Home</a> · <a href="/christmas-music">Christmas Music</a> · <a href="/mugshots/all">Mug Shots</a> · <a href="/santa-tracker">Santa Tracker</a></nav><p style="padding:1rem">The updating map and interactive controls need JavaScript. You can still browse every linked page, read biographies and open lyrics.</p><audio controls preload="none" aria-label="Listen to Santa Radio" src="https://global.citrus3.com:8164/"></audio></noscript></body>`);
  return html;
}
