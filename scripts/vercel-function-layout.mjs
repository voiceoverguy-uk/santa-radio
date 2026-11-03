import { posix } from 'node:path';
import { readlink } from 'node:fs/promises';

const escapes = path => path === '..' || path.startsWith('../') || posix.isAbsolute(path);
const isLink = entry => (entry.mode & 0o170000) === 0o120000;

// Inspect the actual Vercel Node builder's file map, not source directories.
// A valid directory symlink may have its target in the map, but never children
// under the symlink itself: the deployment extractor cannot create both.
export async function inspectFunctionFiles(files, handler) {
  const errors = [];
  const paths = Object.keys(files);
  const links = new Map();
  for (const [path, entry] of Object.entries(files)) {
    if (escapes(path) || path.includes('\\') || posix.normalize(path) !== path) {
      errors.push(`Invalid package path: ${path}`);
    }
    if (isLink(entry)) {
      const target = entry.type === 'FileFsRef'
        ? await readlink(entry.fsPath) : String(entry.data);
      links.set(path, target);
    }
  }
  const resolveLink = (path, seen = new Set()) => {
    const parts = path.split('/');
    for (let i = 1; i <= parts.length; i++) {
      const prefix = parts.slice(0, i).join('/');
      if (!links.has(prefix)) continue;
      if (seen.has(prefix)) throw new Error(`Cyclic symlink: ${prefix}`);
      seen.add(prefix);
      const target = links.get(prefix);
      if (posix.isAbsolute(target)) throw new Error(`Absolute symlink: ${prefix}`);
      const resolved = posix.normalize(posix.join(posix.dirname(prefix), target, ...parts.slice(i)));
      if (escapes(resolved)) throw new Error(`Escaping symlink: ${prefix}`);
      return resolveLink(resolved, seen);
    }
    return path;
  };
  for (const path of links.keys()) {
    for (const child of paths.filter(child => child.startsWith(path + '/'))) {
      errors.push(`Symlink/file overlap: ${path} contains ${child}`);
    }
    try {
      const target = resolveLink(path);
      if (!files[target] && !paths.some(path => path.startsWith(target + '/'))) {
        errors.push(`Broken symlink: ${path}`);
      }
    } catch (error) { errors.push(error.message); }
  }
  if (!handler || !files[handler]) errors.push(`Missing function handler: ${handler}`);
  return errors;
}
