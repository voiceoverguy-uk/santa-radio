import { useEffect, useState } from 'react';
import { santaPictureFrames as frames, santaPicturePreferredSize as preferredSize,
  fitSantaPictureName } from '../lib/santaPictureLayout.js';


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
      setMeasured({ name, picture, ...fitSantaPictureName(context, name, picture) });
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
