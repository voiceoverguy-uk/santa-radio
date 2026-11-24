// Paid exports use a 720p canvas, caption strips and a single prepared Nice List reveal.
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
  const destinationStart = placeStart - 2;
  const approvedStart = Number.isFinite(result.clipStarts?.secondName) && result.clipStarts.secondName >= 0
    ? Math.max(0, result.clipStarts.secondName - 2) : placeStart + 13;
  const selectedStrengths = [
    { id: 'talent', text: details.talent ? `Great at ${details.talent.charAt(0).toLocaleLowerCase('en-GB')}${details.talent.slice(1)}` : '' },
    { id: 'activity', text: details.activity ? `Well done for trying hard at ${details.activity}` : '' },
    { id: 'achievement', text: details.achievement || '' },
  ].filter(caption => caption.text);
  const hasMeasuredStrengths = selectedStrengths.length > 0 && selectedStrengths.every(caption =>
    Number.isFinite(result.clipEnds?.[caption.id]) && result.clipEnds[caption.id] >= 0);
  const strengthCaptions = hasMeasuredStrengths
    ? selectedStrengths.map((caption, index) => ({ ...caption,
      start: result.clipEnds[caption.id] - 2,
      end: Math.min(index + 1 < selectedStrengths.length
        ? result.clipEnds[selectedStrengths[index + 1].id] - 2 : treatStart - 1, treatStart - 1),
    })).filter(caption => caption.end > caption.start)
    : strengths ? [{ id: 'strengths', text: `Great at ${strengths.charAt(0).toLocaleLowerCase('en-GB')}${strengths.slice(1)}`, start: 38, end: Math.min(50, treatStart - 1) }] : [];

  const choiceCaptions = [
    ...strengthCaptions,
    ...(details.treats ? [{ id: 'treat', text: `Thank you for leaving out ${details.treats}`, start: treatStart, end: destinationStart }] : []),
    ...(details.destination ? [{ id: 'destination', text: `Christmas Eve, Santa will be visiting ${details.destination}`, start: destinationStart, end: approvedStart }] : []),
  ];
  const badgeStart = ageStart + 3;
  const name = (result.writtenName || '').trim();
  const introduction = `A message from Santa to ${name}`;
  const personalisedCaptions = choiceCaptions
    .map(caption => {
      const start = Math.max(caption.start, badgeStart);
      return { ...caption, start, end: Math.min(caption.end, start + 4 + CAPTION_FADE) };
    })
    .filter(caption => caption.end > caption.start);
  return [
    { id: 'incoming', text: 'Incoming message from Santa', start: 0, end: 3, blink: true },
    ...(nameStart < ageStart ? [{ id: 'name', text: introduction, start: nameStart, end: ageStart }] : []),
    { id: 'age', text: `${introduction}\nAged ${studioAge(result)}`, start: ageStart, end: badgeStart },
    { id: 'name-badge', text: name, start: badgeStart, end: approvedStart + CAPTION_FADE },
    ...personalisedCaptions,
    { id: 'approved', text: name ? `${name}, Nice List Approved!` : 'Nice List Approved!', start: approvedStart, end: approvedStart + 5 + CAPTION_FADE },
    { id: 'christmas', text: name ? `Merry Christmas, ${name}!` : 'Merry Christmas!', start: approvedStart + 9 },
  ];
}
export function studioCaptionOpacity(caption, time) {
  if (time < caption.start || (caption.end !== undefined && time >= caption.end)) return 0;
  if (caption.noFade) return 1;
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
export function wrapVideoCaption(context, text, maxWidth) {
  return text.split('\n').flatMap(paragraph => {
    const lines = [];
    let line = '';
    for (const word of paragraph.trim().split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && context.measureText(next).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    if (lines.length === 2) {
      const words = paragraph.trim().split(/\s+/);
      const candidates = [];
      for (let split = 1; split < words.length; split++) {
        const first = words.slice(0, split).join(' '), second = words.slice(split).join(' ');
        const firstWidth = context.measureText(first).width, secondWidth = context.measureText(second).width;
        if (firstWidth > maxWidth || secondWidth > maxWidth) continue;
        // Prefer balanced phrases, with at least three words on the last line.
        const orphanPenalty = words.length - split < 3 && words.length >= 5 ? maxWidth * 4 : 0;
        const danglingWord = /^(at|for|the|a|an|and|to|of|with)$/i.test(words[split - 1]) ? maxWidth : 0;
        candidates.push({ lines: [first, second], cost: Math.abs(firstWidth - secondWidth) + orphanPenalty + danglingWord });
      }
      candidates.sort((a, b) => a.cost - b.cost);
      if (candidates.length) return candidates[0].lines;
    }
    return lines;
  });
}

export function drawVideoCaption(caption, { panelTop = 540, panelHeight = 180, shadowOffsetY = 0, maxLines = 2 } = {}) {
  const canvas = makeCanvas(STUDIO_VIDEO_WIDTH, panelHeight);
  const text = canvas.getContext('2d');
  const incoming = caption.id === 'incoming';
  const maxWidth = 1000;
  let size = 48;
  let lines;
  while (true) {
    text.font = incoming ? `bold ${size}px "Courier New", monospace` : `bold ${size}px Georgia, serif`;
    lines = wrapVideoCaption(text, caption.layoutText || caption.text, maxWidth);
    if (size === 24 || (lines.length <= maxLines && lines.every(line => text.measureText(line).width <= maxWidth))) break;
    size--;
  }
  lines = wrapVideoCaption(text, caption.text, maxWidth);
  const captionX = caption.layoutText ? (STUDIO_VIDEO_WIDTH - text.measureText(caption.layoutText).width) / 2 : STUDIO_VIDEO_WIDTH / 2;
  text.textAlign = caption.layoutText ? 'left' : 'center';
  text.textBaseline = 'middle';
  text.fillStyle = incoming ? '#baffad' : '#fff9ed';
  text.shadowColor = '#001b12';
  text.shadowBlur = 3;
  text.shadowOffsetY = shadowOffsetY;
  const spacing = Math.min(size * 1.2, (panelHeight - size * 2) / Math.max(1, lines.length - 1));
  const first = panelHeight / 2 - 2 - (lines.length - 1) * spacing / 2;
  lines.forEach((line, index) => text.fillText(line, captionX, first + index * spacing, maxWidth));
  return { ...caption, canvas, y: panelTop };
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
  const layers = timeline.map(caption => {
    if (caption.id === 'name-badge') return { ...caption, canvas: drawStudioRecipientBadge(caption.text, 230), y: 430 };
    return drawVideoCaption(caption, { panelTop: 517, panelHeight: 190, shadowOffsetY: 2 });
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
    const fade = layer.blink || layer.noFade ? '' : `,fade=t=in:st=${layer.start}:d=${CAPTION_FADE}:alpha=1${fadeOut}`;
    const blink = layer.noFade ? `:enable='gte(t,${layer.start})${layer.end === undefined ? '' : `*lt(t,${layer.end})`}'` : layer.blink ? `:enable='gte(t,${layer.start})*lt(t,${layer.end})*lt(mod(t,1),0.7)'` : '';
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
export async function prepareNiceListReveal(result, start) {
  const [{ exportStudioPicture }, { STUDIO_VIDEO_NICE_LIST_PICTURE }] = await Promise.all([
    import('./studioGiftExports.js'), import('./santaPictureLayout.js'),
  ]);
  const blob = await exportStudioPicture(result.gift?.writtenName || result.writtenName, STUDIO_VIDEO_NICE_LIST_PICTURE);
  const url = URL.createObjectURL(blob);
  const picture = new Image();
  try {
    picture.src = url;
    await picture.decode();
    const scene = STUDIO_SCENE_INSET;
    const canvas = makeCanvas(STUDIO_VIDEO_WIDTH, scene.height);
    const context = canvas.getContext('2d');
    // The video-only panorama matches the inset ratio, filling it on all sides.
    context.drawImage(picture, scene.x, 0, scene.width, scene.height);
    return { id: 'nice-list-picture', start, canvas, y: scene.y };
  } finally { URL.revokeObjectURL(url); }
}

export async function prepareStudioVideoFrames(image, result, duration) {
  const { base, layers } = await drawStudioVideoFrames(image, result);
  // Short recordings do not need layers whose cue is beyond the audio.
  const included = layers.filter(layer => !duration || layer.start < duration);
  const reveal = included.find(layer => layer.id === 'approved');
  if (reveal) included.push(await prepareNiceListReveal(result, reveal.start));
  const files = [{ name: 'image.png', blob: await png(base) }];
  for (const layer of included) files.push({ name: `${layer.id}.png`, blob: await png(layer.canvas) });
  return { files, args: studioTimelineArguments(included, duration) };
}
