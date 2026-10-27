// Run from the extracted ZIP root: node handover/inspect-package.mjs
import { readFile, readdir } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const root = process.cwd();
const manifest = JSON.parse(await readFile('FILE-MANIFEST.json', 'utf8'));
const missingImports = [], missingAssets = [], generatedReferences = [];
let importCount = 0, assetCount = 0;
const isFile = p => existsSync(p) && statSync(p).isFile();
function resolveImport(file, spec) {
  const base = spec.startsWith('@/')
    ? path.join(root, 'src/tracker', spec.slice(2))
    : path.resolve(path.dirname(file), spec);
  return [base, ...['.js', '.jsx', '.ts', '.tsx', '.json', '.css', '.svg'].map(ext => base + ext),
    ...['index.js', 'index.jsx', 'index.ts', 'index.tsx'].map(index => path.join(base, index))]
    .some(isFile);
}
for (const entry of manifest.files) {
  const file = path.join(root, entry.path);
  const content = await readFile(file);
  if (content.length !== entry.bytes || createHash('sha256').update(content).digest('hex') !== entry.sha256) {
    throw new Error(`Manifest mismatch: ${entry.path}`);
  }
  if (!/^(src|server|api|scripts)\//.test(entry.path) && !/^(index|vite\.config)\./.test(entry.path)) continue;
  if (!/\.(?:js|jsx|ts|tsx|mjs|cjs|css)$/.test(file)) continue;
  const text = content.toString();
  // TypeScript's preprocessor reports static imports and literal dynamic imports.
  const imports = ts.preProcessFile(text, true, true).importedFiles;
  for (const { fileName: spec } of imports) {
    if (!spec.startsWith('.') && !spec.startsWith('@/')) continue;
    importCount++;
    if (!resolveImport(file, spec.split('?')[0])) {
      const target = path.resolve(path.dirname(file), spec);
      if (target === path.join(root, 'dist/server/entry-server.js')) {
        generatedReferences.push({ path: entry.path, spec, producer: 'vite build --ssr' });
      } else missingImports.push({ path: entry.path, spec });
    }
  }
  for (const match of text.matchAll(/["'`](\/(?:images|audio|artist-artwork|mugshot-images|certificates)\/[^"'`$<>?#]+\.[a-zA-Z0-9]+)["'`]/g)) {
    assetCount++;
    if (!existsSync(path.join(root, 'public', match[1]))) {
      if (match[1] === '/artist-artwork/catalogue.json') {
        generatedReferences.push({ path: entry.path, asset: match[1], producer: 'scripts/artwork-feed-plugin.mjs' });
      } else missingAssets.push({ path: entry.path, asset: match[1] });
    }
  }
  if (file.endsWith('.css')) {
    for (const match of text.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)) {
      const spec = match[2].trim();
      if (/^(?:https?:|data:|#|\/\/)/.test(spec)) continue;
      assetCount++;
      const target = spec.startsWith('/')
        ? path.join(root, 'public', spec.split(/[?#]/)[0])
        : path.resolve(path.dirname(file), spec.split(/[?#]/)[0]);
      if (!existsSync(target)) missingAssets.push({ path: entry.path, asset: spec });
    }
  }
}
const files = [];
async function walk(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    if (item.name === 'node_modules') continue; // local verification dependency link only
    const file = path.join(dir, item.name);
    if (item.isDirectory()) await walk(file);
    else files.push(path.relative(root, file).split(path.sep).join('/'));
  }
}
await walk(root);
const expected = new Set([...manifest.files.map(f => f.path), 'FILE-MANIFEST.json']);
const unexpectedFiles = files.filter(file => !expected.has(file));
const unsafePaths = files.filter(file => /(^|\/)(?:\.env[^/]*|\.git|\.cache|test-results|dist)(?:\/|$)|\.(?:zip|log|sqlite|db)$/.test(file));
const scope = JSON.parse(await readFile('EXPORT-SCOPE.json', 'utf8'));
console.log(JSON.stringify({
  manifestFilesVerified: manifest.files.length, importCount, assetCount,
  missingImports, missingAssets, generatedReferences, unexpectedFiles, unsafePaths,
  originalSourceFiles: scope.includedOriginalPaths.length,
}, null, 2));
if (missingImports.length || missingAssets.length || unexpectedFiles.length || unsafePaths.length) process.exitCode = 1;
