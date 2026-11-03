import useGiftNameFit from './useGiftNameFit.js';
import { recipientDisplayName } from '../lib/giftFonts.js';
import { santaPictureFrames as frames, santaPicturePreferredSize as preferredSize,
  fitSantaPictureName } from '../lib/santaPictureLayout.js';


export default function SantaPictureName({ name, picture, children }) {
  const frame = frames[picture];
  const fit = useGiftNameFit(name, picture, fitSantaPictureName);
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
      <text x={fit?.x || 0} y={fit?.y || 0} fontSize={fit?.size || preferredSize}>{recipientDisplayName(name)}</text>
    </svg>)}
  </span>;
}
