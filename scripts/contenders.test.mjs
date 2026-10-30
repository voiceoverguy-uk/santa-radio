import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { defaultSettings, votingStatus, COMPETITION, sourceApprovedContenders } from '../src/lib/contenders.js';
import { buildSongMessage, validateSongFields, submitSong, emptySongFields, SONG_FORM_URL, GENERAL_FORM_URL } from '../src/lib/songSubmission.js';
import { createContendersHandler, validateManagement, privateDigest } from '../server/christmas-contenders.js';
import { demoBallot, competitionState, manageCompetition } from '../server/contenders-store.js';
import { normalizeVotingEmail, MARKETING_CONSENT_TEXT } from '../server/contender-consent.js';
import { buildSongVotePayload, sendSongVoteNotification } from '../server/contender-song-notification.js';

test('UK November voting boundaries and explicit availability', () => {
  assert.equal(votingStatus(defaultSettings, Date.parse('2026-10-31T23:59:59Z')), 'upcoming');
  assert.equal(votingStatus(defaultSettings, Date.parse('2026-11-01T00:00:00Z')), 'open');
  assert.equal(votingStatus(defaultSettings, Date.parse('2026-11-30T23:59:59.999Z')), 'open');
  assert.equal(votingStatus(defaultSettings, Date.parse('2026-12-01T00:00:00Z')), 'closed');
  assert.equal(votingStatus({...defaultSettings,availability:'closed'}, 0), 'closed');
  assert.equal(votingStatus({...defaultSettings,availability:'unavailable'}), 'unavailable');
  assert.equal(defaultSettings.submissionCutoff,null);
});

test('source fallback matches only the approved live SQL catalogue', async () => {
  const sql = await readFile(new URL('../database/christmas-contenders.sql', import.meta.url), 'utf8');
  const seededIds = Array.from(sql.matchAll(new RegExp(
    "'christmas-contenders-2026','([^']+)','live','", 'g',
  )), match => match[1]).sort();
  assert.deepEqual(sourceApprovedContenders.map(entry => entry.id).sort(), seededIds);
  assert.equal(sourceApprovedContenders.length, 8);
  assert.ok(sourceApprovedContenders.every(entry => entry.mode === 'live' && entry.approved === true));
  assert.ok(sourceApprovedContenders.every(entry => entry.audio && entry.artwork && !('description' in entry)));
});

const fields = { ...emptySongFields,FIRSTNAME:'Demo',LASTNAME:'Sender',EMAIL:'demo@example.test',
  SONG_REQUEST:'Artist, title, bio, promotion https://example.test/p',criteriaMet:true,
  lyricsLink:'https://example.test/l',audioLink:'https://example.test/a',artworkLink:'https://example.test/i',hostPermission:true };
test('complete SONG payload rejects excess without discarding lyrics/media/rights', () => {
  const base = {...fields,SONG_REQUEST:''};
  const exact = {...base,SONG_REQUEST:'x'.repeat(500-buildSongMessage(base).length)};
  assert.equal(buildSongMessage(exact).length,500);
  assert.deepEqual(validateSongFields(exact,'song'),{});
  assert.ok(validateSongFields({...exact,SONG_REQUEST:exact.SONG_REQUEST+'x'},'song').SONG_REQUEST);
  const text = buildSongMessage(fields);
  for(const value of [fields.lyricsLink,fields.audioLink,fields.artworkLink,'confirmed']) assert.ok(text.includes(value));
  assert.ok(validateSongFields({...fields,lyricsLink:''},'song').lyricsLink);
  assert.equal(validateSongFields({...fields,lyricsLink:'',instrumental:true},'song').lyricsLink,undefined);
  assert.ok(validateSongFields({...fields,hostPermission:false},'song').hostPermission);
  assert.deepEqual(validateSongFields({...fields,lyricsLink:'',hostPermission:false,criteriaMet:false},'general'),{});
});

