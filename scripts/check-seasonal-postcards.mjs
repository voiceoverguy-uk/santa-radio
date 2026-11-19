import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:5009';
try { for(const width of [390,1466]) {
 const p=await b.newPage({viewport:{width,height:1265}});
 await p.goto(origin+'/santa-tracker');
 await p.locator('.tracker-postcard').waitFor();
 const body=p.locator('.tracker-postcard .postcard-ink').nth(1);
 const first=await body.innerText();
 assert.ok(first.length>20);
 assert.match(await p.locator('.tracker-story-section').innerText(),/ROUTE PLANNING POSTCARDS/i);
 if(width>768){assert.equal(await body.evaluate(e=>getComputedStyle(e).fontSize),'28px');assert.ok((await p.locator('.tracker-postcard').boundingBox()).width>700);}
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await p.waitForTimeout(16000);assert.notEqual(await body.innerText(),first);
 await p.goto(origin+'/mugshots/all');
 assert.equal(await p.locator('.mugshots-live-count').evaluate(e=>getComputedStyle(e).color),'rgb(240, 215, 133)');
 console.log('Postcard layout, rotation and gold count passed',width);await p.close();
}} finally {await b.close();}
