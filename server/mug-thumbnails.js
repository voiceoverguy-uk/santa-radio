import { mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
import { mugs } from '../src/seo/catalogue.js';
import { mugThumbnail } from '../src/seo/mugImages.js';
const sources = new Map(mugs.flatMap(mug => [320, 640].map(width => [mugThumbnail(mug.image, width), { image: mug.image, width }])));
const pending = new Map();
export async function thumbnailFile(path) {
  const source = sources.get(path);
  if (!source) return null;
  if (pending.has(path)) return pending.get(path);
  const work = (async () => {
    const directory = join(tmpdir(), 'santa-radio-mug-thumbnails');
    await mkdir(directory, { recursive: true });
    const file = join(directory, path.split('/').at(-1));
    const input = `public${source.image}`;
    const original = await stat(input);
    try { if ((await stat(file)).mtimeMs >= original.mtimeMs) return file; } catch { /* Generate missing thumbnail. */ }
    await new Promise((resolve, reject) => {
      const child = spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-threads', '1', '-i', input, '-vf', `scale=${source.width}:-2`, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '80', '-threads', '1', file]);
      let error = '';
      child.stderr.on('data', data => { error += data; });
      child.on('error', reject);
      child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Thumbnail failed for ${source.image}: ${error}`)));
    });
    return file;
  })();
  pending.set(path, work);
  try { return await work; } finally { pending.delete(path); }
}
