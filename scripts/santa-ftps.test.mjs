import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFtpsPublisher, ftpsSettings, digest, safeUploadCode } from '../server/santa-ftps.js';
import { createSavedGreetingCache, validManifest } from '../server/santa-saved-cache.js';
import { savedSantaGreeting } from '../src/data/savedSantaGreeting.js';
import { santaAudioRecipeVersion } from './santa-audio-recipe.mjs';

const env = {
  SANTA_FTPS_ENABLED: 'true', SANTA_FTPS_HOST: 'ftp.example.test',
  SANTA_FTPS_PORT: '2121', SANTA_FTPS_MODE: 'explicit',
  SANTA_FTPS_USER: 'fixture-user', SANTA_FTPS_PASSWORD: 'fixture-password',
};
const audio = Buffer.alloc(150000, 23);
const name = Buffer.from('current compressed name fixture');
const record = { id: 'arabella', file: 'arabella.mp3', source: 'hosted' };
const identity = { key: `arabella-${'a'.repeat(64)}`, recipeVersion: 'test-recipe', nameSha256: digest(name) };
const manifest = { schema: 1, ...identity, file: `${identity.key}-a.mp3`, bytes: audio.length, sha256: digest(audio) };

function host({ wrongPwd = false, wrongHttps = false, renameFailure = false, stall = false } = {}) {
  const files = new Map();
  const calls = [];
  let pwd = '/santaradio';
  const client = {
    ftp: {}, closed: false,
    async access(settings) {
      calls.push(['access', settings]);
      if (stall) await new Promise(() => {});
    },
    async pwd() { return pwd; },
    async cd(path) { calls.push(['cd', path]); pwd = wrongPwd ? '/unrelated' : '/santaradio/greetings-cache'; },
    async uploadFrom(stream, file) {
      const chunks = [];
      for await (const chunk of stream) chunks.push(Buffer.from(chunk));
      files.set(file, Buffer.concat(chunks)); calls.push(['upload', file]);
    },
    async rename(from, to) {
      calls.push(['rename', from, to]);
      if (renameFailure) throw new Error('RNTO unavailable');
      files.set(to, files.get(from)); files.delete(from);
    },
    async remove(file) { calls.push(['remove', file]); files.delete(file); },
    close() { this.closed = true; },
  };
  const fetcher = async url => {
    const bytes = files.get(new URL(url).pathname.split('/').pop());
    if (!bytes) return new Response('', { status: 404 });
    return new Response(wrongHttps ? Buffer.from('wrong mapping') : bytes);
  };
  return { client, calls, files, fetcher };
}

test('FTPS requires all settings and explicit mode/port; certificate validation cannot be disabled', () => {
  for (const candidate of [{}, { ...env, SANTA_FTPS_MODE: '' }, { ...env, SANTA_FTPS_PORT: '' },
    { ...env, SANTA_FTPS_MODE: 'plain' }, { ...env, SANTA_FTPS_PORT: '0' },
    { ...env, SANTA_FTPS_DIRECTORY: '/santaradio/greetings-cache' }]) {
    assert.throws(() => ftpsSettings(candidate));
  }
  const explicit = ftpsSettings(env);
  assert.equal(explicit.secure, true);
  assert.equal(explicit.port, 2121);
  assert.equal(explicit.secureOptions.rejectUnauthorized, true);
  assert.equal(explicit.secureOptions.minVersion, 'TLSv1.2');
  assert.equal(ftpsSettings({ ...env, SANTA_FTPS_MODE: 'implicit', SANTA_FTPS_PORT: '2990' }).secure, 'implicit');
});

test('relative mapping, encrypted settings, UUID temporary/atomic publication and HTTPS byte verification', async () => {
  const h = host();
  const publish = createFtpsPublisher({ env, clientFactory: () => h.client, fetcher: h.fetcher });
  const value = await publish(identity, audio);
  assert.ok(validManifest(value, identity));
  assert.deepEqual(h.calls.find(x => x[0] === 'cd'), ['cd', 'greetings-cache']);
  assert.equal(h.calls[0][1].secureOptions.rejectUnauthorized, true);
  assert.equal(h.client.ftp.verbose, false);
  assert.ok(h.files.get(value.file).equals(audio));
  assert.deepEqual(JSON.parse(h.files.get(`${identity.key}.json`)), value);
  assert.equal(h.calls.filter(x => x[0] === 'rename').length, 2);
  assert.ok(h.calls.filter(x => x[0] === 'upload').every(x => x[1].startsWith('.')));
  assert.ok(h.calls.every(x => !JSON.stringify(x.slice(1)).includes('Santa-message-for-Arabella.mp3')));
  assert.equal(h.client.closed, true);
});

