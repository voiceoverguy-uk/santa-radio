import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {buildCatalogue} from '../src/data/mugshot-catalogue.js';
import {mugThumbnail} from '../src/seo/mugImages.js';
const report=JSON.parse(fs.readFileSync('reports/mugshot-november-additions.json'));
const {catalogue}=buildCatalogue(JSON.parse(fs.readFileSync('src/data/mugshots.json')));
for(const entry of report)test(`${entry.artist}: image, search, biography and priority`,async({page,request})=>{
 const profiles=catalogue.filter(x=>x.artist===entry.artist);expect(profiles).toHaveLength(1);
 const profile=profiles[0];expect(profile.homepage).toBe(entry.homepage);expect(profile.categories.length).toBeGreaterThan(0);
 expect(profile.info.split(/\s+/).length).toBeGreaterThanOrEqual(55);
 for(const url of [profile.image,mugThumbnail(profile.image,320),mugThumbnail(profile.image,640)]){
  const response=await request.get(url);expect(response.ok(),url).toBe(true);expect(response.headers()['content-type']).toContain('image/webp');
 }
 await page.addInitScript(()=>sessionStorage.setItem('santa-message-offer-shown','shown'));
 await page.goto('/mugshots/all');
 const decline=page.getByRole('button',{name:'Decline optional cookies',exact:true});if(await decline.isVisible())await decline.click();
 await page.getByRole('combobox',{name:'Find a famous face',exact:true}).fill(entry.artist);
 const card=page.locator(`.mugshot-card[href="/mugshots/${entry.slug}"]`);await expect(card).toBeVisible();
 await expect.poll(()=>card.locator('img').evaluate(x=>x.complete&&x.naturalWidth>0)).toBe(true);
 await card.click();await expect(page.locator('h1')).toHaveText(entry.artist);
 await expect(page.locator('.mugshot-detail-desc')).toHaveText(profile.info);
 await expect.poll(()=>page.locator('.mugshot-detail-photo').evaluate(x=>x.complete&&x.naturalWidth>0)).toBe(true);
});
