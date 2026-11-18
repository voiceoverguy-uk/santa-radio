export function selectStitcherFiles(files) {
  const selected = {};
  for (const file of files) {
    const kind = /\.mp3$/i.test(file.name) ? 'audio' : /\.(png|jpe?g|webp)$/i.test(file.name) ? 'image' : null;
    if (!kind) throw new Error('Choose an MP3 and a JPG, PNG or WebP image.');
    if (selected[kind]) throw new Error(`Please choose just one ${kind} at a time.`);
    if (!file.size || file.size > (kind === 'audio' ? 100 : 20) * 1024 * 1024) throw new Error(`${kind === 'audio' ? 'MP3s must be under 100 MB' : 'Images must be under 20 MB'} and cannot be empty.`);
    selected[kind] = file;
  }
  return selected;
}

export function drawStitcherImage(canvas, image, name, branded = false) {
  const scale = Math.min(1, 1920 / Math.max(image.naturalWidth, image.naturalHeight));
  canvas.width = branded ? 1920 : Math.max(2, Math.round(image.naturalWidth * scale / 2) * 2);
  canvas.height = branded ? 1080 : Math.max(2, Math.round(image.naturalHeight * scale / 2) * 2);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#101820';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  if (!name.trim() && !branded) return;
  const band = canvas.height * (branded ? 0.25 : 0.22);
  ctx.fillStyle = branded ? '#0b3025' : 'rgba(0,0,0,0.75)';
  if (!branded) ctx.fillRect(0, canvas.height - band, canvas.width, band);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = branded ? '#efd18a' : '#fff';
  ctx.font = `${Math.min(canvas.width * 0.038, band * 0.2)}px Georgia, serif`;
  ctx.fillText(name.trim() ? 'A message from Santa to' : 'A message from Santa', canvas.width / 2, canvas.height - band * (name.trim() ? 0.72 : 0.5));
  let size = Math.min(canvas.width * 0.075, band * 0.42);
  ctx.font = `italic ${size}px Georgia, serif`;
  while (ctx.measureText(name.trim()).width > canvas.width * 0.9 && size > 1) {
    size -= 1;
    ctx.font = `italic ${size}px Georgia, serif`;
  }
  ctx.fillStyle = '#fff';
  ctx.fillText(name.trim(), canvas.width / 2, canvas.height - band * 0.3);
}

export const stitcherArguments = ['-loop', '1', '-framerate', '2', '-i', 'image.png', '-i', 'audio.mp3', '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'stillimage', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', 'output.mp4'];
