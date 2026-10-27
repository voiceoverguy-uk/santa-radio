// Requires Poppler (pdftoppm) and libwebp (cwebp). Use --replace after master changes.
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { allCertificateExamples as certificateExamples } from '../src/lib/santaCertificateExamples.js';
import { personaliseNiceListCertificate } from '../src/lib/niceListCertificate.js';

const workdir = 'generated-artifacts/certificate-examples';
const replace = process.argv.includes('--replace');
await mkdir(workdir, { recursive: true });
const assets = await Promise.all([
  'public/certificates/nice-list/master.pdf',
  'public/certificates/nice-list/GreatVibes-Regular.ttf',
].map(path => readFile(path)));

for (const { name, src } of certificateExamples) {
  const destination = `public${src}`;
  if (!replace && existsSync(destination)) continue;
  const stem = `${workdir}/${name.toLowerCase()}`;
  const pdf = await personaliseNiceListCertificate(name, assets);
  await writeFile(`${stem}.pdf`, Buffer.from(await pdf.arrayBuffer()));
  execFileSync('pdftoppm', [
    '-singlefile', '-scale-to-x', '1800', '-scale-to-y', '-1',
    '-png', `${stem}.pdf`, stem,
  ]);
  execFileSync('cwebp', ['-quiet', '-q', '85', `${stem}.png`, '-o', destination]);
  console.log(`Created ${destination}`);
}
