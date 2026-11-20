import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:5009';
try {for(const width of [390,780,1466]){
 const page=await browser.newPage({viewport:{width,height:1000}});
 await page.addInitScript(()=>{sessionStorage.setItem('santa-preview-recipient',JSON.stringify({name:'Freya',at:Date.now()}));});
 await page.goto(origin+'/');
 const decline=page.getByRole('button',{name:'Decline optional cookies'});if(await decline.count())await decline.click();
 await page.locator('.bespoke-offers').waitFor();
 const kids=page.locator('.bespoke-offers .santa-studio-promotion__purchase'),dad=page.locator('.bespoke-offer__cta');
 await kids.scrollIntoViewIfNeeded();
 if(width>680){const [a,b]=await Promise.all([kids.boundingBox(),dad.boundingBox()]);assert.ok(Math.abs(a.y-b.y)<2,`Buttons: ${a.y} vs ${b.y}`);}
 assert.equal(await dad.getAttribute('href'),'/dad-message-maker');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:`/tmp/bespoke-offers-${width}.png`});
 await page.getByRole('button',{name:'Preview the gifts'}).click();
 await page.getByRole('heading',{name:'Personalised digital gifts for Freya'}).waitFor();
 await page.locator('.studio-letter__paper[data-letter-ready=true]').first().waitFor();
 const text=await page.locator('.studio-letter__paper').first().innerText();assert.ok(text.length>700,'Full letter restored');assert.match(text,/Freya/);
 await page.getByRole('button',{name:'Enlarge letter to read'}).click();
 await page.locator('.studio-letter-dialog[open]').waitFor();
 await page.getByRole('button',{name:'Close preview',exact:true}).click();
 await page.getByRole('button',{name:'Preview Dad’s certificate'}).click();
 await page.locator('.dad-certificate img').waitFor();
 await page.getByRole('radio',{name:'Dad in handwritten lettering'}).check();
 await page.locator('.dad-certificate img').waitFor();
 await page.locator('.bespoke-certificate-dialog').screenshot({path:`/tmp/dad-certificate-${width}.png`});
 await page.getByRole('button',{name:'Close preview ×'}).click();
 await kids.click();await page.waitForURL('**/message-maker-checkout');
 console.log('Passed gifts, certificate, checkout route and layout',width);
 await page.close();
 }}finally{await browser.close();}
