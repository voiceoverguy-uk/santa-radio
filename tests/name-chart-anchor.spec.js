import { test, expect } from '@playwright/test';
for (const width of [1320,390]) {
 test(`name chart deep link survives load, reload and back navigation at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});
  await page.route('**/api/name-chart?*',route=>route.fulfill({json:{names:Array.from({length:25},(_,i)=>({rank:i+1,name:i?'Bonnie':'Olivia',movement:'pending',change:null})),updatedAt:new Date().toISOString(),refreshAfter:new Date(Date.now()+43200000).toISOString()}}));
  const aligned=async()=>{
   await expect.poll(()=>page.locator('#name-chart .nc-chart').evaluate(el=>Math.round(el.getBoundingClientRect().top)),{timeout:15000}).toBeGreaterThan(40);
   await expect.poll(()=>page.locator('#name-chart .nc-chart').evaluate(el=>Math.round(el.getBoundingClientRect().top)),{timeout:15000}).toBeLessThan(160);
   expect(await page.evaluate(()=>scrollY)).toBeGreaterThan(1000);
  };
  await page.goto('/#name-chart');await aligned();
  // A section above grows after initial navigation: keep the chart in view.
  await page.locator('#christmas-pairs').evaluate(el=>el.style.paddingBottom='300px');await aligned();
  await page.reload();await aligned();
  await page.goto('/apps');await page.goBack();await aligned();
 });
}
