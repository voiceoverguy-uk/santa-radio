import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';

// Never reads DATABASE_URL. Only a disposable, private Unix socket is used.
export async function withNameDatabase(run, { snapshotSchema = true } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'santa-name-pg-'));
  const data = join(directory, 'data');
  let started = false, pool;
  try {
    execFileSync('initdb', ['-D', data, '--no-locale', '--encoding=UTF8', '--auth=trust', '--username=fixture'], { stdio: 'pipe' });
    execFileSync('pg_ctl', ['-D', data, '-l', join(directory, 'postgres.log'), '-w', 'start',
      '-o', `-F -c listen_addresses='' -k ${directory} -p 5432 -c max_connections=20`], { stdio: 'pipe' });
    started = true;
    pool = new pg.Pool({ host: directory, port: 5432, user: 'fixture', database: 'postgres', max: 12 });
    await pool.query(await readFile('database/santa-name-requests.sql', 'utf8'));
    if (snapshotSchema) await pool.query(await readFile('database/santa-name-catalogue.sql', 'utf8'));
    return await run(pool);
  } finally {
    await pool?.end();
    if (started) execFileSync('pg_ctl', ['-D', data, '-w', 'stop', '-m', 'immediate'], { stdio: 'pipe' });
    await rm(directory, { recursive: true, force: true });
  }
}

export function nameFixture(count = 9700) {
  return Buffer.from(JSON.stringify({ version: 1, names: Array.from({ length: count }, (_, i) => ({
    id: `fixture-${i}`, file: `fixture-${i}.mp3`,
    name: `${i % 2 ? 'Daniel' : 'Anna'} ${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + (Math.floor(i / 26) % 26))}`,
  })) }));
}
