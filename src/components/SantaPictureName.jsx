import { useEffect, useState } from 'react';

// Coordinates in the original 1536 × 1024 artwork. These rectangles sit below
// the printed headings and between the hands, not at the parchment's outer edge.
const frames = {
  '/images/santa-nice-list.jpg': { x: 822, y: 502, width: 507, height: 307 },
  '/images/santa-nice-list-2.jpg': { x: 829, y: 440, width: 538, height: 359 },
  '/images/santa-nice-list-3.jpg': { x: 822, y: 471, width: 491, height: 328 },
};
const preferredSize = 153.6; // Original 10cqw, in artwork coordinates.

export default function SantaPictureName({ name, picture, children }) {
  const frame = frames[picture];
  const [measured, setMeasured] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const measure = async () => {
      // Never display a fallback-font measurement, even with font-display: swap.
      const fonts = await document.fonts.load('1000px "Great Vibes"', name);
      if (cancelled || !fonts.length) return;
      const context = document.createElement('canvas').getContext('2d');
      context.font = '1000px "Great Vibes"';
      const ink = context.measureText(name);
      const width = ink.actualBoundingBoxLeft + ink.actualBoundingBoxRight;
      const height = ink.actualBoundingBoxAscent + ink.actualBoundingBoxDescent;
      if (!(width > 0 && height > 0)) return;
      // Reserve 2% for rasterisation/rounding at small display sizes. Fit ink,
      // not advance width: swashes can extend beyond either side of the text.
      const size = Math.min(preferredSize,
        frame.width * .98 / width * 1000, frame.height * .98 / height * 1000);
      const scale = size / 1000;
      setMeasured({ name, picture, size,
        x: (frame.width - width * scale) / 2 + ink.actualBoundingBoxLeft * scale,
        y: (frame.height - height * scale) / 2 + ink.actualBoundingBoxAscent * scale });
    };
    measure();
    document.fonts.addEventListener('loadingdone', measure);
    return () => {
      cancelled = true;
      document.fonts.removeEventListener('loadingdone', measure);
    };
  }, [name, picture, frame]);

  const fit = measured?.name === name && measured?.picture === picture ? measured : null;
  return <span aria-hidden="true" className="studio-santa-picture__name"
    data-fitted={Boolean(fit)} style={{
      left: `${frame.x / 1536 * 100}%`, top: `${frame.y / 1024 * 100}%`,
      width: `${frame.width / 1536 * 100}%`, height: `${frame.height / 1024 * 100}%`,
      fontSize: `${(fit?.size || preferredSize) / 1536 * 100}cqw`,
      visibility: fit ? undefined : 'hidden',
    }}>
    {children(<svg viewBox={`0 0 ${frame.width} ${frame.height}`} aria-hidden="true">
      {/* A shared artwork coordinate system scales uniformly on every resize;
          no textLength, clipping, line wrapping or horizontal compression. */}
      <text x={fit?.x || 0} y={fit?.y || 0} fontSize={fit?.size || preferredSize}>{name}</text>
    </svg>)}
  </span>;
}