test('provider fields and General/Sponsorship destination split stay unchanged (no mail sent)', async () => {
  const previous = global.fetch;
  const captured = [];
  global.fetch = async (url,options) => {captured.push({url,body:Object.fromEntries(options.body)});return {ok:true,type:'cors',json:async()=>({success:true})};};
  try {
    const signal = new AbortController().signal;
    await submitSong(fields,signal,'song');
    await submitSong({...fields,hostPermission:false},signal,'general');
    const sponsorship = {...fields,sponsorBrand:'Brand',sponsorWebsite:'https://example.test',sponsorCampaign:'Campaign',sponsorLaunchDate:'2026-11-01'};
    await submitSong(sponsorship,signal,'sponsorship');
    assert.equal(captured[0].url,`${SONG_FORM_URL}?isAjax=1`);
    assert.equal(captured[1].url,`${GENERAL_FORM_URL}?isAjax=1`);
    assert.equal(captured[2].url,`${GENERAL_FORM_URL}?isAjax=1`);
    assert.equal(captured[0].body.SONG_REQUEST,buildSongMessage(fields));
    assert.equal(captured[1].body.SONG_REQUEST,fields.SONG_REQUEST);
    assert.ok(captured[2].body.SONG_REQUEST.includes('Preferred launch: 2026-11-01'));
    assert.deepEqual(Object.keys(captured[0].body),['FIRSTNAME','LASTNAME','EMAIL','SONG_REQUEST','email_address_check','locale']);
  } finally {global.fetch=previous;}
});

test('management cannot turn Bob or supplied demo media live', () => {
  const e={id:'bob-the-elf',mode:'live',artist:'Bob',title:'Test',artwork:'/contenders/bob-the-elf.png',audio:'/contenders/test-song.mp3',approved:true};
  assert.equal(Boolean(validateManagement({action:'entry',entry:e})),false);
  assert.equal(Boolean(validateManagement({action:'entry',entry:{...e,id:'another-id'}})),false);
  assert.equal(validateManagement({action:'settings',settings:{...defaultSettings,opensAt:'tomorrow'}}),false);
  assert.equal(validateManagement({action:'entry',entry:{...e,mode:'demo',description:'x'.repeat(181)}}),false);
  assert.equal(validateManagement({action:'entry',entry:{...e,mode:'demo',description:'Demo description'}}),true);
});

function response() {
  return {statusCode:200,body:null,set(){return this;},append(){return this;},status(s){this.statusCode=s;return this;},json(b){this.body=b;return this;}};
}

test('signing and storage failures show source-approved songs without inventing totals', async () => {
  const assertUnavailableCatalogue = async options => {
    const handler = createContendersHandler(options);
    const res = response();
    await handler({method:'GET',headers:{},query:{}}, res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.ready, false);
    assert.equal(res.body.status, 'unavailable');
    assert.equal(res.body.demoStatus, 'unavailable');
    assert.equal(res.body.realVotingEnabled, false);
    assert.equal(res.body.entries.length, 8);
    assert.ok(res.body.entries.every(entry => entry.mode === 'live' && entry.approved && entry.total === null));
    assert.ok(!res.body.entries.some(entry => entry.id === 'bob-the-elf'));
    assert.match(res.body.launchDependency, /totals are unknown/);
    assert.ok(res.body.entries.every(entry => entry.waveform?.url));
    return res;
  };

  let databaseReads = 0;
  await assertUnavailableCatalogue({
    digest: () => { throw new Error('Signing unavailable'); },
    read: async () => { databaseReads += 1; throw new Error('Must not read without signing'); },
  });
  assert.equal(databaseReads, 0);

  await assertUnavailableCatalogue({
    digest: () => 'test-request-bucket',
    limit: async () => {},
    read: async () => { throw new Error('Shared storage unavailable'); },
  });
});

