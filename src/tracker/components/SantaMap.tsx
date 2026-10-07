"use client";

import { useId } from "react";
import { santaStops } from "@/data/santaRouteStops";
import { getVisitedStops, getCurrentStopId, type MapPosition } from "@/lib/santaRoute";
import { worldMapPaths } from "@/data/worldMapPaths";

interface SantaMapProps {
  effectiveTime: Date;
  mapPosition: MapPosition;
  onHoliday?: boolean;
}

export default function SantaMap({ effectiveTime, mapPosition, onHoliday }: SantaMapProps) {
  const titleId = useId();
  const descriptionId = useId();
  const visited = getVisitedStops(effectiveTime);
  const currentId = getCurrentStopId(effectiveTime);
  const currentStop = santaStops.find((stop) => stop.id === currentId);

  const visitedStops = santaStops.filter((s) => visited.has(s.id));
  const pathPoints = visitedStops.map((s) => ({
    x: ((s.lng + 180) / 360) * 100,
    y: ((90 - s.lat) / 180) * 100,
  }));

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0a1628]">
      <div className="relative w-full" style={{ aspectRatio: "2 / 1" }}>
        <svg
          viewBox="0 0 1000 500"
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
        >
          <title id={titleId}>{onHoliday ? "Santa's holiday location map" : "Santa's estimated journey map"}</title>
          <desc id={descriptionId}>
            {onHoliday
              ? "The Santa marker shows his current holiday location. Faint dots mark stops on the estimated Christmas Eve route."
              : `The Santa marker shows his estimated position on the world map. Red dots mark visited stops, faint dots mark upcoming stops${currentStop ? `, and a glowing dot marks ${currentStop.displayLabel} as the current stop` : ""}.`}
          </desc>
          <defs>
            <radialGradient id="glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#9C060B" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#9C060B" stopOpacity="0" />
            </radialGradient>
            <filter id="pulse-glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <rect width="1000" height="500" fill="transparent" />

          <g opacity="0.15" stroke="#4a6fa5" strokeWidth="0.5" fill="none">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <line key={`h${i}`} x1="0" y1={i * 71.4} x2="1000" y2={i * 71.4} />
            ))}
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
              <line key={`v${i}`} x1={i * 83.3} y1="0" x2={i * 83.3} y2="500" />
            ))}
          </g>

          <ContinentPaths />

          {pathPoints.length > 1 && (
            <polyline
              points={pathPoints.map((p) => `${p.x * 10},${p.y * 5}`).join(" ")}
              fill="none"
              stroke="#9C060B"
              strokeWidth="2"
              strokeDasharray="6,3"
              opacity="0.5"
            />
          )}

          {santaStops.map((stop) => {
            const sx = ((stop.lng + 180) / 360) * 1000;
            const sy = ((90 - stop.lat) / 180) * 500;
            const isVisited = visited.has(stop.id);
            const isCurrent = stop.id === currentId;

            return (
              <g key={stop.id}>
                {isCurrent && (
                  <>
                    <circle cx={sx} cy={sy} r="12" fill="url(#glow)">
                      <animate
                        attributeName="r"
                        values="8;16;8"
                        dur="2s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        values="0.8;0.3;0.8"
                        dur="2s"
                        repeatCount="indefinite"
                      />
                    </circle>
                    <circle cx={sx} cy={sy} r="4" fill="#9C060B" filter="url(#pulse-glow)" />
                  </>
                )}
                {isVisited && !isCurrent && (
                  <circle cx={sx} cy={sy} r="3" fill="#9C060B" opacity="0.7" />
                )}
                {!isVisited && !isCurrent && (
                  <circle cx={sx} cy={sy} r="2.5" fill="white" opacity="0.2" />
                )}
              </g>
            );
          })}

          {mapPosition.y < 95 && (
            <g
              transform={`translate(${mapPosition.x * 10}, ${mapPosition.y * 5})`}
              filter="url(#pulse-glow)"
            >
              <text
                x="0"
                y="0"
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="24"
                className="select-none"
              >
                🎅
              </text>
            </g>
          )}
        </svg>
      </div>

      <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs text-gray-400">
        {onHoliday ? "Santa's current holiday location" : "Estimated route based on local midnight across time zones"}
      </div>
    </div>
  );
}

function ContinentPaths() {
  return (
    <g fill="#1e3a5f" stroke="#2a4d6e" strokeWidth="0.5" opacity="0.6">
      {worldMapPaths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </g>
  );
}
