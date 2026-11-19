import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const context=await browser.newContext();
try{
 for(const width of [1280,390]){
  const page=await context.newPage({viewport:{width,height:950}});await page.setViewportSize({width,height:950});page.setDefaultTimeout(15000);
  await page.goto(process.env.TEST_URL||'http://127.0.0.1:5007/message-test');
  if(await page.getByLabel('Password',{exact:true}).count()){await page.getByLabel('Password',{exact:true}).fill('headelf');await page.getByRole('button',{name:'Open the preview'}).click();}
  await page.getByRole('heading',{name:'THE BESPOKE SANTA MESSAGES'}).waitFor();
  assert.match(await page.locator('body').innerText(),/the whole family can smile at/);
  assert.match(await page.locator('body').innerText(),/A Christmas message to watch, download and share/);
  for(const name of ['Kids','Dad']){
   const root=page.locator(`[data-demo-player="${name}"]`),range=root.locator('input'),knob=root.locator('.seek-knob');
   await root.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
   assert.equal(await root.locator('video').evaluate(v=>v.controls),false);assert.equal(await root.locator('audio').count(),0);assert.equal(await knob.count(),1);assert.equal(await range.evaluate(e=>getComputedStyle(e).opacity),'0');
   await root.locator('.player-skin').screenshot({path:`/private/tmp/${name}-player-play-${width}.png`});
   await root.getByRole('button',{name:`Play ${name} example`,exact:true}).click();
   await page.waitForFunction(n=>document.querySelector(`[data-demo-player="${n}"] video`).currentTime>0.15,name);
   assert.equal(await root.locator('.pause-art').evaluate(e=>getComputedStyle(e).opacity),'1');
   assert.equal(await root.locator('.play-art').evaluate(e=>getComputedStyle(e).opacity),'1');
   await root.locator('.player-skin').screenshot({path:`/private/tmp/${name}-player-pause-${width}.png`});
   await root.getByRole('button',{name:`Pause ${name} example`,exact:true}).click();
   const box=await root.locator('.seek-wrap').boundingBox();
   await page.mouse.move(box.x+2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width*.6,box.y+box.height/2,{steps:8});await page.mouse.up();
   await page.waitForFunction(n=>{const a=document.querySelector(`[data-demo-player="${n}"] video`);return a.currentTime/a.duration>.55&&a.currentTime/a.duration<.65},name);
   const ratio=await root.locator('video').evaluate(a=>a.currentTime/a.duration*100);
   assert.ok(Math.abs(parseFloat(await knob.evaluate(e=>e.style.left))-ratio)<1);
   await range.focus();await range.press('Home');await page.waitForFunction(n=>document.querySelector(`[data-demo-player="${n}"] video`).currentTime<.1,name);
   await range.press('ArrowRight');assert.ok(Number(await range.inputValue())>0);
   await root.getByRole('button',{name:`Mute ${name} example`,exact:true}).click();assert.equal(await root.locator('video').evaluate(a=>a.muted),true);
   await root.getByRole('button',{name:`Unmute ${name} example`,exact:true}).click();
  }
  await page.getByRole('button',{name:'Play Kids example',exact:true}).click();await page.getByRole('button',{name:'Play Dad example',exact:true}).click();assert.equal(await page.locator('[data-demo-player="Kids"] video').evaluate(a=>a.paused),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:`/private/tmp/video-players-${width}.png`,fullPage:true});await page.close();console.log(`Passed ${width}px: artwork states, one knob, drag seeking, keyboard, mute, exclusive playback and copy`);
 }
}finally{await browser.close();}
