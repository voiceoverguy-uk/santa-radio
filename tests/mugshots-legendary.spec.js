import {test,expect} from '@playwright/test';
test('legendary mug stays among first eight across sorting and opens its story',async({page})=>{
 await page.goto('/mugshots/all');
 const mug=page.locator('.mugshot-card[href="/mugshots/the-legendary-mug"]');
 for(const order of ['Shuffle','A–Z','Shuffle']){
  await page.getByRole('button',{name:order,exact:true}).click();
  await expect(mug).toHaveCount(1);
  const index=await page.locator('.mugshot-card').evaluateAll(cards=>cards.findIndex(c=>c.getAttribute('href')==='/mugshots/the-legendary-mug'));
  expect(index).toBeGreaterThanOrEqual(0);expect(index).toBeLessThan(8);
 }
 await page.getByRole('combobox').fill('Jeremy Kyle');await expect(mug).toHaveCount(0);
 await page.getByRole('combobox').fill('');await mug.click();
 await expect(page.getByRole('heading',{level:1,name:'The Legendary Mug'})).toBeVisible();
 await expect(page.locator('.mugshot-detail-desc')).toContainText('the real celebrity held the real mug');
 await expect.poll(()=>page.locator('.mugshot-detail-photo').evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true);
 await expect(page.getByRole('link',{name:'← Back to all Celebrity Mugshots',exact:true})).toHaveAttribute('href','/mugshots/all');
 await page.goto('/mugshots/lee-latchford-evans-steps-singer');
 await expect(page.locator('.mugshot-detail-photo')).toHaveAttribute('src',/lee-latchford-evans-steps-singer-ecurb.webp$/);
});