test('syntax-only contact validation and transient SONG notification contract (no email sent)', async () => {
  assert.equal(normalizeVotingEmail('  Test@Example.TEST  '),'test@example.test');
  for (const invalid of ['', 'no-at-sign', '.bad@example.test', 'a@-bad.test', 'a..b@example.test', 'a@example.test\r\nBcc:x']) {
    assert.equal(normalizeVotingEmail(invalid),null);
  }
  const details={firstName:'Test',lastName:'Visitor',email:'Test@Example.TEST',artist:'a'.repeat(120),title:'t'.repeat(160),
    voteReference:'00000000-0000-4000-8000-000000000001',marketingOptIn:false};
  const payload=buildSongVotePayload(details);
  assert.equal(payload.destination,`${SONG_FORM_URL}?isAjax=1`);
  const fields=Object.fromEntries(payload.body);
  assert.equal(fields.FIRSTNAME,'Test');assert.equal(fields.LASTNAME,'Visitor');assert.equal(fields.EMAIL,'test@example.test');
  assert.deepEqual(Object.keys(fields),['FIRSTNAME','LASTNAME','EMAIL','SONG_REQUEST','email_address_check','locale']);
  assert.ok(fields.SONG_REQUEST.length<=500);assert.match(fields.SONG_REQUEST,/^CHRISTMAS CONTENDERS VOTE/);
  assert.ok(fields.SONG_REQUEST.includes(details.voteReference));assert.match(fields.SONG_REQUEST,/Marketing opt-in: NO/);
  assert.throws(()=>buildSongVotePayload({...details,firstName:''}),/requires your actual/);
  assert.throws(()=>buildSongVotePayload({...details,title:'t'.repeat(161)}));
  assert.match(Object.fromEntries(buildSongVotePayload({...details,marketingOptIn:true}).body).SONG_REQUEST,/Marketing opt-in: YES/);
  for(const [response,delivery] of [
    [{ok:true,type:'basic',json:async()=>({success:true})},'accepted'],
    [{ok:true,type:'basic',json:async()=>({success:false})},'failed'],
    [{ok:true,type:'basic',json:async()=>({message:'OK'})},'unknown'],
    [{ok:true,type:'basic',json:async()=>{throw new Error('HTML');}},'unknown'],
    [{ok:false,status:500,json:async()=>({success:true})},'unknown'],
  ]) assert.deepEqual(await sendSongVoteNotification(payload,async(url)=>{assert.equal(url,`${SONG_FORM_URL}?isAjax=1`);return response;}),{delivery});
  assert.deepEqual(await sendSongVoteNotification(payload,async()=>{throw new Error('timeout');}),{delivery:'unknown'});
  const calls=[];
  const handler=createContendersHandler({limit:async()=>{},vote:async args=>{calls.push(args);return {state:'success'};}});
  const req={method:'POST',protocol:'https',headers:{host:'example.test',origin:'https://example.test'},query:{},
    body:{mode:'demo',action:'confirm',entryId:'bob-the-elf',email:'Test@Example.TEST',firstName:'Test',lastName:'Visitor',marketingOptIn:false}};
  let res=response();await handler({...req,body:{...req.body,email:''}},res);
  assert.equal(res.statusCode,400);assert.equal(calls.length,0);
  res=response();await handler(req,res);assert.equal(calls[0].marketingOptIn,false);
  res=response();await handler({...req,body:{...req.body,email:'test@example.test',marketingOptIn:true,action:'prepare'}},res);
  assert.equal(calls[0].voterKey,calls[1].voterKey);
  res=response();await handler({...req,body:{...req.body,marketingOptIn:true}},res);
  assert.equal(calls[2].marketingOptIn,true);
  assert.equal(calls[2].email,undefined);assert.equal(calls[2].firstName,undefined);assert.equal(calls[2].marketingConsent,undefined);
  assert.deepEqual(await calls[2].prepareNotification(details)(),{delivery:'simulated'});
  assert.deepEqual(res.body,{state:'success'});
  res=response();await handler({...req,body:{...req.body,marketingOptIn:'true'}},res);assert.equal(res.statusCode,400);
});

test('origin, honeypot, staff policy and real-vote fail-closed paths', async () => {
  const handler = createContendersHandler({limit:async()=>{},checkAdmin:async()=>403,
    vote:async()=>{throw new Error('Must not vote');}});
  const base={method:'POST',protocol:'https',headers:{host:'example.test',origin:'https://example.test'},query:{},body:{mode:'live'}};
  let res=response();await handler({...base,headers:{...base.headers,origin:'https://evil.test'}},res);assert.equal(res.statusCode,403);
  res=response();await handler(base,res);assert.equal(res.statusCode,503);
  res=response();await handler({...base,body:{mode:'demo',action:'prepare',entryId:'bob-the-elf',email:'demo@example.test',website:'bot'}},res);assert.equal(res.statusCode,400);
  res=response();await handler({...base,method:'PATCH'},res);assert.equal(res.statusCode,403);
});

