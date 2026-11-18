import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { buildCatalogue } from '../src/data/mugshot-catalogue.js';
const { catalogue }=buildCatalogue(JSON.parse(fs.readFileSync('src/data/mugshots.json')));
for(const width of [390,1440])test(`broad categories, aliases and priority order at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});
  await page.addInitScript(()=>sessionStorage.setItem('santa-message-offer-shown','shown'));
  await page.goto('/mugshots/all');
  const decline=page.getByRole('button',{name:'Decline optional cookies',exact:true});if(await decline.isVisible())await decline.click();
  const input=page.getByRole('combobox',{name:'Find a famous face',exact:true});
  const cards=page.locator('.mugshots-grid .mugshot-card');
  for(const [query,category] of [['sport','sport'],['comedy','comedy'],['music','music']]){
    await input.fill(query);
    const expected=catalogue.filter(x=>x.categories.includes(category));
    const option=page.getByRole('option').first();
    await expect(option).toContainText(`(${expected.length})`);
    await input.press('ArrowDown');await input.press('Enter');
    await expect(input).toHaveAttribute('aria-expanded','false');
    await expect(cards).toHaveCount(Math.min(100,expected.length));
    await page.getByRole('button',{name:'A–Z',exact:true}).click();
    await expect(cards.first()).toHaveAttribute('href',`/mugshots/${expected[0].song}`);
    const visible=await cards.evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href').split('/').pop()));
    let ordinary=false;for(const slug of visible){const profile=catalogue.find(x=>x.song===slug);if(!profile.homepage)ordinary=true;else expect(ordinary).toBe(false);}
  }
  await input.fill('sport');
  await expect(page.locator('a.mugshot-card').filter({hasText:'Jamie Vardy'})).toBeVisible();
  await expect(page.locator('a.mugshot-card').filter({hasText:'Pep Guardiola'})).toBeVisible();
  await page.screenshot({path:`/tmp/mugshots-sport-${width}.png`,fullPage:false});
  await input.fill('The Beast');await expect(cards).toHaveCount(1);await expect(cards.first()).toContainText('Mark Labbett');
  await input.fill('Doctor Who');await expect(cards).toHaveCount(4);
  await input.fill('qzx-no-match');await expect(cards).toHaveCount(0);
  await page.getByRole('button',{name:'Clear search',exact:true}).click();await expect(cards).toHaveCount(100);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
