import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir, userInfo } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';

const execute = promisify(execFile);
// A private disposable PostgreSQL cluster over a private Unix socket. Never
// reads DATABASE_URL, never connects to the project's or production database.
export async function studioTestDatabase({ loadSchema = true } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'studio-payments-test-'));
  const data = join(root, 'data');
  let started = false, pool;
  const close = async () => {
    await pool?.end();
    if (started) await execute('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop']);
    await rm(root, { recursive: true, force: true });
  };
  try {
    await execute('initdb', ['-D', data, '-A', 'trust', '--no-locale', '-E', 'UTF8']);
    await execute('pg_ctl', ['-D', data, '-l', join(root, 'postgres.log'), '-o', `-F -h '' -k ${root}`, '-w', 'start']);
    started = true;
    pool = new pg.Pool({ host: root, user: userInfo().username, database: 'postgres', max: 8 });
    if (loadSchema) await pool.query(await readFile(new URL('../../database/santa-studio-live.sql', import.meta.url), 'utf8'));
    if (loadSchema) await pool.query(await readFile(new URL('../../database/santa-studio-creation-allowance.sql', import.meta.url), 'utf8'));
    return { pool, close, socket: root };
  } catch (error) { await close(); throw error; }
}
