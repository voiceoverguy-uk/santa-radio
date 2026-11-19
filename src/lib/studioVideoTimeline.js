// Paid exports use a 720p canvas and transparent text strips, never crossfade full images.
export const STUDIO_VIDEO_WIDTH = 1280;
export const STUDIO_VIDEO_HEIGHT = 720;
export const STUDIO_VIDEO_FPS = 12;
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
  const cue = (key, fallback) => Number.isFinite(result.clipStarts?.[key]) && result.clipStarts[key] >= 0
    ? result.clipStarts[key] + 1 : fallback;
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


  return [
    { id: 'name', text: (result.writtenName || '').trim(), start: 10 },
    { id: 'age', text: ` aged ${studioAge(result)}`, start: 18 },
    ...strengthCaptions,
    ...(details.treats ? [{ id: 'treat', text: `Thank you for leaving out ${details.treats}`, start: treatStart, end: Math.min(treatStart + 4, placeStart - 1) }] : []),
    ...(details.destination ? [{ id: 'destination', text: `Santa on the way to ${details.destination}`, start: placeStart, end: Math.min(placeStart + 6, approvedStart) }] : []),
    { id: 'approved', text: 'Nice List Approved!', start: approvedStart, end: approvedStart + 10 },
  ];
}
export function studioCaptionOpacity(caption, time) {
  if (time < caption.start || (caption.end !== undefined && time >= caption.end)) return 0;
  return Math.min(1, (time - caption.start) / CAPTION_FADE,
    caption.end === undefined ? 1 : (caption.end - time) / CAPTION_FADE);
}
const makeCanvas = (width, height) => { const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; return canvas; };
const png = canvas => new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not prepare the video captions.')), 'image/png'));
export function drawStudioVideoFrames(image, result) {
  const width = STUDIO_VIDEO_WIDTH, height = STUDIO_VIDEO_HEIGHT;
  const base = makeCanvas(width, height), ctx = base.getContext('2d');
  ctx.drawImage(image, 0, 0, width, height);
  const timeline = studioVideoTimeline(result);
  const prefix = 'A message from Santa to ', name = result.writtenName.trim(), age = timeline.find(caption => caption.id === 'age').text;
  let nameSize = 40;
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
  const top = Math.round(height * .815), stripTop = Math.round(height * .75), stripHeight = height - stripTop;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = `italic ${nameSize}px Georgia, serif`; ctx.fillStyle = '#fff9ed'; ctx.fillText(prefix, x, top);
  const layers = timeline.map(caption => {
    const canvas = makeCanvas(width, stripHeight), text = canvas.getContext('2d');
    text.textBaseline = 'middle'; text.fillStyle = '#fff9ed';
    if (caption.id === 'name' || caption.id === 'age') {
      text.font = `italic ${nameSize}px Georgia, serif`;
      text.fillText(caption.text, x + metrics.prefixWidth + (caption.id === 'age' ? metrics.nameWidth : 0), top - stripTop);
    } else {
      let size = 34; text.font = `italic ${size}px Georgia, serif`;
      while (text.measureText(caption.text).width > width * .72 && size > 9) { size -= .5; text.font = `italic ${size}px Georgia, serif`; }
      text.textAlign = 'center'; text.fillStyle = '#fff9ed';
      text.fillText(caption.text, width / 2, Math.round(height * .912) - stripTop);
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
    filters.push(`[${index + 1}:v]fps=${STUDIO_VIDEO_FPS},format=rgba,fade=t=in:st=${layer.start}:d=${CAPTION_FADE}:alpha=1${fadeOut}[text${index}]`);
    filters.push(`[${previous}][text${index}]overlay=0:${layer.y}:format=auto[frame${index}]`);
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
  const { base, layers } = drawStudioVideoFrames(image, result);
  // Short recordings do not need layers whose cue is beyond the audio.
  const included = layers.filter(layer => !duration || layer.start < duration);
  const files = [{ name: 'image.png', blob: await png(base) }];
  for (const layer of included) files.push({ name: `${layer.id}.png`, blob: await png(layer.canvas) });
  return { files, args: studioTimelineArguments(included, duration) };
}
