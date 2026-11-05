import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readlink, writeFile, symlink, chmod, rm } from 'node:fs/promises';
import { delimiter, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { inspectFunctionFiles } from './vercel-function-layout.mjs';

const source = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'SSL_CERT_FILE', 'SSL_CERT_DIR', 'NODE_EXTRA_CA_CERTS']
  .filter(key => process.env[key]).map(key => [key, process.env[key]]));
env.CI = '1';
// No connector credentials, deployment tokens, database or audio-origin
// configuration is passed to installation, compilation or runtime probes.
async function checkPackages() {
  assert.equal(process.versions.node.split('.')[0], '22', 'Use the production Node 22 runtime');
  // npm exec exposes the pinned, external builder through PATH, without adding
  // Vercel or native packages to either of the project's dependency graphs.
  let requireBuilder;
  for (const bin of env.PATH.split(delimiter)) {
    const candidate = createRequire(resolve(bin, '../package.json'));
    try {
      const manifest = candidate('@vercel/node/package.json');
      if (manifest.version === '28.0.0') { requireBuilder = candidate; break; }
    } catch {}
  }
  assert.ok(requireBuilder, 'Run npm run check:vercel-packaging to supply @vercel/node@28.0.0');
  const { build } = requireBuilder('@vercel/node');
  const { glob, findMatchingFunction } = requireBuilder('@vercel/build-utils');
  await mkdir(join(source, 'generated-artifacts/vercel-packaging'), { recursive: true });
  const directory = await mkdtemp(join(source, 'generated-artifacts/vercel-packaging/check-'));
  const workPath = join(directory, 'source');
  await mkdir(workPath);
  // Only version-controlled source, including working-tree edits. In particular
  // do not copy node_modules, dist, .env or local Expo/native dependencies.
  const paths = execFileSync('git', ['ls-files', '-z'], { cwd: source, encoding: 'utf8' }).split('\0').filter(Boolean);
  for (const path of paths) {
    if (path.startsWith('generated-artifacts/')) continue;
    await cp(join(source, path), join(workPath, path), { recursive: true });
  }
  const run = (args, cwd = workPath) => execFileSync(process.execPath, args, {
    cwd, env, stdio: 'inherit', timeout: 240000,
  });
  const smoke = async (packagePath, code) => {
    // Packages retained for evidence live below the workspace, where Node
    // could accidentally fall back to the workspace's ancestor node_modules.
    // Execute a detached copy so a missing trace cannot silently pass.
    const isolated = await mkdtemp(join(tmpdir(), 'santa-function-runtime-'));
    try {
      await cp(packagePath, isolated, { recursive: true });
      run(['--input-type=module', '-e', code], isolated);
    } finally { await rm(isolated, { recursive: true, force: true }); }
  };
  const npm = (args) => execFileSync('npm', args, { cwd: workPath, env, stdio: 'inherit', timeout: 240000 });
  run(['scripts/check-dependency-portability.mjs']);
  npm(['ci', '--no-audit', '--no-fund']);
  npm(['run', 'build']);
  execFileSync(process.execPath, ['--test', 'scripts/dependency-portability.test.mjs', 'scripts/santa-mobile.test.mjs',
    'scripts/santa-mobile-store.test.mjs', 'scripts/santa-render.test.mjs'], {
    cwd: workPath, env: { ...env, SESSION_SECRET: randomBytes(48).toString('hex') },
    stdio: 'inherit', timeout: 120000,
  });
  run(['--test', '--test-name-pattern=deployment-style', 'scripts/seo-serving.test.mjs']);
  const config = JSON.parse(await readFile(join(workPath, 'vercel.json'), 'utf8'));
  const files = await glob('api/**/*.js', workPath);
  const summaries = [];
  const meta = {};
  for (const entrypoint of Object.keys(files).sort()) {
    const functionConfig = findMatchingFunction(config.functions, [entrypoint])?.functionConfig;
    assert.equal(functionConfig?.installCommand, '', `${entrypoint}: must not reinstall with pnpm`);
    const { output } = await build({
      files, entrypoint, workPath, meta,
      config: { ...functionConfig, functions: config.functions,
        projectSettings: { nodeVersion: '22.x', installCommand: config.installCommand } },
    });
    assert.deepEqual(await inspectFunctionFiles(output.files, output.handler), [], entrypoint);
    assert.ok(!Object.keys(output.files).some(path =>
      path.includes('artifacts/santa-radio-ios/') || path.startsWith('node_modules/.pnpm/')), entrypoint);
    const packagePath = join(directory, 'output/functions', entrypoint.replace(/\.js$/, '.func'));
    await mkdir(packagePath, { recursive: true });
    let bytes = 0;
    for (const [path, file] of Object.entries(output.files)) {
      const destination = join(packagePath, path);
      await mkdir(dirname(destination), { recursive: true });
      assert.ok(['FileFsRef', 'FileBlob'].includes(file.type), 'Unexpected Vercel file type');
      const data = file.type === 'FileBlob' ? Buffer.from(file.data)
        : (file.mode & 0o170000) === 0o120000
          ? Buffer.from(await readlink(file.fsPath)) : await readFile(file.fsPath);
      if ((file.mode & 0o170000) === 0o120000) await symlink(data.toString(), destination);
      else {
        await writeFile(destination, data);
        await chmod(destination, file.mode & 0o777);
        bytes += data.length;
      }
    }
    assert.ok(bytes < 250 * 1024 * 1024, `${entrypoint}: exceeds Vercel's uncompressed size limit`);
    await writeFile(join(packagePath, '.vc-config.json'), JSON.stringify({
      runtime: output.runtime, handler: output.handler, launcherType: 'Nodejs',
    }, null, 2));
    if (functionConfig.includeFiles) {
      // Confirm explicit runtime assets survived, not just their imports.
      for (const path of Object.keys(await glob(functionConfig.includeFiles, workPath))) {
        assert.ok(output.files[path], `${entrypoint}: missing included runtime asset`);
      }
    }
    if (entrypoint === 'api/public-page.js') await smoke(packagePath, documentSmoke);
    if (['api/santa-mobile.js', 'api/santa-message.js', 'api/santa-studio-message.js'].includes(entrypoint)) {
      await smoke(packagePath, audioSmoke(entrypoint));
    }
    summaries.push({ entrypoint, handler: output.handler, runtime: output.runtime,
      files: Object.keys(output.files).length, bytes, layout: 'valid' });
    console.log(`[packaging] ${entrypoint}: valid, ${Math.ceil(bytes / 1024 / 1024)} MiB`);
  }
  await writeFile(join(directory, 'summary.json'), JSON.stringify({
    node: process.versions.node, builder: '@vercel/node@28.0.0', hostedDeploymentAttempted: false, functions: summaries,
  }, null, 2));
  console.log(`Isolated packaging passed: ${summaries.length} functions. Evidence: ${directory}/summary.json`);
}

