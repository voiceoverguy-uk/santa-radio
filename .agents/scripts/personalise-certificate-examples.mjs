// Use the exact browser download implementation, not the old supplied examples.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { personaliseNiceListCertificate } from '../../src/lib/niceListCertificate.js';

const assets = await Promise.all([
  'public/certificates/nice-list/master.pdf',
  'public/certificates/nice-list/GreatVibes-Regular.ttf',
].map(path => readFile(path)));
await mkdir('generated-artifacts/nice-list/examples', { recursive: true });
for (const name of ['Edward', 'Ayla']) {
  const blob = await personaliseNiceListCertificate(name, assets);
  await writeFile(`generated-artifacts/nice-list/examples/${name.toLowerCase()}.pdf`,
    Buffer.from(await blob.arrayBuffer()));
}
