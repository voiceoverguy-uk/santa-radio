import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:5009';
try {
for(const width of [390,1466]) {
const p=await browser.newPage({viewport:{width,height:1265}});
await p.addInitScript(()=>sessionStorage.setItem('santa-message-offer-shown','shown'));
const tops=[];
for(const route of ['/apps','/christmas-music','/mugshots/all']) {
await p.goto(origin+route);await p.evaluate(()=>document.fonts.ready);
const logo=p.locator('.apps-page-logo,.music-page-logo,.mugshots-page-logo');
tops.push((await logo.boundingBox()).y);
assert.equal(await p.locator('.app-voicemail-controls,.shops-preview-controls,.mugshots-count,.mugshots-eyebrow').count(),0);
assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
}
assert.ok(Math.max(...tops)-Math.min(...tops)<8,JSON.stringify(tops));
assert.match(await p.locator('.mugshots-page-sub').innerText(),/^\d[\d,]* Famous Faces/);
assert.notEqual(await p.locator('.mugshot-card--legendary').evaluate(e=>getComputedStyle(e).boxShadow),'none');
await p.goto(origin+'/santa-tracker');await p.getByRole('button',{name:'Share this postcard'}).waitFor();
assert.equal(await p.locator('.tracker-inline-report .tracker-story-card').count(),1);
assert.equal(await p.locator('.tracker-status-message').count(),0);
assert.equal(await p.getByText('Using The Santa Tracker by Santa Radio on iOS?',{exact:false}).count(),0);
assert.match(await p.locator('.tracker-questions').innerText(),/How to track Santa/);
await p.getByText('Is this real GPS tracking?',{exact:true}).click();
assert.match(await p.locator('.tracker-questions').innerText(),/Santa does not allow real time tracking/);
await p.goto(origin+'/free-santa-message#santa-messages');await p.waitForTimeout(1200);
const top=await p.locator('#santa-messages .message-layout').evaluate(e=>e.getBoundingClientRect().top);
assert.ok(top>=20&&top<150,`layout top ${top}`);
console.log('Tracker, logos, mug glow and free-message anchor passed',width);await p.close();
}
} finally {await browser.close();}
