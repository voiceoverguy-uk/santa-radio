import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';

// Run after npm run build; exercise generated pages and the actual Node server.
const footerLinks = [
  ['/', 'News'],
  ['/christmas-music', 'Playlist'],
  ['https://www.santaguy.co.uk', 'Voice of Santa'],
  ['/submit-a-song?mode=song', 'Submit your song'],
  ['/christmas-contenders', 'Christmas Contenders · Preview'],
  ['https://festivestudio.co.uk/', 'Personalised Santa Video Message'],
  ['/apps', 'Download the app'],
  ['/links', 'Links'],
  ['/privacy-policy', 'Privacy Policy'],
  ['/photo-usage-and-licensing', 'Photo usage and licensing'],
];

function assertStandardFooter(html, source) {
  const footer = html.match(/<footer\b[\s\S]*?<\/footer>/)?.[0];
  assert.ok(footer, `${source}: shared footer is present`);

  const linksBlock = footer.match(/<div class="footer-links">([\s\S]*?)<\/div>/)?.[1];
  assert.ok(linksBlock, `${source}: standard footer links are present`);
  const links = [...linksBlock.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(([, attributes, content]) => {
    const href = attributes.match(/\bhref="([^"]*)"/)?.[1];
    const label = content.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]*>/g, '').trim();
    return { href, label, attributes };
  });
  assert.deepEqual(links.map(({ href, label }) => [href, label]), footerLinks, `${source}: standard links and order`);

  const voiceLinks = links.filter(link => link.href === 'https://www.santaguy.co.uk');
  assert.equal(voiceLinks.length, 1, `${source}: exactly one Voice of Santa destination`);
  for (const link of links.filter(({ href }) => /^https?:\/\//.test(href))) {
    assert.match(link.attributes, /\btarget="_blank"/, `${source}: ${link.label} opens in a new tab`);
    assert.match(link.attributes, /\brel="noopener noreferrer"/, `${source}: ${link.label} protects the opener`);
  }

  const socialLinks = [...footer.matchAll(/<a\b([^>]*)aria-label="(Instagram|Facebook)"([^>]*)>/g)];
  assert.deepEqual(socialLinks.map(([, before, label, after]) => ({
    label,
    attributes: `${before} ${after}`,
  })).map(({ label, attributes }) => {
    assert.match(attributes, /\btarget="_blank"/, `${source}: ${label} opens in a new tab`);
    assert.match(attributes, /\brel="noopener noreferrer"/, `${source}: ${label} protects the opener`);
    return label;
  }), ['Instagram', 'Facebook'], `${source}: social links remain available`);
}

test('standard footer links survive generated pages and Node SSR delivery', async t => {
  const child = spawn(process.execPath, ['index.js', '--port=0'], { stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => child.kill('SIGTERM'));
  const port = await new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(new Error(`Production server did not start: ${output}`)), 10000);
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Production server exited: ${code}: ${output}`)); });
    child.stdout.on('data', data => {
      output += data.toString();
      const match = output.match(/listening on port (\d+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
    child.stderr.on('data', data => { output += data.toString(); });
  });

  for (const path of [
    'dist/privacy-policy/index.html',
    'dist/server/pages/privacy-policy/index.html',
  ]) {
    assertStandardFooter(await readFile(path, 'utf8'), path);
  }

  const { render } = await import('../dist/server/entry-server.js');
  const directSsr = render('/privacy-policy');
  assertStandardFooter(`${directSsr.head}${directSsr.markup}`, 'built renderer');
  const dynamicSsr = render('/sign-in');
  assertStandardFooter(`${dynamicSsr.head}${dynamicSsr.markup}`, 'built renderer sign-in route');

  for (const path of ['/privacy-policy', '/sign-in']) {
    const response = await fetch(`http://127.0.0.1:${port}${path}`);
    assert.equal(response.status, 200, path);
    assertStandardFooter(await response.text(), `Node server ${path}`);
  }
});
