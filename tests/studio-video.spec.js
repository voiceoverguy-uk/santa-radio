import { test, expect } from '@playwright/test';
import { workshopCatalogueFixture } from './fixtures/workshop-catalogue.js';
import { mockStudioGeneration, confirmMessage } from './helpers/studio-generation.js';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unzipSync } from 'fflate';
import ffmpeg from 'ffmpeg-static';

for (const width of [390, 1280]) test(`paid result plays and downloads premium MP4 and bundles it with the gifts at ${width}px`, async ({ page }) => {
  test.setTimeout(180000); page.setDefaultTimeout(15000);
  const folder=mkdtempSync(join(tmpdir(),'studio-video-'));
  try {
    await page.addInitScript(() => {
      window.paidCaptionText=[];
      const draw=CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText=function(text,...args){window.paidCaptionText.push(text);return draw.call(this,text,...args);};
    });
    await page.setViewportSize({ width, height: 950 });
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.route('**/api/santa-studio-access*', r=>r.fulfill({json:{authorized:true,mode:'live',remaining:2}}));
    await page.route('**/api/santa-workshop-access*', r=>r.fulfill({json:{authorized:false}}));
    await page.route('**/api/santa-workshop-catalogue*', r=>r.fulfill({json:workshopCatalogueFixture}));
    await page.route('**/api/santa-names',r=>r.fulfill({json:{records:[{id:'dixie-variant',name:'Dixie',selectionToken:'fixture',previewUrl:'/api/santa-name-preview?token=fixture'}]}}));
    const fixture=await mockStudioGeneration(page,{limited:true});
    const audio=join(folder,'fixture.mp3');execFileSync(ffmpeg,['-v','error','-f','lavfi','-i','sine=frequency=440:duration=2',audio]);fixture.audio=readFileSync(audio);
    await page.goto('/bespoke-personalised-message-from-santa');
    const decline=page.getByRole('button',{name:'Decline optional cookies',exact:true});if(await decline.isVisible())await decline.click();
    await page.getByRole('combobox',{name:'Search recorded names',exact:true}).fill('Dixie');
    await page.getByRole('option',{name:'Dixie',exact:true}).click();
    await page.locator('.smw-actions .smw-button-next').click();
    for(const answer of ['9 years old','Tennis','Teamwork','Completing a jigsaw puzzle','Bûche de Noël','England']){
      if(answer===null){await page.getByRole('button',{name:'Skip this section'}).click();continue;}
      await page.getByRole('option',{name:answer,exact:true}).click();await page.locator('.smw-actions .smw-button-next').click();
    }
    await page.getByRole('button',{name:'Edit certificate name',exact:true}).click();
    await page.getByRole('textbox',{name:'Name spelling',exact:true}).fill('Dixie Rose');
    await page.getByRole('button',{name:'Use this spelling',exact:true}).click();
    let failArtwork=true;
    await page.route('**/images/studio-santa-video-v2.png', route => failArtwork ? route.abort('failed') : route.continue());
    await confirmMessage(page);
    const result=page.getByRole('region',{name:'Your finished Santa message',exact:true});
    await expect(result.getByRole('button',{name:'Retry video preparation',exact:true})).toBeVisible();
    failArtwork=false;
    await result.getByRole('button',{name:'Retry video preparation',exact:true}).click();
    expect(fixture.posts).toHaveLength(1);
    const link=result.getByRole('link',{name:'Download your message'});
    await expect(link).toBeVisible({timeout:90000});
    expect(await page.evaluate(()=>window.paidCaptionText)).toContain('Great at Tennis and Completing a jigsaw puzzle');
    await expect(result.locator('audio')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await expect(result).not.toContainText('MP3');
    const video=result.locator('video');expect(await video.evaluate(el=>el.controls)).toBe(false);
    await result.getByRole('button',{name:'Play Santa’s premium video message for Dixie Rose',exact:true}).click();
    await expect.poll(()=>video.evaluate(el=>el.currentTime)).toBeGreaterThan(0);
    await result.getByRole('button',{name:'Pause Santa’s premium video message for Dixie Rose',exact:true}).click();
    await result.locator('.santa-video-player').screenshot({path:'/tmp/studio-premium-video.png'});
    const pending=page.waitForEvent('download');await link.click();const download=await pending;
    expect(download.suggestedFilename()).toMatch(/Dixie[ -]Rose.*\.mp4$/i);
    expect(await video.evaluate(el=>[el.videoWidth,el.videoHeight])).toEqual([1280,720]);
    const out=join(folder,'paid.mp4');await download.saveAs(out);execFileSync(ffmpeg,['-v','error','-i',out,'-map','0:a:0','-f','null','-']);
    const bundle=page.waitForEvent('download');await result.getByRole('button',{name:'Download All',exact:false}).click();const zip=await bundle;const zipPath=join(folder,'bundle.zip');await zip.saveAs(zipPath);
    const names=Object.keys(unzipSync(readFileSync(zipPath)));expect(names.filter(n=>n.endsWith('.mp4'))).toHaveLength(1);expect(names.some(n=>n.endsWith('.mp3'))).toBe(false);expect(names.filter(n=>n.endsWith('.pdf'))).toHaveLength(2);expect(names.filter(n=>n.endsWith('.png'))).toHaveLength(1);
    expect(fixture.posts).toHaveLength(1);
    await expect(result.getByRole('progressbar')).toHaveCount(0,{timeout:5000});
  }finally{rmSync(folder,{recursive:true,force:true});}
});
