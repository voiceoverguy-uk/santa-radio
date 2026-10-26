// Use the exact browser download implementation, not the old supplied examples.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { personaliseNiceListCertificate } from '../../src/lib/niceListCertificate.js';

const assets = await Promise.all([
  process.argv[2] || 'public/certificates/nice-list/master.pdf',
  'public/certificates/nice-list/GreatVibes-Regular.ttf',
].map(path => readFile(path)));
const output = process.argv[3] || 'generated-artifacts/nice-list/examples';
await mkdir(output, { recursive: true });
for (const name of ['Edward', 'Ayla']) {
  const blob = await personaliseNiceListCertificate(name, assets);
  await writeFile(`${output}/${name.toLowerCase()}.pdf`,
    Buffer.from(await blob.arrayBuffer()));
}