test('signed demo cookie restores only database-confirmed state; forged cookies are ignored', async () => {
  let cookie;
  let remembers=0;
  const handler=createContendersHandler({limit:async()=>{},vote:async()=>({state:'success'}),
    read:async()=>({ready:true}),remember:async()=>{remembers++;return {state:'confirmed',entryId:'bob-the-elf'};}});
  const req={method:'POST',protocol:'https',headers:{host:'example.test',origin:'https://example.test'},query:{},
    body:{mode:'demo',action:'confirm',entryId:'bob-the-elf',email:'demo@example.test',firstName:'Test',lastName:'Visitor',website:''}};
  const post=response();post.append=(_name,value)=>{cookie=value.split(';')[0];return post;};
  await handler(req,post);
  assert.equal(post.body.state,'success');
  assert.ok(cookie && !cookie.includes('demo@example'));
  const get=response();await handler({...req,method:'GET',headers:{...req.headers,cookie}},get);
  assert.equal(get.body.viewerBallot.state,'confirmed');assert.equal(remembers,1);
  const forged=response();await handler({...req,method:'GET',headers:{...req.headers,cookie:cookie.slice(0,-2)+'xx'}},forged);
  assert.equal(forged.body.viewerBallot,undefined);assert.equal(remembers,1);
});

test('repeat testing is opt-in, demo-only and uses stable keys per explicit attempt', async () => {
  let enabled=false;
  const keys=[];
  const handler=createContendersHandler({limit:async()=>{},read:async()=>({settings:{repeatDemo:enabled}}),
    vote:async args=>{keys.push(args);return {state:'success'};}});
  const req={method:'POST',protocol:'https',headers:{host:'example.test',origin:'https://example.test'},query:{},
    body:{mode:'demo',action:'confirm',entryId:'bob-the-elf',email:'repeat@example.test',firstName:'Test',lastName:'Visitor',attemptId:'00000000-0000-4000-8000-000000000001'}};
  let res=response();await handler(req,res);assert.equal(res.statusCode,409);assert.equal(keys.length,0);
  enabled=true;
  for(let i=0;i<2;i++){res=response();await handler(req,res);assert.equal(res.statusCode,200);}
  assert.equal(keys[0].voterKey,keys[1].voterKey);assert.equal(keys[0].repeatAttempt,true);
  res=response();await handler({...req,body:{...req.body,attemptId:'00000000-0000-4000-8000-000000000002'}},res);
  assert.notEqual(keys[0].voterKey,keys[2].voterKey);
  res=response();await handler({...req,body:{...req.body,mode:'live'}},res);assert.equal(res.statusCode,503);
  res=response();await handler({...req,body:{...req.body,attemptId:'bad'}},res);assert.equal(res.statusCode,400);
});

