import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// This project installs public npm packages, not workspace/file dependencies.
// Do not rewrite sources automatically: review the exact public package and
// compare its bytes against the existing SRI before changing a lockfile URL.
const urls = text => text.match(/https?:\/\/[^\s"'<>\\)]+/g) || [];
function privateHost(host) {
  host = host.toLowerCase().replace(/^\[|\]$/g, '');
  return host === 'localhost' || !host.includes('.') || host.endsWith('.localhost') ||
    host.endsWith('.internal') || host.endsWith('.local') || host.endsWith('.replit.dev') ||
    host === '::1' || /^(?:fc|fd|fe80):/i.test(host) ||
    /^(?:0|10|127)\./.test(host) || /^169\.254\./.test(host) ||
    /^192\.168\./.test(host) || /^172\.(?:1[6-9]|2\d|3[01])\./.test(host);
}
function checkConfigUrls(text, label, errors) {
  for (const value of urls(text)) {
    try {
      const url = new URL(value);
      if (privateHost(url.hostname) || url.username || url.password) {
        errors.push(`${label}: private/local or credential-bearing dependency URL`);
      } else if (url.protocol !== 'https:') {
        errors.push(`${label}: dependency URL must use HTTPS`);
      }
    } catch { errors.push(`${label}: invalid dependency URL`); }
  }
}
export function inspectLock(lock, label = 'package-lock.json') {
  const errors = [];
  if (!lock?.packages || typeof lock.packages !== 'object') {
    return { count: 0, errors: [`${label}: expected npm packages lock structure`] };
  }
  let count = 0;
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (!path) continue;
    count++;
    try {
      const url = new URL(entry.resolved);
      if (url.protocol !== 'https:' || url.hostname !== 'registry.npmjs.org' ||
          url.username || url.password || url.port || url.search || url.hash ||
          !url.pathname.endsWith('.tgz')) {
        errors.push(`${label}: ${path} must use an official public HTTPS npm tarball`);
      }
    } catch { errors.push(`${label}: ${path} has no portable npm tarball URL`); }
    if (!entry.version || entry.link) errors.push(`${label}: ${path} must be a locked registry package`);
    if (typeof entry.integrity !== 'string' ||
        !/^sha(?:1|256|384|512)-[A-Za-z0-9+/]+={0,2}(?:\s+sha(?:1|256|384|512)-[A-Za-z0-9+/]+={0,2})*$/.test(entry.integrity)) {
      errors.push(`${label}: ${path} is missing valid npm integrity verification`);
    }
  }
  return { count, errors };
}
export function inspectManifest(manifest) {
  const errors = [];
  checkConfigUrls(JSON.stringify(manifest), 'package.json', errors);
  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    for (const [name, value] of Object.entries(manifest[field] || {})) {
      if (typeof value === 'string' && /^(?:file|link|workspace):/.test(value)) {
        errors.push(`package.json: ${field}.${name} is a non-registry dependency requiring portability review`);
      }
    }
  }
  return errors;
}
export async function inspectProject(root = process.cwd()) {
  const files = await readdir(root);
  const errors = [];
  let count = 0;
  const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  errors.push(...inspectManifest(manifest));
  for (const file of ['package-lock.json', 'npm-shrinkwrap.json'].filter(file => files.includes(file))) {
    const result = inspectLock(JSON.parse(await readFile(resolve(root, file), 'utf8')), file);
    count += result.count;
    errors.push(...result.errors);
  }
  if (!files.includes('package-lock.json')) errors.push('Missing package-lock.json; an exact npm ci install is required');
  const settings = files.filter(file =>
    ['.npmrc', '.yarnrc', '.yarnrc.yml', 'pnpm-workspace.yaml', 'pnpm-lock.yaml',
      'yarn.lock', 'bun.lock', 'bunfig.toml', 'pyproject.toml', 'uv.lock'].includes(file) ||
    /^requirements.*\.txt$/.test(file));
  for (const file of settings) {
    checkConfigUrls(await readFile(resolve(root, file), 'utf8'), file, errors);
  }
  if (files.includes('bun.lockb')) errors.push('bun.lockb requires explicit source review; this project uses npm ci');
  if (files.includes('vercel.json')) {
    const config = JSON.parse(await readFile(resolve(root, 'vercel.json'), 'utf8'));
    for (const field of ['installCommand', 'buildCommand', 'devCommand']) {
      checkConfigUrls(config[field] || '', `vercel.json ${field}`, errors);
    }
  }
  return { count, settings, errors };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await inspectProject();
    if (result.errors.length) {
      console.error('Dependency portability check failed:\n' + result.errors.map(error => `- ${error}`).join('\n'));
      process.exitCode = 1;
    } else {
      console.log(`Dependency portability passed: ${result.count} locked npm packages; project package settings checked.`);
    }
  } catch {
    console.error('Dependency portability check could not read valid project package configuration.');
    process.exitCode = 1;
  }
}
