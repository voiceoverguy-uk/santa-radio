import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { trackerPageHtml } from '../server/tracker-html.js';

const html = await readFile('dist/index.html', 'utf8');
for (const route of ['/santa-tracker', '/santa-tracker/preview']) {
  const directory = `dist${route}`;
  await mkdir(directory, { recursive: true });
  await writeFile(`${directory}/index.html`, trackerPageHtml(html, route));
}
