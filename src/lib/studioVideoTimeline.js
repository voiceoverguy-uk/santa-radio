// Paid exports use a 720p canvas and transparent text strips, never crossfade full images.
export const STUDIO_VIDEO_WIDTH = 1280;
export const STUDIO_VIDEO_HEIGHT = 720;
export const STUDIO_VIDEO_FPS = 12;
export const STUDIO_VIDEO_ARTWORK = '/images/studio-santa-video-framed-v1.png';
export const STUDIO_SCENE_INSET = { x: 13, y: 12, width: 1254, height: 505 };
export const CAPTION_FADE = 0.75;
export function studioAge(result) {
  const age = String(result.gift?.details?.age || '').replace(/\s+old$/i, '').replace(/\s+years?$/i, '').trim();
  if (!age) throw new Error('The selected age could not be found. Keep this page open and try again.');
  return age;
}
export function studioVideoTimeline(result) {
  const details = result.gift?.details || {};
  const talent = details.talent || details.activity;
  const strengths = [talent, details.achievement].filter(Boolean).join(' and ');
  const cue = (key, fallback, offset = 1) => Number.isFinite(result.clipStarts?.[key]) && result.clipStarts[key] >= 0
    ? result.clipStarts[key] + offset : fallback;
  const nameStart = Math.max(3, cue('name', 10, 0));
  const ageStart = Math.max(nameStart, cue('age', 18, 0));
  const treatStart = cue('treat', 57), placeStart = cue('place', 70);
  const approvedStart = Number.isFinite(result.clipStarts?.secondName) && result.clipStarts.secondName >= 0
    ? result.clipStarts.secondName : placeStart + 15;
  const selectedStrengths = [
    { id: 'talent', text: details.talent ? `Great at ${details.talent}` : '' },
    { id: 'activity', text: details.activity ? `${details.talent ? 'And… trying' : 'Trying'} hard at ${details.activity}` : '' },
    { id: 'achievement', text: details.achievement || '' },
  ].filter(caption => caption.text);
  const hasMeasuredStrengths = selectedStrengths.length > 0 && selectedStrengths.every(caption =>
    Number.isFinite(result.clipEnds?.[caption.id]) && result.clipEnds[caption.id] >= 0);
  const strengthCaptions = hasMeasuredStrengths
    ? selectedStrengths.map((caption, index) => ({ ...caption,
      start: result.clipEnds[caption.id],
      end: Math.min(index + 1 < selectedStrengths.length
        ? result.clipEnds[selectedStrengths[index + 1].id] : treatStart - 1, treatStart - 1),
    })).filter(caption => caption.end > caption.start)
    : strengths ? [{ id: 'strengths', text: `Great at ${strengths}`, start: 38, end: Math.min(50, treatStart - 1) }] : [];

  const choiceCaptions = [
    ...strengthCaptions,
    ...(details.treats ? [{ id: 'treat', text: `Thank you for leaving out ${details.treats}`, start: treatStart, end: Math.min(treatStart + 4, placeStart - 1) }] : []),
    ...(details.destination ? [{ id: 'destination', text: `Santa on the way to ${details.destination}`, start: placeStart, end: Math.min(placeStart + 6, approvedStart) }] : []),
  ].filter(caption => caption.end > caption.start);
  const badgeStart = Math.max(nameStart + CAPTION_FADE, Math.min(approvedStart, ...choiceCaptions.map(caption => caption.start)));
  const name = (result.writtenName || '').trim();
  return [
    { id: 'incoming', text: 'Incoming message from Santa', start: 0, end: 3, blink: true },
    { id: 'intro', text: 'A message from Santa to ', start: nameStart, end: badgeStart },
    { id: 'name', text: name, start: nameStart, end: badgeStart },
    ...(ageStart < badgeStart ? [{ id: 'age', text: ` aged ${studioAge(result)}`, start: ageStart, end: badgeStart }] : []),
    { id: 'name-badge', text: name, start: badgeStart },
    ...choiceCaptions,
    { id: 'approved', text: 'Nice List Approved!', start: approvedStart, end: approvedStart + 9 },
    { id: 'christmas', text: 'Merry Christmas', start: approvedStart + 9 },
  ];
}
export function studioCaptionOpacity(caption, time) {
  if (time < caption.start || (caption.end !== undefined && time >= caption.end)) return 0;
  if (caption.blink) return time % 1 < 0.7 ? 1 : 0;
  return Math.min(1, (time - caption.start) / CAPTION_FADE,
    caption.end === undefined ? 1 : (caption.end - time) / CAPTION_FADE);
}
const makeCanvas = (width, height) => { const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; return canvas; };
const png = canvas => new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not prepare the video captions.')), 'image/png'));
function drawHolly(ctx, x, y, direction) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(direction, 1);
  for (const angle of [-1.13, -0.4, 0.36]) {
    ctx.save();
    ctx.rotate(angle);
    const leaf = ctx.createLinearGradient(-12, 0, 11, 0);
    leaf.addColorStop(0, '#193c22');
    leaf.addColorStop(1, '#5f8d45');
    ctx.fillStyle = leaf;
    ctx.strokeStyle = '#a4b775';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-7, -10, -12, -14);
    ctx.quadraticCurveTo(-5, -16, -11, -26);
    ctx.quadraticCurveTo(-3, -26, 0, -41);
    ctx.quadraticCurveTo(3, -26, 11, -26);
    ctx.quadraticCurveTo(5, -16, 12, -14);
    ctx.quadraticCurveTo(7, -10, 0, 0);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  for (const [dx, dy] of [[-7, 2], [7, 0], [0, 9]]) {
    const berry = ctx.createRadialGradient(dx - 2, dy - 3, 1, dx, dy, 7);
    berry.addColorStop(0, '#fb7972');
    berry.addColorStop(1, '#961629');
    ctx.fillStyle = berry;
    ctx.beginPath();
    ctx.arc(dx, dy, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
function drawStudioRecipientBadge(name, maxTextWidth) {
 const badge = makeCanvas(STUDIO_VIDEO_WIDTH, 86);
 const badgeCtx=badge.getContext('2d');
 let titleSize=42;badgeCtx.font=`bold ${titleSize}px Georgia, serif`;
 while(badgeCtx.measureText(name).width>maxTextWidth&&titleSize>1){titleSize--;badgeCtx.font=`bold ${titleSize}px Georgia, serif`;}
 const x=65,w=badgeCtx.measureText(name).width+100;
 const green=badgeCtx.createLinearGradient(0,5,0,76);green.addColorStop(0,'#31523a');green.addColorStop(.5,'#123d29');green.addColorStop(1,'#071e16');
 badgeCtx.fillStyle=green;badgeCtx.beginPath();badgeCtx.roundRect(x,5,w,70,12);badgeCtx.fill();
 badgeCtx.strokeStyle='#d9b85f';badgeCtx.lineWidth=3;badgeCtx.stroke();
 badgeCtx.strokeStyle='#8f702d';badgeCtx.lineWidth=1;badgeCtx.strokeRect(x+10,14,w-20,52);
 // Holly leaves and berries frame the name without relying on emoji fonts.
 for(const cx of [x+22,x+w-22]){
  badgeCtx.fillStyle='#4a793c';
  for(const direction of [-1,1]){badgeCtx.beginPath();badgeCtx.ellipse(cx+direction*5,33,5,13,direction*.6,0,Math.PI*2);badgeCtx.fill();}
  badgeCtx.fillStyle='#b21b2c';for(const [dx,dy]of [[-4,43],[4,43],[0,49]]){badgeCtx.beginPath();badgeCtx.arc(cx+dx,dy,4,0,Math.PI*2);badgeCtx.fill();}
 }
 badgeCtx.fillStyle='#fff2c9';badgeCtx.textAlign='center';badgeCtx.textBaseline='middle';badgeCtx.shadowColor='#000';badgeCtx.shadowBlur=3;badgeCtx.fillText(name,x+w/2,41);
 return badge;
}
export async function drawStudioVideoFrames(image, result, customTimeline) {
  const width = STUDIO_VIDEO_WIDTH, height = STUDIO_VIDEO_HEIGHT;
  const base = makeCanvas(width, height), ctx = base.getContext('2d');
  if (result.artwork && result.artwork !== STUDIO_VIDEO_ARTWORK) {
    const frame = new Image();
    frame.src = STUDIO_VIDEO_ARTWORK;
    await frame.decode();
    ctx.drawImage(frame, 0, 0, width, height);
    const scene = STUDIO_SCENE_INSET;
    ctx.drawImage(image, scene.x, scene.y, scene.width, scene.height);
  } else {
    ctx.drawImage(image, 0, 0, width, height);
    drawHolly(ctx, 38, height - 31, 1);
    drawHolly(ctx, width - 38, height - 31, -1);
  }
  const timeline = customTimeline || studioVideoTimeline(result);
  const prefix = timeline.find(caption => caption.id === 'intro')?.text || 'A message from Santa to ', name = result.writtenName.trim(), age = timeline.find(caption => caption.id === 'age')?.text || '';
  let nameSize = 48;
  const measure = () => {
    ctx.font = `italic ${nameSize}px Georgia, serif`; const prefixWidth = ctx.measureText(prefix).width;
    ctx.font = `italic ${nameSize}px Georgia, serif`;
    return { prefixWidth, nameWidth: ctx.measureText(name).width, ageWidth: ctx.measureText(age).width };
  };
  let metrics = measure();
  while (metrics.prefixWidth + metrics.nameWidth + metrics.ageWidth > width * .80 && nameSize > 10) {
    nameSize -= .5; metrics = measure();
  }
  // Reserve the age's final width from the start so the name never jumps or overlaps.
  const x = (width - metrics.prefixWidth - metrics.nameWidth - metrics.ageWidth) / 2;
  const top = Math.round(height * .85), stripTop = Math.round(height * .75), stripHeight = height - stripTop;
  const layers = timeline.map(caption => {
    if (caption.id === 'name-badge') return { ...caption, canvas: drawStudioRecipientBadge(name, 230), y: 430 };
    const canvas = makeCanvas(width, stripHeight), text = canvas.getContext('2d');
    text.textBaseline = 'middle'; text.fillStyle = '#fff9ed';
    text.shadowColor = '#071710'; text.shadowBlur = 4;
    if (caption.id === 'incoming') {
      text.font = 'bold 48px "Courier New", monospace';
      text.fillStyle = '#baffad';
      text.textAlign = 'center';
      text.fillText(caption.text, width / 2, top - stripTop);
    } else if (caption.id === 'intro' || caption.id === 'name' || caption.id === 'age') {
      text.font = `italic ${nameSize}px Georgia, serif`;
      text.fillText(caption.text, x + (caption.id === 'intro' ? 0 : metrics.prefixWidth) + (caption.id === 'age' ? metrics.nameWidth : 0), top - stripTop);
    } else {
      let size = 42; text.font = `italic ${size}px Georgia, serif`;
      while (text.measureText(caption.text).width > width * .72 && size > 9) { size -= .5; text.font = `italic ${size}px Georgia, serif`; }
      text.textAlign = 'center'; text.fillStyle = '#fff9ed';
      text.fillText(caption.text, width / 2, top - stripTop);
    }
    return { ...caption, canvas, y: stripTop };
  });
  return { base, layers };
}
export function studioTimelineArguments(layers, duration) {
  const args = ['-loop', '1', '-framerate', '1', '-i', 'image.png'];
  for (const layer of layers) args.push('-loop', '1', '-framerate', '1', '-i', `${layer.id}.png`);
  args.push('-i', 'audio.mp3');
  const filters = [`[0:v]fps=${STUDIO_VIDEO_FPS}[base]`]; let previous = 'base';
  layers.forEach((layer, index) => {
    const fadeOut = layer.end === undefined ? '' : `,fade=t=out:st=${layer.end - CAPTION_FADE}:d=${CAPTION_FADE}:alpha=1`;
    const fade = layer.blink ? '' : `,fade=t=in:st=${layer.start}:d=${CAPTION_FADE}:alpha=1${fadeOut}`;
    const blink = layer.blink ? `:enable='gte(t,${layer.start})*lt(t,${layer.end})*lt(mod(t,1),0.7)'` : '';
    filters.push(`[${index + 1}:v]fps=${STUDIO_VIDEO_FPS},format=rgba${fade}[text${index}]`);
    filters.push(`[${previous}][text${index}]overlay=0:${layer.y}:format=auto${blink}[frame${index}]`);
    previous = `frame${index}`;
  });
  filters.push(`[${previous}]format=yuv420p[video]`);
  args.push('-filter_complex', filters.join(';'), '-map', '[video]', '-map', `${layers.length + 1}:a:0`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'stillimage', '-crf', '27', '-maxrate', '350k', '-bufsize', '700k',
    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart');
  if (duration > 0) args.push('-t', String(duration));
  return [...args, 'output.mp4'];
}
export async function prepareStudioVideoFrames(image, result, duration) {
  const { base, layers } = await drawStudioVideoFrames(image, result);
  // Short recordings do not need layers whose cue is beyond the audio.
  const included = layers.filter(layer => !duration || layer.start < duration);
  const files = [{ name: 'image.png', blob: await png(base) }];
  for (const layer of included) files.push({ name: `${layer.id}.png`, blob: await png(layer.canvas) });
  return { files, args: studioTimelineArguments(included, duration) };
}
