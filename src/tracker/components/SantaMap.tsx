"use client";

import { useId, useMemo, useState, useRef, useEffect } from "react";
import { createPortal, flushSync } from "react-dom";
import { santaStops, getStopArrivalDate } from "@/data/santaRouteStops";
import { getVisitedStops, getCurrentStopId, getCountdownToStart, getRouteResearchCopy, type HolidayDestination, type MapPosition } from "@/lib/santaRoute";
import { worldMapPaths } from "@/data/worldMapPaths";
import { MAP_REGIONS, WORLD, positionCamera, project, regionCamera, stopRegion, type Camera } from "./trackerCamera";
import { MAP_PALETTE, mapLandColor } from "./mapPalette";
import "../tracker-journey.css";
import { getJourneySleighDirection, getSeasonalTrackerMode } from "../lib/santaRoute";
import { getSantaMarkerArtwork } from "../lib/santaMarker";
import SantaMarker from "./SantaMarker";
import { getNightOverlayPath, getSolarPosition } from "./solarLighting";

interface SantaMapProps {
  effectiveTime: Date;
  mapPosition: MapPosition;
  onHoliday?: boolean;
  researchDestination?: HolidayDestination | null;
  northPoleVisitMessage?: string;
  liveStatusLabel?: string;
  autoCycleView?: boolean;
}

type View = "follow" | "world" | string;

