import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:5009';
try {for(const width of [390,1466]){
 const p=await browser.newPage({viewport:{width,height:1265}});
 await p.goto(origin+'/santa-tracker/preview?postcards=1');
 await p.locator('.tracker-postcard').waitFor();
 await p.getByRole('button',{name:'Pause',exact:true}).waitFor();
 assert.equal(await p.getByRole('button',{name:'Pause',exact:true}).getAttribute('aria-pressed'),'true');
 for(const [city,pattern] of [['sydney',/Australia/i],['tokyo',/East Asia|Japan/i],['london',/Europe|UK/i],['newyork',/North America|USA|United States/i]]){
  await p.getByRole('combobox',{name:'Jump to destination'}).selectOption('city:'+city);
  await p.waitForTimeout(150);
  assert.match(await p.locator('.tracker-postcard .postcard-ink').nth(1).innerText(),pattern);
 }
 const message=p.locator('.tracker-postcard .postcard-ink').nth(1);
 const first=await message.innerText();
 const counter=p.locator('.tracker-postcard-next span');
 const total=Number((await counter.innerText()).split(' of ')[1]);
 await p.getByRole('button',{name:'Next postcard',exact:false}).click();
 assert.notEqual(await message.innerText(),first);
 for(let i=1;i<total;i++)await p.getByRole('button',{name:'Next postcard',exact:false}).click();
 assert.equal(await message.innerText(),first);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await p.getByRole('button',{name:'60×',exact:true}).click();
 assert.equal(await p.getByRole('button',{name:'60×',exact:true}).getAttribute('aria-pressed'),'true');
 await p.goto(origin+'/santa-tracker');await p.locator('.tracker-postcard').waitFor();
 assert.equal(await p.getByRole('button',{name:'Next postcard',exact:false}).count(),0);
 assert.equal(await p.getByRole('switch',{name:'Preview mode'}).count(),0);
 assert.match(await p.locator('.tracker-story-section').innerText(),/Route Planning Postcards/i);
 console.log('Preview destination jumps, pause, speed and live isolation passed',width);await p.close();
}} finally {await browser.close();}
