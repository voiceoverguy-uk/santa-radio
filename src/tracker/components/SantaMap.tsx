"use client";

import { useId, useMemo, useState, useRef, useEffect } from "react";
import { santaStops, getStopArrivalDate } from "@/data/santaRouteStops";
import { getVisitedStops, getCurrentStopId, getRouteResearchCopy, type HolidayDestination, type MapPosition } from "@/lib/santaRoute";
import { worldMapPaths } from "@/data/worldMapPaths";
import { MAP_REGIONS, WORLD, followCamera, positionCamera, project, regionCamera, stopRegion, type Camera } from "./trackerCamera";
import { MAP_PALETTE, mapLandColor } from "./mapPalette";
import "../tracker-journey.css";

interface SantaMapProps {
  effectiveTime: Date;
  mapPosition: MapPosition;
  onHoliday?: boolean;
  researchDestination?: HolidayDestination | null;
}

type View = "follow" | "world" | string;

export default function SantaMap({ effectiveTime, mapPosition, onHoliday, researchDestination }: SantaMapProps) {
  const titleId = useId();
  const descriptionId = useId();
  const mapRef = useRef<HTMLDivElement>(null);
  const [pixelFactor, setPixelFactor] = useState(1);
  useEffect(() => {
    const element = mapRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setPixelFactor(1000 / Math.min(1000, Math.max(280, entry.contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const year = effectiveTime.getUTCFullYear();
  const visited = getVisitedStops(effectiveTime);
  const currentId = getCurrentStopId(effectiveTime);
  const live = !!currentId && !onHoliday && !researchDestination;

  const ordered = useMemo(
    () => [...santaStops].sort((a, b) => getStopArrivalDate(a, year).getTime() - getStopArrivalDate(b, year).getTime()),
    [year],
  );
  const currentIdx = ordered.findIndex((s) => s.id === currentId);
  const currentStop = currentIdx >= 0 ? ordered[currentIdx] : undefined;
  const nextStop = live ? ordered[currentIdx + 1] : undefined;

  const [view, setView] = useState<View>("follow");
  const effectiveView = view;

  const projectedSanta = project(mapPosition.lat, mapPosition.lng);
  const wrapPacific = effectiveView === "Pacific" || (
    effectiveView === "follow" &&
    (currentStop ? stopRegion(currentStop) === "Pacific" : projectedSanta.x < 100 || projectedSanta.x > 900)
  );
  const mapProject = (lat: number, lng: number) => {
    const p = project(lat, lng);
    return { x: wrapPacific && p.x < 500 ? p.x + 1000 : p.x, y: p.y };
  };
  const santaXY = mapProject(mapPosition.lat, mapPosition.lng);
  const showSanta = live || mapPosition.y < 95;

  let camera: Camera = WORLD;
  if (effectiveView === "follow" && currentStop) {
    const pts = [santaXY, mapProject(currentStop.lat, currentStop.lng)];
    if (nextStop) pts.push(mapProject(nextStop.lat, nextStop.lng));
    camera = followCamera(stopRegion(currentStop), pts);
  } else if (effectiveView === "follow") {
    camera = positionCamera(santaXY);
  } else if (effectiveView !== "world" && effectiveView !== "follow") {
    camera = regionCamera(effectiveView);
  }
  if (effectiveView === "follow") {
    // Leave room for the full Santa icon even at the South Pole's map edge.
    const margin = 18 * pixelFactor * camera.w / 1000;
    camera = { ...camera, cy: Math.max(camera.cy, santaXY.y - camera.w / 4 + margin) };
  }
  const s = MAP_W_OVER(camera);
  const tx = 500 - camera.cx * s;
  const ty = 250 - camera.cy * s;
  const k = pixelFactor / Math.pow(s, 0.85); // readable pins and labels on phone as well as desktop

  // Route segments, split at the date line instead of crossing the world.
  const visitedOrdered = ordered.filter((st) => visited.has(st.id));
  const segments: string[] = [];
  for (let i = 1; i < visitedOrdered.length; i++) {
    const a = mapProject(visitedOrdered[i - 1].lat, visitedOrdered[i - 1].lng);
    const b = mapProject(visitedOrdered[i].lat, visitedOrdered[i].lng);
    if (Math.abs(b.x - a.x) > 500) {
      const bx = b.x < a.x ? b.x + 1000 : b.x - 1000;
      const minX = wrapPacific ? 500 : 0;
      const edge = bx > a.x ? minX + 1000 : minX;
      const t = (edge - a.x) / (bx - a.x);
      const ey = a.y + (b.y - a.y) * t;
      segments.push(`M${a.x},${a.y}L${edge},${ey}`, `M${2 * minX + 1000 - edge},${ey}L${b.x},${b.y}`);
    } else segments.push(`M${a.x},${a.y}L${b.x},${b.y}`);
  }
  let legPath = "";
  if (live && showSanta && currentStop) {
    const c = mapProject(currentStop.lat, currentStop.lng);
    if (Math.abs(santaXY.x - c.x) < 500) legPath += `M${c.x},${c.y}L${santaXY.x},${santaXY.y}`;
    if (nextStop) {
      const n = mapProject(nextStop.lat, nextStop.lng);
      if (Math.abs(n.x - santaXY.x) < 500) legPath += `M${santaXY.x},${santaXY.y}L${n.x},${n.y}`;
    }
  }

  const labels = [
    currentStop && live ? { stop: currentStop, kind: "Now" } : null,
    nextStop ? { stop: nextStop, kind: "Next" } : null,
  ].filter(Boolean) as { stop: typeof ordered[number]; kind: string }[];

  const regionLabel = effectiveView === "follow"
    ? live && currentStop ? `Following Santa · ${stopRegion(currentStop)}` : "Santa's position"
    : effectiveView === "world" ? `World · ${santaStops.length} stops` : effectiveView;

  return (
    <div ref={mapRef} className="tracker-map relative w-full overflow-hidden rounded-2xl border">
      <div className="relative w-full" style={{ aspectRatio: "2 / 1" }}>
        <svg
          viewBox="0 0 1000 500"
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
        >
          <title id={titleId}>{researchDestination ? `Santa's route research map: ${researchDestination.name}` : onHoliday ? "Santa's holiday location map" : "Santa's estimated journey map"}</title>
          <desc id={descriptionId}>
            {researchDestination
              ? `${getRouteResearchCopy(researchDestination)} The Santa marker shows his research location, not a Christmas Eve delivery stop. Faint dots mark the separate estimated Christmas Eve route.`
              : onHoliday
              ? "The Santa marker shows his current holiday location. Faint dots mark stops on the estimated Christmas Eve route."
              : `The Santa marker shows his estimated position on the world map. Red dots mark visited stops, faint dots mark upcoming stops${currentStop ? `, and a glowing dot marks ${currentStop.displayLabel} as the current stop` : ""}${nextStop ? `. Next stop: ${nextStop.displayLabel}` : ""}.`}
          </desc>
          <defs>
            <radialGradient id="glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.68" />
              <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
            </radialGradient>
            <filter id="pulse-glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <rect width="1000" height="500" fill={MAP_PALETTE.ocean} />

          <g className="tj-camera" data-map-view={effectiveView} data-camera-width={camera.w} style={{ transform: `translate(${tx}px, ${ty}px) scale(${s})` }}>
            <g stroke={MAP_PALETTE.coastline} strokeWidth={0.85 * k} strokeLinejoin="round">
              {worldMapPaths.map((d, i) => (
                <path key={i} d={d} fill={mapLandColor(i)} />
              ))}
              {wrapPacific && <g transform="translate(1000 0)">{worldMapPaths.map((d, i) => <path key={i} d={d} fill={mapLandColor(i)} />)}</g>}
            </g>

            <g opacity="0.42" stroke={MAP_PALETTE.grid} strokeWidth={0.5 * k} fill="none">
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <line key={`h${i}`} x1="0" y1={i * 71.4} x2="1000" y2={i * 71.4} />
              ))}
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
                <line key={`v${i}`} x1={i * 83.3} y1="0" x2={i * 83.3} y2="500" />
              ))}
            </g>

            {segments.length > 0 && (
              <>
                <path d={segments.join("")} fill="none" stroke={MAP_PALETTE.routeOutline} strokeWidth={3.4 * k} strokeDasharray={`${5 * k},${3 * k}`} strokeLinecap="round" />
                <path d={segments.join("")} fill="none" stroke={MAP_PALETTE.route} strokeWidth={1.7 * k} strokeDasharray={`${5 * k},${3 * k}`} strokeLinecap="round" />
              </>
            )}
            {legPath && (
              <>
                <path d={legPath} fill="none" stroke={MAP_PALETTE.routeOutline} strokeWidth={3 * k} strokeDasharray={`${2 * k},${3 * k}`} strokeLinecap="round" />
                <path d={legPath} fill="none" stroke={MAP_PALETTE.currentLeg} strokeWidth={1.3 * k} strokeDasharray={`${2 * k},${3 * k}`} strokeLinecap="round" />
              </>
            )}

            {ordered.map((stop) => {
              const { x: sx, y: sy } = mapProject(stop.lat, stop.lng);
              const isVisited = visited.has(stop.id);
              const isCurrent = stop.id === currentId;
              const isNext = stop.id === nextStop?.id;
              return (
                <g key={stop.id} data-stop-id={stop.id} data-active={isCurrent ? "true" : undefined}>
                  <title>{stop.name}</title>
                  {isCurrent && (
                    <>
                      <circle cx={sx} cy={sy} r={12 * k} fill="url(#glow)">
                        <animate attributeName="opacity" values="0.9;0.3;0.9" dur="2s" repeatCount="indefinite" />
                      </circle>
                      <circle cx={sx} cy={sy} r={4 * k} fill="#FFF8E7" filter="url(#pulse-glow)" />
                    </>
                  )}
                  {isNext && <circle cx={sx} cy={sy} r={3.4 * k} fill="none" stroke={MAP_PALETTE.route} strokeWidth={1.8 * k} />}
                  {isVisited && !isCurrent && <circle className="tj-pin" cx={sx} cy={sy} r={2.2 * k} fill="#b62332" stroke="#e6ce86" strokeWidth={0.5 * k} />}
                  {!isVisited && !isCurrent && !isNext && (
                    <circle className="tj-pin" cx={sx} cy={sy} r={1.8 * k} fill="#17334A55" stroke="#FFF8E7" strokeWidth={0.8 * k} opacity="0.9" />
                  )}
                </g>
              );
            })}

            {labels.map(({ stop, kind }, i) => {
              const p = mapProject(stop.lat, stop.lng);
              const above = i === 0 ? -1 : 1;
              const anchor = p.x > camera.cx + camera.w * 0.3 ? "end" : p.x < camera.cx - camera.w * 0.3 ? "start" : "middle";
              return (
                <text key={kind} x={p.x} y={p.y + above * 12 * k} textAnchor={anchor} dominantBaseline={above < 0 ? "auto" : "hanging"} fontSize={11 * k} strokeWidth={3 * k} className={`tj-label ${kind === "Next" ? "tj-label-next" : ""}`}>
                  {kind} · {stop.displayLabel}
                </text>
              );
            })}

            {showSanta && (
              <g className="tj-santa" style={{ transform: `translate(${santaXY.x}px, ${santaXY.y}px)` }} filter="url(#pulse-glow)">
                <text x="0" y="0" textAnchor="middle" dominantBaseline="central" fontSize={24 * k} className="select-none">
                  🎅
                </text>
              </g>
            )}
          </g>
        </svg>

        {camera.w < 1000 && (
          <svg viewBox="0 0 1000 500" className="tj-minimap" aria-hidden="true">
            <rect width="1000" height="500" fill={MAP_PALETTE.ocean} />
            <g stroke={MAP_PALETTE.coastline} strokeWidth="2" strokeLinejoin="round">
              {worldMapPaths.map((d, i) => <path key={i} d={d} fill={mapLandColor(i)} />)}
            </g>
            {showSanta && <circle cx={project(mapPosition.lat, mapPosition.lng).x} cy={santaXY.y} r="14" fill={MAP_PALETTE.view} />}
            {(wrapPacific ? [-1000, 0] : [0]).map(offset => <rect key={offset} className="tj-view" x={camera.cx - camera.w / 2 + offset} y={camera.cy - camera.w / 4} width={camera.w} height={camera.w / 2} fill="#FFD36F25" stroke={MAP_PALETTE.view} strokeWidth="8" />)}
          </svg>
        )}

        <div className="tracker-map-caption absolute bottom-3 left-3 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs">
          {effectiveView !== "world" && effectiveView !== "follow"
            ? `${effectiveView} · estimated delivery destinations`
            : researchDestination
            ? `Route research in ${researchDestination.name}`
            : onHoliday
            ? "Santa's current holiday location"
            : effectiveView === "follow" && !live
            ? "Santa's represented position · estimated route"
            : "Estimated route based on local midnight across time zones"}
        </div>
      </div>

      <div className="tj-toolbar" role="toolbar" aria-label="Map camera">
        <button type="button" className="tj-btn" aria-pressed={effectiveView === "world"} onClick={() => setView("world")}>World</button>
        <button
          type="button"
          className="tj-btn"
          aria-pressed={effectiveView === "follow"}
          onClick={() => setView("follow")}
          title={live ? "Follow Santa between stops" : "Centre the map on Santa's represented position; this is not live delivery tracking"}
        >
          Follow Santa
        </button>
        <label className="sr-only" htmlFor={`${titleId}-region`}>Browse a region</label>
        <select
          id={`${titleId}-region`}
          className="tj-select"
          value={effectiveView !== "world" && effectiveView !== "follow" ? effectiveView : ""}
          onChange={(e) => setView(e.target.value || "world")}
        >
          <option value="">Browse region…</option>
          {MAP_REGIONS.map((r) => {
            const n = santaStops.filter((st) => stopRegion(st) === r.name).length;
            return <option key={r.name} value={r.name}>{r.name} ({n})</option>;
          })}
        </select>
        {live ? <span className="tj-live"><span className="tj-live-dot" />Estimated live</span> : null}
        <span className="tj-legend" aria-live="polite">
          <span><i style={{ background: "#b62332" }} />Visited</span>
          <span><i style={{ background: "#FFF8E7" }} />Now</span>
          <span><i style={{ border: "1px solid #bcc9bd" }} />Upcoming</span>
          <span style={{ color: "#e6ce86" }}>{regionLabel}</span>
        </span>
      </div>
      <p className="tj-source">Fictional estimated itinerary · Local clocks use IANA time zones · Coordinates: <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames (CC BY)</a></p>
    </div>
  );
}

function MAP_W_OVER(c: Camera) {
  return 1000 / c.w;
}