test('PostgreSQL atomic confirmation, retry deduplication, expiry, closed demo and mode separation', {
  skip:process.env.CONTENDERS_TEST_DATABASE !== 'confirmed-development',
}, async () => {
  // Only run after explicitly confirming the configured non-production target.
  const schema=`contenders_test_${randomBytes(6).toString('hex')}`;
  const base = new pg.Pool({connectionString:process.env.DATABASE_URL,max:1});
  const pool = new pg.Pool({connectionString:process.env.DATABASE_URL,max:8,options:`-c search_path=${schema}`});
  try {
    await base.query(`CREATE SCHEMA ${schema}`);
    await pool.query(await readFile(new URL('../database/christmas-contenders.sql',import.meta.url),'utf8'));
    const privateEntry=(await competitionState(pool,true)).entries.find(e=>e.id==='bob-the-elf');
    assert.ok(privateEntry.description);
    await manageCompetition({action:'entry',entry:{...privateEntry,description:''}},pool);
    assert.equal((await competitionState(pool,true)).entries.find(e=>e.id===privateEntry.id).description,privateEntry.description);
    assert.ok((await competitionState(pool)).entries.every(e=>!Object.hasOwn(e,'description')));
    const voterKey='a'.repeat(64);
    let notificationCalls=0;
    const args={entryId:'bob-the-elf',voterKey,prepareNotification:()=>async()=>{
      notificationCalls++;await new Promise(resolve=>setTimeout(resolve,20));return {delivery:'simulated'};
    }};
    await assert.rejects(demoBallot({entryId:'sam-ringer-lonely-little-christmas-tree',voterKey,action:'prepare'},pool),/approved demo recording/);
    assert.equal((await demoBallot({...args,action:'prepare'},pool)).state,'confirmation');
    const results=await Promise.all(Array.from({length:8},()=>demoBallot({...args,action:'confirm'},pool)));
    assert.equal(results.filter(r=>r.state==='success').length,1);
    assert.equal(results.filter(r=>['already-voted','pending'].includes(r.state)).length,7);
    assert.equal(notificationCalls,1);
    assert.equal((await demoBallot({...args,action:'prepare'},pool)).state,'already-voted');
    assert.equal(notificationCalls,1);
    assert.equal((await pool.query(`SELECT count(*)::int n FROM christmas_contenders_ballots WHERE state='confirmed'`)).rows[0].n,1);
    assert.equal((await pool.query(`SELECT count(*)::int n FROM christmas_contenders_ballots WHERE mode='live'`)).rows[0].n,0);
    const consentCount=async()=>Number((await pool.query('SELECT count(*) AS n FROM christmas_contenders_marketing_consents')).rows[0].n);
    assert.equal(await consentCount(),0); // Existing or unchecked ballots never enrol.
    assert.equal((await demoBallot({...args,action:'confirm',marketingOptIn:true},pool)).state,'already-voted');
    assert.equal(await consentCount(),0); // Cannot retrospectively consent an old ballot.
    const opted={entryId:'bob-the-elf',voterKey:'d'.repeat(64),marketingOptIn:true};
    await demoBallot({...opted,action:'prepare'},pool);
    assert.equal(await consentCount(),0);
    const confirmations=await Promise.all(Array.from({length:4},()=>demoBallot({...opted,action:'confirm'},pool)));
    assert.equal(confirmations.filter(r=>r.state==='success').length,1);
    assert.equal(await consentCount(),0);
    const consent=(await pool.query('SELECT consented_at,consent_source,consent_text FROM christmas_contenders_notifications WHERE marketing_opt_in=true')).rows[0];
    assert.ok(consent.consented_at);assert.match(consent.consent_source,/preview-ballot$/);
    assert.equal(consent.consent_text,MARKETING_CONSENT_TEXT);
    const failed={entryId:'bob-the-elf',voterKey:'e'.repeat(64)};
    await demoBallot({...failed,action:'prepare'},pool);
    let sends=0;
    const send=delivery=>()=>async()=>{sends++;return {delivery};};
    assert.equal((await demoBallot({...failed,action:'confirm',prepareNotification:send('failed')},pool)).state,'error');
    assert.equal((await pool.query('SELECT state FROM christmas_contenders_ballots WHERE voter_key=$1',[failed.voterKey])).rows[0].state,'pending');
    // Voting succeeds without optional marketing, including after a consent failure.
    assert.equal((await demoBallot({...failed,action:'confirm'},pool)).state,'success');
    assert.equal(await consentCount(),0);
    const uncertain={entryId:'bob-the-elf',voterKey:'f'.repeat(64)};
    await demoBallot({...uncertain,action:'prepare'},pool);
    const unresolved=await demoBallot({...uncertain,action:'confirm',prepareNotification:send('unknown')},pool);
    assert.equal(unresolved.state,'pending');assert.equal(unresolved.delivery,'unknown');
    await demoBallot({...uncertain,action:'confirm',prepareNotification:send('simulated')},pool);
    assert.equal(sends,2); // No retry of uncertain/accepted notifications.
    assert.equal(validateManagement({action:'notification-review',id:unresolved.reference,decision:'accepted'}),false);
    await manageCompetition({action:'notification-review',id:unresolved.reference,decision:'not-accepted'},pool);
    assert.equal((await demoBallot({...uncertain,action:'confirm',prepareNotification:send('simulated')},pool)).state,'success');
    assert.equal(sends,3);
    await demoBallot({...uncertain,action:'confirm',prepareNotification:send('simulated')},pool);assert.equal(sends,3);
    // Simulate process loss after a durable claim: old sending state never resends.
    const stale={entryId:'bob-the-elf',voterKey:'9'.repeat(64)};
    const reserved=await demoBallot({...stale,action:'prepare'},pool);
    await pool.query(`INSERT INTO christmas_contenders_notifications(ballot_id,state,attempt_id,started_at)
      VALUES($1,'sending',$2,now()-interval '3 minutes')`,[reserved.reference,'00000000-0000-4000-8000-000000000001']);
    assert.equal((await demoBallot({...stale,action:'confirm',prepareNotification:send('simulated')},pool)).delivery,'unknown');
    assert.equal(sends,3);
    await manageCompetition({action:'notification-review',id:reserved.reference,decision:'accepted'},pool);
    assert.equal((await demoBallot({...stale,action:'confirm',prepareNotification:send('simulated')},pool)).state,'already-voted');
    assert.equal(sends,3);
    const columns=(await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name='christmas_contenders_notifications'`,[schema])).rows.map(r=>r.column_name);
    assert.ok(columns.every(c=>!['email','encrypted_email','first_name','last_name','payload','retry_payload'].includes(c)));
    // Invalidating cannot free a voter identity for another vote.
    await pool.query(`UPDATE christmas_contenders_ballots SET state='invalidated'`);
    assert.equal((await demoBallot({...args,action:'prepare'},pool)).state,'already-voted');
    const second={entryId:'bob-the-elf',voterKey:'b'.repeat(64)};
    await demoBallot({...second,action:'prepare'},pool);
    await pool.query(`UPDATE christmas_contenders_ballots SET expires_at=now()-interval '1 second' WHERE voter_key=$1`,[second.voterKey]);
    await assert.rejects(demoBallot({...second,action:'confirm'},pool),/expired/);
    const repeated={entryId:'bob-the-elf',voterKey:privateDigest('demo-repeat:repeat@example.test:attempt-one'),repeatAttempt:true};
    await assert.rejects(demoBallot({...repeated,action:'prepare'},pool),/switched off/);
    await pool.query(`UPDATE christmas_contenders_settings SET settings=jsonb_set(settings,'{repeatDemo}','true') WHERE competition=$1`,[COMPETITION]);
    await demoBallot({...repeated,action:'prepare'},pool);
    assert.equal((await demoBallot({...repeated,action:'confirm'},pool)).state,'success');
    assert.equal((await demoBallot({...repeated,action:'confirm'},pool)).state,'already-voted');
    const again={...repeated,voterKey:privateDigest('demo-repeat:repeat@example.test:attempt-two')};
    await demoBallot({...again,action:'prepare'},pool);
    assert.equal((await demoBallot({...again,action:'confirm'},pool)).state,'success');
    assert.equal((await pool.query(`SELECT count(*)::int n FROM christmas_contenders_ballots WHERE state='confirmed'`)).rows[0].n,2);
    await pool.query(`UPDATE christmas_contenders_settings SET settings=jsonb_set(settings,'{repeatDemo}','false') WHERE competition=$1`,[COMPETITION]);
    await assert.rejects(demoBallot({...again,action:'confirm'},pool),/switched off/);
    await pool.query(`UPDATE christmas_contenders_settings SET settings=jsonb_set(settings,'{demoAvailability}','"closed"') WHERE competition=$1`,[COMPETITION]);
    await assert.rejects(demoBallot({...second,action:'prepare'},pool),/closed/);
    await assert.rejects(pool.query(`UPDATE christmas_contenders_entries SET mode='live' WHERE id='bob-the-elf'`));
  } finally {
    await pool.end();
    await base.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await base.end();
  }
});