test('wrong FTP or HTTPS mapping and unsupported atomic rename cannot publish a hit', async () => {
  for (const mode of [{ wrongPwd: true }, { wrongHttps: true }, { renameFailure: true }]) {
    const h = host(mode);
    await assert.rejects(createFtpsPublisher({ env, clientFactory: () => h.client, fetcher: h.fetcher })(identity, audio));
    assert.equal(h.files.has(`${identity.key}.json`), false);
    assert.equal(h.client.closed, true);
    if (mode.wrongPwd) assert.equal(h.calls.some(x => x[0] === 'upload'), false);
  }
});

test('total upload deadline closes the connection; no FTP or certificate-error fallback', async () => {
  const h = host({ stall: true });
  await assert.rejects(createFtpsPublisher({ env, clientFactory: () => h.client, timeoutMs: 15 })(identity, audio),
    error => error.safeCode === 'FTPS_TIMEOUT');
  assert.equal(h.client.closed, true);
  assert.equal(h.calls.filter(x => x[0] === 'access').length, 1);
  assert.equal(safeUploadCode({ code: 'ERR_TLS_CERT_ALTNAME_INVALID', message: 'secret' }), 'FTPS_TLS_REJECTED');
  assert.equal(safeUploadCode({ message: 'fixture-password' }), 'FTPS_UPLOAD_FAILED');
});

test('source/recipe changes invalidate identity; only Arabella is prepared', async () => {
  let reads = 0;
  const library = { sourceBytes: async () => { reads++; return name; } };
  const cache = createSavedGreetingCache({ recipe: hash => hash, log: () => {} });
  const first = await cache.prepare(record, library);
  assert.equal(await cache.prepare({ ...record, file: 'erin.mp3' }, library), null);
  assert.equal(reads, 1);
  const changed = await cache.prepare(record, { sourceBytes: async () => Buffer.from('new source') });
  assert.notEqual(first.identity.key, changed.identity.key);
  const changedRecipe = await createSavedGreetingCache({ recipe: () => 'changed' }).prepare(record, library);
  assert.notEqual(first.identity.key, changedRecipe.identity.key);
  assert.notEqual(santaAudioRecipeVersion(undefined, 'changed'), santaAudioRecipeVersion());
});

test('approved manual compatibility and auto manifests require exact version/revision, not filename', async () => {
  const cache = createSavedGreetingCache({
    recipe: () => savedSantaGreeting.recipeVersion, log: () => {},
    fetcher: async () => Response.json({ ...manifest, nameSha256: 'wrong' }),
  });
  assert.equal(await cache.lookup(record, { sourceBytes: async () => name }), null);
  const knownIdentityCache = createSavedGreetingCache({ recipe: () => 'test-recipe', log: () => {} });
  const prepared = await knownIdentityCache.prepare(record, { sourceBytes: async () => name });
  const value = { ...manifest, ...prepared.identity, file: `${prepared.identity.key}-new.mp3` };
  const auto = createSavedGreetingCache({ recipe: () => 'test-recipe', log: () => {},
    fetcher: async () => Response.json(value) });
  assert.equal((await auto.lookup(record, { sourceBytes: async () => name })).sha256, digest(audio));
  assert.equal(validManifest({ ...value, file: '../private.mp3' }, prepared.identity), false);
});

test('in-process generation single flight; upload failures are non-secret misses', async () => {
  const diagnostics = [];
  const cache = createSavedGreetingCache({
    publisher: async () => { throw new Error('fixture-password'); },
    log: (...value) => diagnostics.push(value),
  });
  let renders = 0;
  const work = async () => { renders++; await new Promise(r => setTimeout(r, 10)); return audio; };
  const results = await Promise.all([cache.singleFlight('arabella', work), cache.singleFlight('arabella', work)]);
  assert.equal(renders, 1);
  assert.equal(results[0], results[1]);
  assert.equal(await cache.publish({ identity }, audio), null);
  assert.equal(JSON.stringify(diagnostics).includes('fixture-password'), false);
  assert.match(JSON.stringify(diagnostics), /FTPS_UPLOAD_FAILED/);
  assert.equal(await cache.singleFlight('arabella', work), audio);
  assert.equal(renders, 2);
});

test('concurrent publishers use distinct completed objects and never partially publish a manifest', async () => {
  const h = host();
  // Independent control connections share the remote directory.
  const connections = [];
  const publisher = createFtpsPublisher({ env, fetcher: h.fetcher, clientFactory: () => {
    const connection = { ...h.client, ftp: {}, closed: false, close() { this.closed = true; } };
    connections.push(connection);
    return connection;
  } });
  const [a, b] = await Promise.all([publisher(identity, audio), publisher(identity, audio)]);
  assert.notEqual(a.file, b.file);
  assert.ok(h.files.get(a.file).equals(audio));
  assert.ok(h.files.get(b.file).equals(audio));
  assert.ok(validManifest(JSON.parse(h.files.get(`${identity.key}.json`)), identity));
});
