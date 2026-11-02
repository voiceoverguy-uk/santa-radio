// One artwork coordinate system for the review and full-resolution download.
export const santaPictureFrames = {
  '/images/santa-nice-list.jpg': { x: 822, y: 502, width: 507, height: 307 },
  '/images/santa-nice-list-2.jpg': { x: 829, y: 440, width: 538, height: 359 },
  '/images/santa-nice-list-3.jpg': { x: 822, y: 471, width: 491, height: 328 },
};
export const santaPicturePreferredSize = 153.6;

export function fitSantaPictureName(context, name, picture) {
  const frame = santaPictureFrames[picture];
  if (!frame) throw new Error('Unknown Santa artwork');
  context.font = '1000px "Great Vibes"';
  const ink = context.measureText(name);
  const width = ink.actualBoundingBoxLeft + ink.actualBoundingBoxRight;
  const height = ink.actualBoundingBoxAscent + ink.actualBoundingBoxDescent;
  if (!(width > 0 && height > 0)) throw new Error('Cannot measure written name');
  const size = Math.min(santaPicturePreferredSize,
    frame.width * .98 / width * 1000, frame.height * .98 / height * 1000);
  const scale = size / 1000;
  return { size,
    x: (frame.width - width * scale) / 2 + ink.actualBoundingBoxLeft * scale,
    y: (frame.height - height * scale) / 2 + ink.actualBoundingBoxAscent * scale };
}
