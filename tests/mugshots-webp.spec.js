import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {buildCatalogue} from '../src/data/mugshot-catalogue.js';
import {mugThumbnail} from '../src/seo/mugImages.js';
const {catalogue}=buildCatalogue(JSON.parse(fs.readFileSync('src/data/mugshots.json')));
test('every public portrait and both thumbnail sizes decode',async({page})=>{
 test.setTimeout(180000);
 await page.goto('/mugshots/all');
 const urls=catalogue.flatMap(x=>[x.image,mugThumbnail(x.image,320),mugThumbnail(x.image,640)]);
 expect(urls.every(url=>url.endsWith('.webp'))).toBe(true);
 const broken=await page.evaluate(async urls=>{
  const failures=[];let index=0;
  await Promise.all(Array.from({length:8},async()=>{while(index<urls.length){const url=urls[index++];const img=new Image();img.src=url;try{await img.decode();if(!img.naturalWidth)failures.push(url);}catch{failures.push(url);}img.src='';}}));
  return failures;
 },urls);
 expect(broken).toEqual([]);
});
test('replacement portraits and back links render on their existing addresses',async({page})=>{
 for(const slug of ['tony-blackburn-radio-presenter','jb-singer','rob-beckett-comedian']){
  await page.goto(`/mugshots/${slug}`);
  await expect(page.getByRole('link',{name:'← Back to all Celebrity Mugshots',exact:true})).toHaveAttribute('href','/mugshots/all');
  await expect.poll(()=>page.locator('.mugshot-detail-photo').evaluate(x=>x.complete&&x.naturalWidth>0)).toBe(true);
  await expect(page.locator('.mugshot-detail-photo')).toHaveAttribute('src',/\.webp$/);
 }
});
