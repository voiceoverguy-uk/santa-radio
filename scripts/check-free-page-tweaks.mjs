import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:5009';
try {
 for(const width of [390,1170]) {
  const page=await browser.newPage({viewport:{width,height:1000}});
  await page.route('**/api/santa-message-access',route=>route.fulfill({json:route.request().method()==='POST'?{state:'verification',verificationId:'12345678-1234-1234-1234-123456789abc'}:{access:false}}));
  await page.goto(origin+'/free-santa-message');
  await page.locator('.message-name-count').filter({hasText:/[\d,]+ names available/}).waitFor();
  await page.locator('.selected-reviews__card').first().waitFor();
  assert.equal(await page.locator('.santa-message-reviews').count(),0);
  assert.equal(await page.locator('.santa-message-access__delivery').count(),0);
  assert.equal(await page.locator('.santa-message-access__privacy').count(),0);
  assert.match(await page.locator('.message-free-intro').innerText(),/Just a human Santa/);
  assert.equal(await page.locator('.santa-message-access__intro').innerText(),'Add details for a free personalised Santa message');
  const delays=await page.locator('.message-guide-cards .smw-explainer-card').evaluateAll(els=>els.map(el=>getComputedStyle(el).animationDelay));
  assert.deepEqual(delays,['0s','3s','6s']);
  await page.locator('input[name=FIRSTNAME]').fill('Preview');await page.locator('input[name=LASTNAME]').fill('Test');await page.locator('input[name=EMAIL]').fill('preview@example.com');
  await page.locator('.santa-message-access__submit').click();
  await page.locator('input[name=code]').waitFor();await page.locator('.santa-message-access__privacy').waitFor();
  assert.equal(await page.locator('input[name=marketingOptIn]').isChecked(),false);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:`/tmp/free-tweaks-${width}.png`,fullPage:true});
  console.log('Passed free page',width);await page.close();
 }
} finally {await browser.close();}