export default function SantaMap({ effectiveTime, mapPosition, onHoliday, researchDestination, northPoleVisitMessage, liveStatusLabel, autoCycleView = false }: SantaMapProps) {
  const titleId = useId();
  const descriptionId = useId();
  const mapRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const fullscreenButtonRef = useRef<HTMLButtonElement>(null);
  const nativeFullscreen = useRef(false);
  const closeExpanded = () => {
    if (document.fullscreenElement === mapRef.current) void document.exitFullscreen().catch(() => {});
    setExpanded(false);
    requestAnimationFrame(() => fullscreenButtonRef.current?.focus());
  };
  const toggleExpanded = () => {
    if (expanded) { closeExpanded(); return; }
    flushSync(() => setExpanded(true));
    const element = mapRef.current;
    if (element?.requestFullscreen) {
      void element.requestFullscreen().then(() => { nativeFullscreen.current = true; }).catch(() => {});
    }
  };
  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    fullscreenButtonRef.current?.focus();
    const onFullscreenChange = () => {
      if (nativeFullscreen.current && !document.fullscreenElement) {
        nativeFullscreen.current = false;
        closeExpanded();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeExpanded(); }
      if (event.key === "Tab") {
        const controls = Array.from(mapRef.current?.querySelectorAll<HTMLElement>('button, select, [tabindex="0"]') || []);
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("keydown", onKeyDown);
      nativeFullscreen.current = false;
    };
  }, [expanded]);
  const santaArtworkTriggerRef = useRef<SVGGElement>(null);
  const artworkViewerRef = useRef<HTMLDivElement>(null);
  const wasArtworkViewerOpen = useRef(false);
  const [artworkViewerOpen, setArtworkViewerOpen] = useState(false);
  const [pixelFactor, setPixelFactor] = useState(1);
  useEffect(() => {
    const element = mapRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setPixelFactor(1000 / Math.min(1000, Math.max(280, entry.contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  }, [expanded]);
  const year = effectiveTime.getUTCFullYear();
  const solarMinute = Math.floor(effectiveTime.getTime() / 60_000);
  const solarTime = new Date(solarMinute * 60_000);
  const nightPath = useMemo(() => getNightOverlayPath(solarTime), [solarMinute]);
  const solarPosition = useMemo(() => getSolarPosition(solarTime), [solarMinute]);
  const visited = getVisitedStops(effectiveTime);
  const currentId = getCurrentStopId(effectiveTime);
  const live = !!currentId && !onHoliday && !researchDestination;
  const mode = getSeasonalTrackerMode(effectiveTime);
  const showDepartureCountdown = mode !== "LIVE" && mode !== "COMPLETE";
  const departureCountdown = showDepartureCountdown ? getCountdownToStart(effectiveTime) : null;
  const artwork = getSantaMarkerArtwork(northPoleVisitMessage ? "OFF_SEASON" : mode, mapPosition.lng, getJourneySleighDirection(effectiveTime));

  useEffect(() => {
    if (!artworkViewerOpen) {
      if (wasArtworkViewerOpen.current) {
        wasArtworkViewerOpen.current = false;
        santaArtworkTriggerRef.current?.focus();
      }
      return;
    }

    wasArtworkViewerOpen.current = true;
    artworkViewerRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setArtworkViewerOpen(false);
      } else if (event.key === "Tab") {
        event.preventDefault();
        artworkViewerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [artworkViewerOpen]);

  useEffect(() => {
    if (artworkViewerOpen && !artwork) setArtworkViewerOpen(false);
  }, [artwork, artworkViewerOpen]);

  const ordered = useMemo(
    () => [...santaStops].sort((a, b) => getStopArrivalDate(a, year).getTime() - getStopArrivalDate(b, year).getTime()),
    [year],
  );
  const currentIdx = ordered.findIndex((s) => s.id === currentId);
  const currentStop = currentIdx >= 0 ? ordered[currentIdx] : undefined;
  const nextStop = live ? ordered[currentIdx + 1] : undefined;

  const [view, setView] = useState<View>("world");
  useEffect(() => {
    if (!autoCycleView) return;
    const timer = window.setInterval(() => {
      setView(current => current === "follow" ? "world" : "follow");
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [autoCycleView]);
  const effectiveView = view;
  const santaArtworkScale = effectiveView === "follow" ? 1.5 : 1;

  const projectedSanta = project(mapPosition.lat, mapPosition.lng);
  const wrapPacific = effectiveView === "Pacific" || (
    effectiveView === "follow" &&
    (projectedSanta.x < 100 || projectedSanta.x > 900)
  );
  const mapProject = (lat: number, lng: number) => {
    const p = project(lat, lng);
    return { x: wrapPacific && p.x < 500 ? p.x + 1000 : p.x, y: p.y };
  };
  const santaXY = mapProject(mapPosition.lat, mapPosition.lng);
  const showSanta = live || mapPosition.y < 95;

  let camera: Camera = WORLD;
  if (effectiveView === "follow") {
    camera = positionCamera(santaXY);
  } else if (effectiveView !== "world" && effectiveView !== "follow") {
    camera = regionCamera(effectiveView);
  }
  if (showSanta && effectiveView !== "follow" && (effectiveView === "world" ||
    (Math.abs(santaXY.x - camera.cx) <= camera.w / 2 && Math.abs(santaXY.y - camera.cy) <= camera.w / 4))) {
    // Only edge clearance changes; the marker stays at its geographic anchor.
    const mx = (((artwork?.width ?? 24) * santaArtworkScale) / 2 + 3) * pixelFactor * camera.w / 1000;
    const my = (((artwork?.height ?? 24) * santaArtworkScale) / 2 + 3) * pixelFactor * camera.w / 1000;
    camera = {
      ...camera,
      cx: Math.max(santaXY.x - camera.w / 2 + mx, Math.min(camera.cx, santaXY.x + camera.w / 2 - mx)),
      cy: Math.max(santaXY.y - camera.w / 4 + my, Math.min(camera.cy, santaXY.y + camera.w / 4 - my)),
    };
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

  const mapContent = (
    <div role={expanded ? "dialog" : undefined} aria-modal={expanded || undefined} aria-label={expanded ? "Full-screen Santa map" : undefined} ref={mapRef} className="tracker-map relative w-full overflow-hidden rounded-2xl border">
      <div className="tj-map-viewport relative w-full" style={{ aspectRatio: "2 / 1" }}>
        {!autoCycleView && <button ref={fullscreenButtonRef} type="button" className="tj-fullscreen-button"
          onClick={toggleExpanded} aria-label={expanded ? "Exit full screen" : "Full screen"} title={expanded ? "Exit full screen" : "Full screen"}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d={expanded ? "M4 9h5V4M20 15h-5v5M9 9 3 3m12 12 6 6" : "M9 3H3v6m12 12h6v-6M3 3l6 6m12 12-6-6"} />
          </svg>
        </button>}
        {expanded && <span className="tj-rotate-hint">Turn your phone sideways for a wider view</span>}
        <svg
          viewBox="0 0 1000 500"
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
        >
          <title id={titleId}>{researchDestination ? `Santa's route research map: ${researchDestination.name}` : northPoleVisitMessage ? "Santa helping Head Elf at the North Pole" : onHoliday ? "Santa's holiday location map" : "Santa's estimated journey map"}</title>
          <desc id={descriptionId}>
            {researchDestination
              ? `${getRouteResearchCopy(researchDestination)} The Santa marker shows his research location, not a Christmas Eve delivery stop. Faint dots mark the separate estimated Christmas Eve route. Subtle shading marks the night side of Earth at ${effectiveTime.toISOString()} UTC.`
              : northPoleVisitMessage
              ? `${northPoleVisitMessage} The Santa marker shows his position at the North Pole. Faint dots mark the separate estimated Christmas Eve route. Subtle shading marks the night side of Earth at ${effectiveTime.toISOString()} UTC.`
              : onHoliday
              ? `The Santa marker shows his current holiday location. Faint dots mark stops on the estimated Christmas Eve route. Subtle shading marks the night side of Earth at ${effectiveTime.toISOString()} UTC.`
              : `The Santa marker shows his estimated position on the world map. Subtle shading marks the night side of Earth at ${effectiveTime.toISOString()} UTC. Red dots mark visited stops, faint dots mark upcoming stops${currentStop ? `, and a glowing dot marks ${currentStop.displayLabel} as the current stop` : ""}${nextStop ? `. Next stop: ${nextStop.displayLabel}` : ""}.`}
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

          <g className="tj-camera" data-map-view={effectiveView} data-camera-width={camera.w} transform={`translate(${tx} ${ty}) scale(${s})`}>
            <g stroke={MAP_PALETTE.coastline} strokeWidth={0.85 * k} strokeLinejoin="round">
              {worldMapPaths.map((d, i) => (
                <path key={i} d={d} fill={mapLandColor(i)} />
              ))}
              {wrapPacific && <g transform="translate(1000 0)">{worldMapPaths.map((d, i) => <path key={i} d={d} fill={mapLandColor(i)} />)}</g>}
            </g>

            <path
              data-night-overlay=""
              data-solar-time={effectiveTime.toISOString()}
              data-declination={solarPosition.declinationDeg.toFixed(3)}
              data-subsolar-longitude={solarPosition.subsolarLongitudeDeg.toFixed(3)}
              d={nightPath}
              fill="#081e17"
              fillOpacity="0.25"
              pointerEvents="none"
            />
            {wrapPacific && (
              <path
                data-night-overlay-duplicate=""
                data-solar-time={effectiveTime.toISOString()}
                d={nightPath}
                transform="translate(1000 0)"
                fill="#081e17"
                fillOpacity="0.25"
                pointerEvents="none"
              />
            )}

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
              // Position updates share the route's SVG coordinates immediately.
              // A separate CSS tween lags behind the route at accelerated speeds.
              <g
                ref={artwork ? santaArtworkTriggerRef : undefined}
                className={`tj-santa${artwork ? " tj-santa-trigger" : ""}`}
                data-santa-lat={mapPosition.lat}
                data-santa-lng={mapPosition.lng}
                transform={`translate(${santaXY.x} ${santaXY.y})`}
                filter={artwork ? undefined : "url(#pulse-glow)"}
                role={artwork ? "button" : undefined}
                tabIndex={artwork ? 0 : undefined}
                aria-label={artwork ? "Enlarge Santa's current artwork" : undefined}
                aria-haspopup={artwork ? "dialog" : undefined}
                onClick={artwork ? () => setArtworkViewerOpen(true) : undefined}
                onKeyDown={artwork ? (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    setArtworkViewerOpen(true);
                  }
                } : undefined}
              >
                {artwork ? <SantaMarker artwork={artwork} scale={pixelFactor / s * santaArtworkScale} /> : <text x="0" y="0" textAnchor="middle" dominantBaseline="central" fontSize={24 * k} className="select-none">
                  🎅
                </text>}
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
            <path
              data-night-overlay=""
              data-solar-time={effectiveTime.toISOString()}
              data-declination={solarPosition.declinationDeg.toFixed(3)}
              data-subsolar-longitude={solarPosition.subsolarLongitudeDeg.toFixed(3)}
              d={nightPath}
              fill="#081e17"
              fillOpacity="0.25"
              pointerEvents="none"
            />
            {showSanta && <circle cx={project(mapPosition.lat, mapPosition.lng).x} cy={santaXY.y} r="14" fill={MAP_PALETTE.view} />}
            {(wrapPacific ? [-1000, 0] : [0]).map(offset => <rect key={offset} className="tj-view" x={camera.cx - camera.w / 2 + offset} y={camera.cy - camera.w / 4} width={camera.w} height={camera.w / 2} fill="#FFD36F25" stroke={MAP_PALETTE.view} strokeWidth="8" />)}
          </svg>
        )}

        <div className="tracker-map-caption absolute bottom-3 left-3 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs">
          {effectiveView !== "world" && effectiveView !== "follow"
            ? `${effectiveView} · estimated delivery destinations`
            : researchDestination
            ? `Route research in ${researchDestination.name}`
            : northPoleVisitMessage
            ? "At the North Pole with Head Elf"
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
        <div className="tj-map-summary">
          {departureCountdown ? (
            <div className="tj-departure" role="group" aria-label="Countdown to Santa's Departure" aria-describedby={`${titleId}-departure-target`} aria-live="off" title="Estimated departure · 24 December, 10:00 UTC">
              <span className="tj-departure-heading">Departure in:</span>
              <span className="tj-departure-target sr-only" id={`${titleId}-departure-target`}>Estimated · 24 December, 10:00 UTC</span>
              <div className="tj-departure-units">
                {[
                  { label: "Days", value: departureCountdown.days },
                  { label: "Hours", value: departureCountdown.hours },
                  { label: "Minutes", value: departureCountdown.minutes },
                ].map(unit => (
                  <span className="tj-departure-unit" key={unit.label}>
                    <span className="tj-departure-value">{String(unit.value).padStart(2, "0")}</span>{' '}
                    <span className="tj-departure-label">{unit.label}</span>
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <span className="tj-legend">
              <span><i style={{ background: "#b62332" }} />Visited</span>
              <span><i style={{ background: "#FFF8E7" }} />Now</span>
              <span><i style={{ border: "1px solid #bcc9bd" }} />Upcoming</span>
            </span>
          )}
          <span className="tj-region-context" aria-live="polite">{regionLabel}</span>
        </div>
      </div>
      {liveStatusLabel && (
        <div className="tracker-map-status">
          <div className="tracker-status inline-flex items-center gap-2 rounded-full px-4 py-1.5" role="status">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-medium uppercase tracking-wider">{liveStatusLabel}</span>
          </div>
        </div>
      )}
      {artworkViewerOpen && artwork && createPortal(
        <div
          ref={artworkViewerRef}
          className="tj-artwork-viewer"
          role="dialog"
          aria-modal="true"
          aria-label="Enlarged Santa artwork. Tap or click anywhere, or press Escape, to close."
          tabIndex={-1}
          onClick={() => setArtworkViewerOpen(false)}
        >
          <img
            data-santa-artwork-enlarged=""
            data-mirrored={String(artwork.mirrored)}
            src={artwork.src}
            alt="Santa's current seasonal artwork"
            draggable={false}
            style={{ width: `min(47vw, ${47 * artwork.width / artwork.height}dvh)` }}
          />
        </div>,
        expanded && mapRef.current ? mapRef.current : document.body,
      )}
    </div>
  );
  return expanded ? createPortal(<div className="santa-tracker tracker-fullscreen">{mapContent}</div>, document.body) : mapContent;
}

function MAP_W_OVER(c: Camera) {
  return 1000 / c.w;
}
