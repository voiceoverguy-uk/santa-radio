import {test,expect} from '@playwright/test';import {readFileSync,mkdtempSync,rmSync} from 'node:fs';import {execFileSync} from 'node:child_process';import {tmpdir} from 'node:os';import {join} from 'node:path';import ffmpeg from 'ffmpeg-static';
const manifest=JSON.parse(readFileSync('tests/fixtures/dad-catalogue.json'));
for(const width of [390,1280])test(`Dad Studio selects artwork last and exports MP4 at ${width}px`,async({page})=>{
 test.setTimeout(240000);page.setDefaultTimeout(15000);await page.emulateMedia({reducedMotion:"reduce"});await page.setViewportSize({width,height:950});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/dad-studio-access*',r=>r.fulfill({json:{authorized:true,remaining:1}}));
 const folder=mkdtempSync(join(tmpdir(),'dad-browser-'));const audio=join(folder,'sample.mp3');execFileSync(ffmpeg,['-v','error','-f','lavfi','-i','sine=frequency=440:duration=4',audio]);const audioBytes=readFileSync(audio);rmSync(folder,{recursive:true,force:true});let posts=0;
 await page.route('**/api/dad-studio-message',r=>r.request().method()==='GET'?r.fulfill({json:{authorized:true,remaining:1,categories:manifest.categories}}):(++posts,r.fulfill({contentType:'audio/mpeg',headers:{'X-Studio-Selection':Buffer.from(JSON.stringify({record:{id:'jack',name:'jack'},clipStarts:{name:.2,age:.5,habit:.8,viewing:1.4,treat:2,secondName:3},clipEnds:{name:.4,age:.7,habit:1,viewing:1.7,treat:2.5,secondName:3.3}})).toString('base64')},body:audioBytes})));
 await page.route('**/api/santa-names',r=>r.fulfill({json:{records:[{id:'jack',name:'Jack',selectionToken:'fixture',previewUrl:'/api/santa-name-preview?token=fixture'}]}}));
 await page.goto('/dad-message-maker');const decline=page.getByRole('button',{name:'Decline optional cookies',exact:true});if(await decline.isVisible())await decline.click();
 await expect(page.getByRole('heading',{name:'Dad’s Message Maker Studio'})).toBeVisible();await expect(page.locator('.dad-art-options')).toHaveCount(0);
 await page.getByRole('combobox',{name:'Search recorded names',exact:true}).fill('Jack');await page.getByRole('option',{name:'Jack',exact:true}).click();await page.getByRole('button',{name:'Continue →',exact:true}).click();
 for(const label of ['40 years old',manifest.categories.habit[0].label,manifest.categories.viewing[0].label,manifest.categories.treat[0].label]){await page.getByRole('option',{name:label,exact:true}).click();await page.getByRole('button',{name:'Continue →',exact:true}).click();}
 await expect(page.locator('.dad-art-options button')).toHaveCount(5);await page.getByRole('button',{name:'Dad’s greatest hits',exact:true}).click();await page.getByRole('button',{name:'Continue →',exact:true}).click();
 await page.getByRole('button',{name:'Ask Santa to record →',exact:true}).click();
 const link=page.getByRole('link',{name:'Download your message ↓'});await expect(link).toBeVisible({timeout:180000});expect(posts).toBe(1);expect(errors).toEqual([]);
 await expect(page.locator('.dad-panel audio')).toHaveCount(0);await expect(page.locator('.dad-panel video')).toHaveAttribute('poster',/^data:image\/png/);
 await page.getByRole('button',{name:'Play Santa’s message for Jack',exact:true}).click();await expect.poll(()=>page.locator('.dad-panel video').evaluate(el=>el.currentTime)).toBeGreaterThan(0);
 expect(await page.locator('.dad-panel video').evaluate(el=>[el.videoWidth,el.videoHeight])).toEqual([1280,720]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 const pending=page.waitForEvent('download');await link.click();const download=await pending;expect(download.suggestedFilename()).toBe('dad-message-from-santa-to-Jack.mp4');await download.saveAs(test.info().outputPath('dad-preview.mp4'));
 const openingPixels=execFileSync(ffmpeg,['-v','error','-i',test.info().outputPath('dad-preview.mp4'),'-vf','crop=1080:55:100:565','-frames:v','1','-pix_fmt','rgb24','-f','rawvideo','pipe:1']);let openingText=0;
 for(let i=0;i<openingPixels.length;i+=3)if(openingPixels[i]>200&&openingPixels[i+1]>200&&openingPixels[i+2]>180)openingText++;
 expect(openingText).toBeGreaterThan(1000);

 await expect(page.getByRole('progressbar',{name:'Creating your video'})).toHaveCount(0,{timeout:5000});await page.screenshot({path:`/private/tmp/dad-finished-${width}.png`,fullPage:true});
});
