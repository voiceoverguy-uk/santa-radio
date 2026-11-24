import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { validReviewCredentials } from '../server/store-review-access.js';
import { CONTACT_COOKIE } from '../server/name-request-contact.js';
import { createMessageAccessHandler, freeSession } from '../server/santa-message-access.js';
const password = randomBytes(32).toString('base64url');
const digest = createHash('sha256').update(password).digest('hex');
const fields = { action: 'review-login', username: 'play-review', password };
process.env.SESSION_SECRET = 'review-access-test-only-secret-at-least-32-characters';
process.env.SANTA_TRACKER_REVIEW_PASSWORD_SHA256 = digest;
test('review access fails closed for absent config, invalid password, extra fields and other users', () => {
  assert.equal(validReviewCredentials(fields, digest), true);
  for (const invalid of [undefined, [], {...fields, password: 'wrong'}, {...fields, username: 'customer'}, {...fields, email: 'someone@example.test'}, {...fields, action: 'confirm-code'}]) assert.equal(validReviewCredentials(invalid, digest), false);
  for (const config of ['', 'bad', '0'.repeat(64)]) assert.equal(validReviewCredentials(fields, config), false);
});
test('review login is same-origin, rate-limited, isolated, reusable and sends no email', async () => {
  let limited = 0, block = false, mail = 0;
  const server = createServer(createMessageAccessHandler({
    limit: async () => { limited++; if (block) throw Object.assign(new Error('Try later'), {status:429,retryAfter:60}); },
    readAllowance: async () => 0,
    requestCode: async () => { mail++; return { id: '00000000-0000-4000-8000-000000000001', binding:'test-binding' }; },
    confirmCode: async () => { throw new Error('Reviewer must not use email verification'); },
  }));
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (body, origin=base) => fetch(base,{method:'POST', headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
  try {
    assert.equal((await post(fields,'https://other.test')).status,403);
    assert.equal((await post({...fields,password:'incorrect'})).status,400);
    const subjects=[];
    for(let n=0;n<2;n++) {
      const response=await post(fields); assert.equal(response.status,200);
      assert.deepEqual(await response.json(),{success:true});
      const cookies=response.headers.getSetCookie();
      const access=cookies.find(c=>c.startsWith('santa-free-message='));
      assert.match(access,/HttpOnly/);assert.match(access,/Secure/);assert.match(access,/SameSite=Lax/);
      assert.ok(cookies.find(c=>c.startsWith(CONTACT_COOKIE+'=;') && /Expires=Thu, 01 Jan 1970/.test(c)));
      assert.ok(!cookies.some(c=>c.includes('@')));
      const session=freeSession({headers:{cookie:access.split(';')[0]}});assert.ok(session);subjects.push(session.subject);
      assert.equal(freeSession({headers:{cookie:access.split(';')[0]}},Date.now()+25*3600000),null);
    }
    assert.notEqual(subjects[0],subjects[1]);assert.equal(mail,0);assert.equal(limited,3);
    const normal=await post({action:'request-code',FIRSTNAME:'Test',LASTNAME:'Adult',EMAIL:'test@example.test'});
    assert.equal((await normal.json()).state,'verification');assert.equal(mail,1);
    assert.ok(!normal.headers.getSetCookie().some(c=>c.startsWith('santa-free-message=')));
    block=true;assert.equal((await post(fields)).status,429);
  } finally { await new Promise(resolve=>server.close(resolve)); }
});
