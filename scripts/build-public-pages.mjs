import { mkdir, readFile, writeFile, copyFile, stat } from 'node:fs/promises';
import { render } from '../dist/server/entry-server.js';
import { publicPageHtml, sitemap, robots } from '../server/public-html.js';
import { canonicalPaths, legacyMatches } from '../src/seo/routes.js';
import { mugs } from '../src/seo/catalogue.js';
import { mugThumbnail } from '../src/seo/mugImages.js';
import { thumbnailFile } from '../server/mug-thumbnails.js';
const template = await readFile('dist/index.html', 'utf8');
for (const path of [...canonicalPaths, '/santa-tracker/preview', '/santa-message-workshop', '/404']) {
  const result = render(path);
  if (result.status !== 200 && path !== '/404') throw new Error(`Cannot pre-render ${path}: ${result.status}`);
  const directory = path === '/' ? 'dist' : `dist${path}`;
  await mkdir(directory, { recursive: true });
  const html = publicPageHtml(template, result);
  await writeFile(`${directory}/index.html`, html);
  // Include the same real, fully rendered pages inside the document function.
  // Ordinary requests must not need React or its dependencies at runtime.
  const functionDirectory = `dist/server/pages${path === '/' ? '' : path}`;
  await mkdir(functionDirectory, { recursive: true });
  await writeFile(`${functionDirectory}/index.html`, html);
}
await writeFile('dist/sitemap.xml', sitemap());
await writeFile('dist/robots.txt', robots());
await writeFile('dist/404.html', publicPageHtml(template, render('/404')));
// The shell retains hashed scripts/styles but no homepage body for dynamic responses.
await writeFile('dist/server/shell.html', template);
console.log(`Pre-rendered ${canonicalPaths.length} canonical pages. Legacy identity matches: ${legacyMatches.filter(r => r.target).length}/24.`);
await mkdir('dist/mugshot-thumbnails', { recursive: true });
let cursor = 0, originalBytes = 0, thumbnailBytes = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (cursor < mugs.length) {
    const mug = mugs[cursor++];
    const originalSize = (await stat(`public${mug.image}`)).size;
    originalBytes += originalSize;
    for (const width of [320, 640]) {
      const path = mugThumbnail(mug.image, width);
      const file = await thumbnailFile(path);
      await copyFile(file, `dist${path}`);
      if (width === 320) {
        const thumbnailSize = (await stat(file)).size;
        thumbnailBytes += thumbnailSize;
      }
    }
  }
}));
console.log(`Gallery image inventory: ${originalBytes} original bytes → ${thumbnailBytes} bytes at 320px (${Math.round((1 - thumbnailBytes / originalBytes) * 100)}% reduction). Original photographs preserved.`);
