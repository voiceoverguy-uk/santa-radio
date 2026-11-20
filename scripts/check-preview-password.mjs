import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const password=process.env.TEST_PREVIEW_PASSWORD;if(!password)throw new Error('TEST_PREVIEW_PASSWORD is required');
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:5009';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
 const context=await browser.newContext();const p=await context.newPage();
 let response=await p.goto(origin+'/santa-tracker/preview?postcards=1');
 assert.match(response.headers()['cache-control'],/no-store/);
 assert.equal(await p.locator('.tracker-postcard').count(),0);
 await p.getByLabel('Password',{exact:true}).fill('incorrect-preview-password');await p.getByRole('button',{name:'Unlock preview'}).click();
 await p.getByRole('alert').waitFor();assert.match(await p.getByRole('alert').innerText(),/wasn’t right/);
 await p.getByLabel('Password',{exact:true}).fill(password);await p.getByRole('button',{name:'Unlock preview'}).click();
 await p.locator('.tracker-postcard').waitFor();assert.ok(p.url().includes('postcards=1'));
 const cookie=(await context.cookies()).find(c=>c.name==='santa_tracker_preview');assert.ok(cookie.httpOnly);assert.equal(cookie.sameSite,'Lax');if(origin.startsWith('https:'))assert.ok(cookie.secure);
 await p.reload();await p.getByRole('button',{name:'Next postcard',exact:false}).waitFor();
 await context.clearCookies();await p.reload();await p.getByLabel('Password',{exact:true}).waitFor();assert.equal(await p.locator('.tracker-postcard').count(),0);
 await p.goto(origin+'/santa-tracker');await p.locator('.tracker-postcard').waitFor();
 console.log('Password gate, incorrect password, session, logout-by-clearing and public tracker passed');
}finally{await browser.close();}
