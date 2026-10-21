import assert from 'node:assert/strict';

export const faviconFiles = [
  ['/favicon.ico', 'image/x-icon', '16x16 32x32 48x48'],
  ['/favicon.png', 'image/png', '192x192'],
];

export function assertFaviconHead(html) {
  const head = html.split('</head>')[0];
  const icons = [...head.matchAll(/<link\b[^>]*rel="icon"[^>]*>/g)].map(match => match[0]);
  assert.equal(icons.length, faviconFiles.length, 'exactly one declaration per favicon format');
  for (const [path, type, sizes] of faviconFiles) {
    const icon = icons.find(tag => tag.includes(`href="${path}"`));
    assert.ok(icon, `${path} is advertised in initial HTML`);
    assert.ok(icon.includes(`type="${type}"`), `${path}: MIME declaration`);
    assert.ok(icon.includes(`sizes="${sizes}"`), `${path}: declared sizes`);
  }
  assert.ok(!head.includes('/assets/img/santa-radio-logo.png'), 'broken legacy favicon must not return');
}

export async function assertFaviconResponse(response, expected, { head = false, type = 'image/png' } = {}) {
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), type === 'image/x-icon'
    ? /image\/(?:x-icon|vnd\.microsoft\.icon)/
    : /image\/png/);
  assert.equal(response.headers.get('location'), null);
  assert.equal(response.headers.get('x-robots-tag'), null, 'icon must remain crawlable');
  const actual = Buffer.from(await response.arrayBuffer());
  assert.deepEqual(actual, head ? Buffer.alloc(0) : expected);
}
