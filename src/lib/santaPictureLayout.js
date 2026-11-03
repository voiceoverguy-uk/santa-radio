import { recipientCanvasFont, recipientDisplayName } from './giftFonts.js';

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
  context.font = recipientCanvasFont(1000);
  context.fontKerning = 'none';
  const ink = context.measureText(recipientDisplayName(name));
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

export function fitCertificatePreviewName(context, name) {
  context.font = recipientCanvasFont(1000);
  context.fontKerning = 'none';
  const ink = context.measureText(recipientDisplayName(name));
  const width = ink.actualBoundingBoxLeft + ink.actualBoundingBoxRight;
  const height = ink.actualBoundingBoxAscent + ink.actualBoundingBoxDescent;
  if (!(width > 0 && height > 0)) throw new Error('Cannot measure written name');
  // Same millimetre region and baseline as the PDF: 38–259 x 77–101.
  const size = Math.min(22.6, 221 / width * 1000, 24 / height * 1000);
  const scale = size / 1000;
  return { size,
    x: 148.5 - (ink.actualBoundingBoxRight - ink.actualBoundingBoxLeft) * scale / 2,
    y: Math.min(101 - ink.actualBoundingBoxDescent * scale,
      Math.max(96, 77 + ink.actualBoundingBoxAscent * scale)) };
}
