import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { requestVotingCode, confirmVotingCode, voterIdentity } from '../server/contenders-live.js';
const digest = s => createHash('sha256').update(s).digest('hex');
const modulePath = process.env.PGLITE_TEST_MODULE;
test('Gmail aliases share an identity; other mailbox rules are preserved', () => {
  assert.equal(voterIdentity('A.B+vote@googlemail.com'), 'ab@gmail.com');
  assert.equal(voterIdentity('A.B+vote@example.com'), 'a.b+vote@example.com');
  assert.equal(voterIdentity('invalid'), null);
});
test('verified ballots persist once, including repeat challenges and invalidated ballots', {skip: !modulePath}, async () => {
  const { PGlite } = await import(modulePath);
  const db = new PGlite();
  const pool = { query: async (...args) => { const r=await db.query(...args); return {...r,rowCount:r.rows.length || r.affectedRows || 0}; },
    connect: async () => ({query:pool.query, release(){}}) };
  try {
    for(const file of ['christmas-contenders.sql','christmas-contenders-verification.sql']) await db.exec(await readFile(new URL(`../database/${file}`,import.meta.url),'utf8'));
    await db.query(`UPDATE christmas_contenders_settings SET settings=jsonb_set(jsonb_set(settings,'{opensAt}',to_jsonb((now()-interval '1 day')::text)),'{closesAt}',to_jsonb((now()+interval '1 day')::text))`);
    const songs=(await pool.query("SELECT id FROM christmas_contenders_entries WHERE mode='live' ORDER BY id")).rows;
    let delivered;
    const request = (email, entryId=songs[0].id) => requestVotingCode({email,entryId,digest,limit:async()=>{},send:async msg=>{delivered=msg;}},pool);
    const first=await request('a.b+first@gmail.com');
    assert.equal((await pool.query('SELECT * FROM christmas_contenders_ballots')).rowCount,0);
    await assert.rejects(confirmVotingCode({id:first.verificationId,code:delivered.code==='000000'?'000001':'000000',digest},pool), /doesn’t match/);
    assert.equal((await pool.query('SELECT attempts FROM christmas_contenders_verifications')).rows[0].attempts,1);
    const originalCode=delivered.code;
    assert.equal((await confirmVotingCode({id:first.verificationId,code:originalCode,digest},pool)).state,'success');
    assert.equal((await confirmVotingCode({id:first.verificationId,code:originalCode,digest},pool)).state,'already-voted');
    const second=await request('ab+second@googlemail.com',songs[1].id);
    assert.equal((await confirmVotingCode({id:second.verificationId,code:delivered.code,digest},pool)).state,'already-voted');
    assert.equal((await pool.query('SELECT * FROM christmas_contenders_ballots')).rowCount,1);
    await pool.query("UPDATE christmas_contenders_ballots SET state='invalidated'");
    assert.equal((await confirmVotingCode({id:second.verificationId,code:delivered.code,digest},pool)).state,'already-voted');
    const expired=await request('another@example.com');
    await pool.query("UPDATE christmas_contenders_verifications SET expires_at=now()-interval '1 minute' WHERE id=$1",[expired.verificationId]);
    await assert.rejects(confirmVotingCode({id:expired.verificationId,code:delivered.code,digest},pool), /expired/);
    const closed=await request('closed@example.com');
    await pool.query("UPDATE christmas_contenders_entries SET approved=false WHERE id=$1",[songs[0].id]);
    await assert.rejects(confirmVotingCode({id:closed.verificationId,code:delivered.code,digest},pool), /available song/);
    assert.equal((await pool.query('SELECT * FROM christmas_contenders_ballots')).rowCount,1);
  } finally {await db.close();}
});
