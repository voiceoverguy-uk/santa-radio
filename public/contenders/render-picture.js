function drawLabel(ctx, text, y, size, colour) {
  ctx.fillStyle = colour;
  ctx.font = 'bold ' + size + 'px Georgia';
  const lines = [''];
  for (const word of text.split(/\s+/)) {
    const i = lines.length - 1;
    const next = [lines[i], word].filter(Boolean).join(' ');
    if (lines[i] && ctx.measureText(next).width > 940) lines.push(word);
    else lines[i] = next;
  }
  if (lines.length > 2 && size > 24) return drawLabel(ctx, text, y, size - 4, colour);
  lines.forEach((line, i) => ctx.fillText(line, 540, y + (i - (lines.length - 1) / 2) * size * 1.15, 940));
}

export async function votingPicture(song) {
  const logo = new Image();
  logo.src = '/contenders/christmas-contenders-logo.webp';
  await logo.decode();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1080;
  const ctx = canvas.getContext('2d');
  const green = ctx.createLinearGradient(0, 0, 1080, 1080);
  green.addColorStop(0, '#21533c');
  green.addColorStop(1, '#071f18');
  ctx.fillStyle = green;
  ctx.fillRect(0, 0, 1080, 1080);
  ctx.strokeStyle = '#d8b970';
  ctx.lineWidth = 3;
  ctx.strokeRect(26, 26, 1028, 1028);
  const logoHeight = Math.min(370, 850 * logo.height / logo.width);
  const logoWidth = logoHeight * logo.width / logo.height;
  ctx.drawImage(logo, (1080 - logoWidth) / 2, 64, logoWidth, logoHeight);
  ctx.textAlign = 'center';
  drawLabel(ctx, 'UP VOTE', 535, 70, '#f4d485');
  drawLabel(ctx, song.title, 690, 78, '#fff8e7');
  drawLabel(ctx, song.artist, 847, 54, '#f4d485');
  drawLabel(ctx, 'SantaRadio.co.uk/christmas-contenders', 982, 34, '#fff8e7');
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error();
  return blob;
}
