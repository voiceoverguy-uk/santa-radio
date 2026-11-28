export const NAME_WINDOWS = [[11, 17], [84, 90]];

export async function nameCaptionPng(name, second = false, siblings = []) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080; canvas.height = 720;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser could not prepare the name caption.');
  if (second) {
    // Inset writing area on the tilted list, in source-frame pixels.
    context.beginPath();
    context.moveTo(350, 280); context.lineTo(685, 180);
    context.lineTo(775, 540); context.lineTo(440, 640);
    context.closePath(); context.clip();
    context.translate(570, 410); context.rotate(-0.36);
  }
  // The parchment is left of the video centre; align with its clear writing area.
  context.textAlign = 'center'; context.textBaseline = 'middle';
  context.fillStyle = '#7a1c24';
  let size = siblings.length ? 60 : 76;
  do { context.font = `italic ${size--}px Georgia, "Times New Roman", serif`; }
  while (context.measureText(name).width > (second ? 320 : 350) && size > 12);
  context.fillText(name, second ? 0 : 490, second ? 0 : 380, second ? 320 : 350);
  const aboveCount = Math.floor(Math.min(siblings.length, 5) / 2);
  for (const [index, sibling] of siblings.slice(0, 5).entries()) {
    const offset = second
      ? (index < aboveCount ? -44 - (aboveCount - index - 1) * 26 : 34 + (index - aboveCount) * 26)
      : (index < aboveCount ? -46 - (aboveCount - index - 1) * 32 : 46 + (index - aboveCount) * 32);
    context.fillStyle = '#594331';
    let siblingSize = Math.max(8, Math.min(second ? 22 : 28, Math.floor((size + 1) * 0.6)));
    do { context.font = `italic ${siblingSize--}px Georgia, "Times New Roman", serif`; }
    while (context.measureText(sibling).width > 260 && siblingSize > 8);
    context.fillText(sibling, second ? 0 : 490, (second ? 0 : 380) + offset, 260);
  }
  const png = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!png) throw new Error('The name caption could not be prepared.');
  return new Uint8Array(await png.arrayBuffer());
}
