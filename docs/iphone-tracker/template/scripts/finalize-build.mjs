import fs from 'node:fs';
// Vite's HTML entry assumes an ES module. The output is intentionally IIFE.
const file = 'dist/index.html';
const html = fs.readFileSync(file, 'utf8')
  .replace(/<script type="module" crossorigin/g, '<script defer')
  .replace(/<link rel="stylesheet" crossorigin/g, '<link rel="stylesheet"');
if (/type="module"|modulepreload/.test(html)) throw Error('Unexpected module dependency');
fs.writeFileSync(file, html);
console.log('Prepared relative-path classic-script bundle for local embedding.');
