import { expect } from '@playwright/test';

// Compare painted controls with an unthemed native player in the same browser,
// at the same coordinates. Computed audio backgrounds miss UA shadow panels.
export async function expectNativeMessagePlayer(page, player, testInfo, label) {
  await player.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  const actual = await player.screenshot({ animations: 'disabled', path: testInfo.outputPath(`${label}-actual.png`) });
  await player.evaluate(element => {
    const box = element.getBoundingClientRect();
    const reference = document.createElement('audio');
    reference.id = 'native-player-reference';
    reference.controls = true;
    reference.preload = 'none';
    reference.src = element.src;
    reference.style.cssText = `all: revert; position: absolute; z-index: 99999;
      display: block; margin: 0; border-radius: 999px;
      left: ${box.left + scrollX}px; top: ${box.top + scrollY}px;
      width: ${box.width}px; height: ${box.height}px;`;
    document.body.append(reference);
  });
  try {
    const reference = await page.locator('#native-player-reference').screenshot({
      animations: 'disabled', path: testInfo.outputPath(`${label}-native-reference.png`),
    });
    await testInfo.attach(`${label}-actual`, { body: actual, contentType: 'image/png' });
    await testInfo.attach(`${label}-native-reference`, { body: reference, contentType: 'image/png' });
    // Allow fractional-position text/icon rasterisation differences, but not
    // a recoloured surface (which changes most of the painted pixels).
    const differentPixels = await page.evaluate(async ({ actual, reference }) => {
      const decode = async data => {
        const image = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        return context.getImageData(4, 4, image.width - 8, image.height - 8).data;
      };
      const [left, right] = await Promise.all([decode(actual), decode(reference)]);
      let different = 0;
      for (let i = 0; i < left.length; i += 4) {
        if ([0, 1, 2].some(channel => Math.abs(left[i + channel] - right[i + channel]) > 20)) different++;
      }
      return different / (left.length / 4);
    }, { actual: actual.toString('base64'), reference: reference.toString('base64') });
    expect(differentPixels, 'Painted controls match native audio, not a custom coloured panel').toBeLessThan(0.08);
  } finally {
    await page.locator('#native-player-reference').evaluate(element => element.remove());
  }
}