const documentSmoke = `
  import assert from 'node:assert/strict';
  import handler from './api/public-page.js';
  for (const [url, status] of [['/', 200], ['/apps', 200], ['/santa-tracker', 200],
    ['/sign-in', 200], ['/free-santa-message', 200], ['/missing-page', 404]]) {
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; },
      status(code) { this.code = code; return this; }, end(body) { this.body = body; } };
    await handler({ method: 'GET', url }, res);
    assert.equal(res.code, status, url);
    assert.match(res.body, /<h1/);
    if (url === '/sign-in') assert.equal(res.headers['Cache-Control'], 'private, no-store');
    if (url === '/santa-tracker') assert.equal(res.headers['X-Santa-Page-Mode'], 'dynamic-tracker');
  }
`;

function audioSmoke(entrypoint) {
  return `
    import assert from 'node:assert/strict';
    import { createServer } from 'node:http';
    import { execFileSync } from 'node:child_process';
    import { readFile, stat } from 'node:fs/promises';
    import handler from './${entrypoint}';
    import ffmpeg from 'ffmpeg-static';
    for (const asset of ${JSON.stringify(entrypoint === 'api/santa-studio-message.js' ?
      ['studio/sleigh-bells.mp3', ...['intro', '1st', '1-5', '2nd', '3rd', '4th', '5th', '6th'].map(name => 'studio/' + name + '.flac')] :
      ['free-intro.mp3', 'free-outro-1.mp3', 'free-outro-2.mp3', 'sleighbells.mp3',
        'prepared/intro.wav', 'prepared/outro-1.wav', 'prepared/outro-2.wav'])}) {
      assert.ok((await stat('./server/santa-audio/' + asset)).size > 0);
    }
    assert.ok(JSON.parse(await readFile('./node_modules/ffmpeg-static/package.json', 'utf8')).version);
    const audio = execFileSync(ffmpeg, ['-v', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
      '-t', '0.1', '-f', 'mp3', 'pipe:1'], { timeout: 15000 });
    assert.ok(audio.length > 0, 'packaged executable runs without workspace dependencies');
    const server = createServer(handler);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const base = 'http://127.0.0.1:' + server.address().port;
      const mobile = ${JSON.stringify(entrypoint === 'api/santa-mobile.js')};
      const response = await fetch(base + (mobile ? '/?action=studio' : '/'), {
        method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://invalid.example',
          'Sec-Fetch-Site': 'cross-site' }, body: '{}' });
      assert.equal(response.status, ${entrypoint === 'api/santa-message.js' ? 503 : 403},
        'protected runtime fails closed without live credentials or storage');
      if (mobile) {
        assert.equal((await fetch(base + '/?action=unknown')).status, 404);
        assert.equal((await fetch(base + '/?action=studio')).status, 405);
      }
    } finally { await new Promise(resolve => server.close(resolve)); }
  `;
}

if (!process.argv.includes('--isolated-worker')) {
  execFileSync(process.execPath, [fileURLToPath(import.meta.url), '--isolated-worker'], {
    cwd: source, env, stdio: 'inherit', timeout: 600000,
  });
} else {
  for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key];
  await checkPackages();
}
