import { test, expect } from '@playwright/test';
const token = 'a'.repeat(43);
test('Dashboard embeds authenticated stitcher, keeps plans, and locks cleanly', async ({ page, request }) => {
  const redirect = await request.get('/santa-videos', { maxRedirects: 0 });
  expect(redirect.status()).toBe(307);
  expect(redirect.headers().location).toBe('/santa-dashboard#video-stitcher');
  const denied = await request.get('/api/santa-videos?asset=source');
  expect(denied.status()).toBe(401);
  expect(denied.headers()['www-authenticate']).toBeUndefined();
  expect((await request.get('/api/santa-videos', {headers:{Authorization:'Basic '+Buffer.from('santa:headelf').toString('base64')}})).status()).toBe(401);
  expect((await request.get('/api/santa-videos?asset=source', { headers: { Authorization: `Bearer studio-owner.${token}`, Range: 'bytes=0-99' } })).status()).toBe(206);
  await page.route('**/api/message-statistics*', route => route.fulfill({json:{names:[],daily:[],votes:[],allTime:{creations:0,downloads:0,listens:0,shares:0}}}));
  await page.route('**/api/santa-videos?asset=choices', route => {
    expect(route.request().headers().authorization).toBe(`Bearer studio-owner.${token}`);
    return route.fulfill({json:{categories:{age:[{id:'age-5',label:'5 years old'}],sports:[],funny:[],activity:[],achievement:[],treat:[],place:[{id:'uk',label:'United Kingdom'},{id:'fr',label:'France'}]},regionalGroups:[{parentId:'uk',records:[{id:'yorkshire',label:'Yorkshire'}]}]}});
  });
  await page.goto('/santa-dashboard#video-stitcher');
  await page.locator('#dashboard-token').fill(token);
  await page.getByRole('button',{name:'Open dashboard',exact:true}).click();
  const frame=page.frameLocator('iframe[title="Santa video stitcher"]');
  await expect(frame.locator('#planning-status')).toContainText('choices loaded');
  await frame.locator('#plan-age').selectOption('age-5');
  await frame.locator('#plan-place').selectOption('uk');
  await frame.locator('#plan-region').selectOption('yorkshire');
  await frame.getByLabel('Age: placement or visual idea').fill('Show at 0:25');
  await frame.locator('#plan-place').selectOption('fr');
  await expect(frame.locator('#plan-field-region')).toBeHidden();
  await expect(frame.locator('#plan-region')).toHaveValue('');
  await page.getByRole('link',{name:'Message demo videos',exact:true}).click();
  await page.getByRole('link',{name:'Video stitcher',exact:true}).click();
  await expect(frame.locator('#plan-age')).toBeVisible();
  await expect(frame.locator('#plan-age')).toHaveValue('age-5');
  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:1000});
    const size=await frame.locator('#video-preview').evaluate(video=>{document.getElementById('result').hidden=false; const parent=video.parentElement;const style=getComputedStyle(parent);return {width:video.getBoundingClientRect().width,available:parent.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),viewport:innerWidth};});
    expect(size.width/size.available).toBeCloseTo(size.viewport>720?0.5:1,2);
  }
  await page.getByRole('button',{name:'Lock dashboard',exact:true}).click();
  await expect(page.locator('iframe')).toHaveCount(0);
  expect(await page.evaluate(()=>Object.values(localStorage).some(value=>value.includes('a'.repeat(43))))).toBe(false);
});

test('siblings support Enter, five-name limit, removal, and the requested caption layout', async ({ browser }) => {
  const context=await browser.newContext({extraHTTPHeaders:{Authorization:`Bearer studio-owner.${token}`} });
  const page=await context.newPage();
  await page.goto('/api/santa-videos');
  const names=['Amelia','Oliver','Isabella','Theodore','Charlotte'];
  for(const name of names) { await page.locator('#sibling-name').fill(name); await page.locator('#sibling-name').press('Enter'); }
  await expect(page.locator('#sibling-list li')).toHaveCount(5);
  await expect(page.locator('#sibling-name')).toBeDisabled();
  await page.getByRole('button',{name:'Remove sibling Oliver',exact:true}).click();
  await expect(page.locator('#sibling-name')).toBeEnabled();
  await page.locator('#sibling-name').fill('Oliver'); await page.locator('#sibling-add').click();
  const layouts=await page.evaluate(async names=>{
    const {nameCaptionPng}=await import('/src/santa-videos/nameCaption.js');
    const original=CanvasRenderingContext2D.prototype.fillText;
    const results=[]; let calls=[];
    CanvasRenderingContext2D.prototype.fillText=function(text,x,y,...args){calls.push({text,x,y,color:this.fillStyle,font:this.font}); return original.call(this,text,x,y,...args);};
    try {for(let count=1;count<=5;count++){calls=[];await nameCaptionPng('Charleigh-Fae',true,names.slice(0,count));results.push(calls);}}
    finally {CanvasRenderingContext2D.prototype.fillText=original;}
    return results;
  },names);
  for(let count=1;count<=5;count++){
    const [main,...siblings]=layouts[count-1];
    expect(siblings.filter(item=>item.y<main.y)).toHaveLength(Math.floor(count/2));
    expect(siblings.filter(item=>item.y>main.y)).toHaveLength(Math.ceil(count/2));
    expect(siblings.every(item=>item.color==='#594331' && parseFloat(item.font.match(/([\d.]+)px/)[1])<parseFloat(main.font.match(/([\d.]+)px/)[1]))).toBe(true);
  }
  await context.close();
});
