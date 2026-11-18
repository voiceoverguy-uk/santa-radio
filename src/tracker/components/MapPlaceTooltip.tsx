import { useCallback, useId, useRef, useState } from "react";
import type { SantaStop } from "../data/santaRouteStops";

interface PlaceLabel {
  stop: SantaStop;
  left: number;
  top: number;
  width: number;
  below: boolean;
}

export function useMapPlaceTooltip() {
  const containerRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const [place, setPlace] = useState<PlaceLabel | null>(null);
  const hide = useCallback(() => setPlace(null), []);
  const show = useCallback((stop: SantaStop, element: Element) => {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const marker = element.getBoundingClientRect();
    const width = Math.min(260, bounds.width - 24);
    const center = marker.left + marker.width / 2 - bounds.left;
    const below = marker.top - bounds.top < 90;
    setPlace({
      stop,
      width,
      below,
      left: Math.min(Math.max(center, width / 2 + 12), bounds.width - width / 2 - 12),
      top: below ? marker.bottom - bounds.top + 10 : marker.top - bounds.top - 10,
    });
  }, []);
  return { containerRef, id, place, show, hide };
}

export default function MapPlaceTooltip({ tooltip }: { tooltip: ReturnType<typeof useMapPlaceTooltip> }) {
  const place = tooltip.place;
  if (!place) return null;
  return (
    <div id={tooltip.id} role="tooltip" className="tj-place-tooltip"
      style={{ left: place.left, top: place.top, width: place.width,
        transform: place.below ? "translateX(-50%)" : "translate(-50%, -100%)" }}>
      <div className="tj-place-tooltip-name"><span aria-hidden="true">{place.stop.flag}</span><strong>{place.stop.name}</strong></div>
      <div className="tj-place-tooltip-region">{place.stop.region}</div>
    </div>
  );
}
