import { Client } from 'basic-ftp';
import { Readable } from 'node:stream';
import { randomUUID, createHash } from 'node:crypto';
import { posix } from 'node:path';

export const GREETING_ROOT = 'https://stagcommunications.com/santaradio/greetings-cache/';
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const failure = code => Object.assign(new Error(code), { safeCode: code });

export function ftpsSettings(env = process.env) {
  if (env.SANTA_FTPS_ENABLED !== 'true') throw failure('UPLOAD_DISABLED');
  const { SANTA_FTPS_HOST: host, SANTA_FTPS_USER: user, SANTA_FTPS_PASSWORD: password,
    SANTA_FTPS_MODE: mode, SANTA_FTPS_PORT: rawPort } = env;
  if (!host || !user || !password || !mode || !rawPort) throw failure('FTPS_SETTINGS_MISSING');
  if (!/^[a-z0-9][a-z0-9.-]+$/i.test(host) ||
      !['explicit', 'implicit'].includes(mode) || !/^\d+$/.test(rawPort) ||
      Number(rawPort) < 1 || Number(rawPort) > 65535 ||
      (env.SANTA_FTPS_DIRECTORY || 'greetings-cache') !== 'greetings-cache') {
    throw failure('FTPS_SETTINGS_INVALID');
  }
  return {
    host, user, password, port: Number(rawPort), secure: mode === 'explicit' ? true : 'implicit',
    secureOptions: { rejectUnauthorized: true, servername: host, minVersion: 'TLSv1.2' },
  };
}

// Never send library/server error strings to logs: FTP errors may quote commands.
export const safeUploadCode = error => {
  if (['UPLOAD_DISABLED', 'FTPS_SETTINGS_MISSING', 'FTPS_SETTINGS_INVALID', 'FTPS_MAPPING_INVALID',
    'FTPS_TIMEOUT', 'HTTPS_VERIFY_FAILED', 'ATOMIC_PUBLICATION_FAILED'].includes(error?.safeCode)) return error.safeCode;
  if (['CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    'ERR_TLS_CERT_ALTNAME_INVALID', 'SELF_SIGNED_CERT_IN_CHAIN'].includes(error?.code)) return 'FTPS_TLS_REJECTED';
  if (error?.code === 530) return 'FTPS_AUTH_REJECTED';
  return 'FTPS_UPLOAD_FAILED';
};

export async function readPublicFile(file, maxBytes, { fetcher = fetch, signal, timeoutMs = 2500 } = {}) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]{0,230}$/.test(file)) throw failure('HTTPS_VERIFY_FAILED');
  const response = await fetcher(new URL(file, GREETING_ROOT), {
    redirect: 'error', cache: 'no-store',
    signal: signal || AbortSignal.timeout(timeoutMs),
  });
  if (response.status !== 200 || !response.body ||
      Number(response.headers.get('content-length')) > maxBytes) throw failure('HTTPS_VERIFY_FAILED');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes) throw failure('HTTPS_VERIFY_FAILED');
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  return Buffer.concat(chunks);
}

export function createFtpsPublisher({
  env = process.env, clientFactory = () => new Client(3500), fetcher = fetch,
  timeoutMs = 10000,
} = {}) {
  return async function publish(identity, audio) {
    const settings = ftpsSettings(env); // No socket opened unless fully configured.
    const client = clientFactory();
    client.ftp.verbose = false;
    const token = randomUUID();
    const file = `${identity.key}-${token}.mp3`;
    const temp = `.${token}.upload`;
    const manifestTemp = `.${token}.manifest-upload`;
    const manifestFile = `${identity.key}.json`;
    const manifest = {
      schema: 1, key: identity.key, recipeVersion: identity.recipeVersion,
      nameSha256: identity.nameSha256, file, bytes: audio.length, sha256: digest(audio),
    };
    const controller = new AbortController();
    let mapped = false;
    const job = async () => {
      await client.access(settings);
      const start = posix.normalize(await client.pwd());
      await client.cd('greetings-cache'); // Relative to the authenticated login directory.
      const destination = posix.normalize(await client.pwd());
      if (!start.startsWith('/') || destination !== posix.join(start, 'greetings-cache')) {
        throw failure('FTPS_MAPPING_INVALID');
      }
      mapped = true;
      await client.uploadFrom(Readable.from(audio), temp);
      try { await client.rename(temp, file); }
      catch { throw failure('ATOMIC_PUBLICATION_FAILED'); }
      // This is the second mapping check: FTP-relative directory must really map
      // to the intended public HTTPS folder. Do not publish a pointer otherwise.
      const served = await readPublicFile(file, audio.length, { fetcher, signal: controller.signal });
      if (served.length !== audio.length || digest(served) !== manifest.sha256) {
        throw failure('HTTPS_VERIFY_FAILED');
      }
      await client.uploadFrom(Readable.from(Buffer.from(JSON.stringify(manifest))), manifestTemp);
      try { await client.rename(manifestTemp, manifestFile); }
      catch { throw failure('ATOMIC_PUBLICATION_FAILED'); }
      return manifest;
    };
    let timer;
    try {
      return await Promise.race([job(), new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          client.close();
          reject(failure('FTPS_TIMEOUT'));
        }, timeoutMs);
      })]);
    } finally {
      controller.abort();
      // Only our UUID temporary objects; never remove or overwrite manual audio.
      if (mapped && !client.closed) {
        await client.remove(temp, true).catch(() => {});
        await client.remove(manifestTemp, true).catch(() => {});
      }
      client.close();
      clearTimeout(timer);
    }
  };
}
