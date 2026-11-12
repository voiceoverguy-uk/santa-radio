import { santaNameKey } from '../src/lib/santaNameSearch.js';
let library;
async function liveCatalogue() {
  const { createNameLibrary } = await import('./santa-name-library.js');
  library ||= createNameLibrary();
  return library.catalogue();
}

// Positive-only fallback: the public legacy index can fail while audio still works.
// Never bypass a configured private gateway or infer absence from failed probes.
export async function recordingFileExists(name, { fetcher = fetch, signal, env = process.env } = {}) {
  if (env.SANTA_LIBRARY_GATEWAY_URL || typeof name !== 'string' ||
      !/^[\p{L}\p{M}0-9][\p{L}\p{M}0-9 '’_-]{0,79}$/u.test(name)) return false;
  const labels = [...new Set([name, name.toLowerCase(), name.replace(/\b\p{L}/gu, c => c.toUpperCase())])];
  for (const label of labels) {
    for (const extension of ['wav', 'mp3']) {
      if (signal?.aborted) return false;
      try {
        const response = await fetcher(`https://stagcommunications.com/santaradio/names/${encodeURIComponent(label + '.' + extension)}`, {
          method: 'GET', headers: { Range: 'bytes=0-11' }, redirect: 'error', cache: 'no-store', signal,
        });
        const reader = response.body?.getReader();
        if (!reader) continue;
        try {
          if (!response.ok || response.redirected || !/^audio\//i.test(response.headers.get('content-type') || '')) continue;
          let bytes = Buffer.alloc(0);
          while (bytes.length < 12) {
            const { done, value } = await reader.read();
            if (done) break;
            bytes = Buffer.concat([bytes, Buffer.from(value).subarray(0, 12 - bytes.length)]);
          }
          const wav = bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WAVE';
          const mp3 = bytes.length >= 3 && (bytes.toString('ascii', 0, 3) === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0));
          if (extension === 'wav' ? wav : mp3) return true;
        } finally { await reader.cancel().catch(() => {}); }
      } catch { /* A failed probe is unknown, never missing. */ }
    }
  }
  return false;
}

// Read-only, exact labels. Never changes request state or queues mail.
export async function requestRecordingStatus(requests, catalogue = liveCatalogue, probe = recordingFileExists) {
  if (!requests.length) return requests;
  try {
    const records = await catalogue();
    const names = new Set(records.map(record => santaNameKey(record.name)));
    return requests.map(row => ({ ...row, recordingStatus: names.has(santaNameKey(row.name)) ? 'available' : 'not_found' }));
  } catch {
    const result = requests.map(row => ({ ...row, recordingStatus: 'unknown' }));
    const signal = AbortSignal.timeout(6000);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(4, result.length) }, async () => {
      while (next < result.length && !signal.aborted) {
        const row = result[next++];
        try { if (await probe(row.name, { signal })) row.recordingStatus = 'available'; } catch { /* preserve unknown */ }
      }
    }));
    return result;
  }
}
