import useGiftNameFit from './useGiftNameFit.js';
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
      {/* Preview and PNG use the same measured lines and artwork coordinates. */}
      <text fontSize={fit?.size || preferredSize}>{fit?.lines.map((line, index) =>
        <tspan key={index} x={line.x} y={line.y}>{line.text}{index < fit.lines.length - 1 ? ' ' : ''}</tspan>)}</text>
    </svg>)}
  </span>;
}
