"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import HomepageSectionHeading from "../../components/HomepageSectionHeading.jsx";
import trackerLogo from "../../assets/home/santa-tracker-logo.webp";
import { getCurrentStopId, getInterpolatedMapPosition, getJourneySleighDirection, getDashboardData, isHolidaySeason, isRouteResearchSeason, isDecemberVisitSeason, getRandomDecemberTrackerVisit, getRouteResearchCopy, isChristmasInJuly, getRandomHoliday, type DecemberTrackerVisit, type HolidayDestination } from "@/lib/santaRoute";
import { getJumpTime } from "../lib/santaPreview";
import { worldMapPaths } from "@/data/worldMapPaths";
import itinerary from "../data/santaItinerary.json";
import { santaStops, getStopArrivalDate } from "@/data/santaRouteStops";
import { MAP_PALETTE, mapLandColor } from "./mapPalette";
import { getSantaMarkerArtwork } from "../lib/santaMarker";
import SantaMarker from "./SantaMarker";
import { getNightOverlayPath, getSolarPosition } from "./solarLighting";

export default function SantaTrackerBanner() {
  const [now, setNow] = useState<Date | null>(null);
  const [holiday, setHoliday] = useState<HolidayDestination | null>(null);
  const [decemberVisit, setDecemberVisit] = useState<DecemberTrackerVisit | null>(null);
  const decemberVisitRef = useRef<DecemberTrackerVisit | null>(null);
  const holidaySeason = now !== null && isHolidaySeason(now);
  const decemberVisitSeason = now !== null && isDecemberVisitSeason(now);
  const travellingSeason = holidaySeason || (now !== null && isRouteResearchSeason(now)) || decemberVisitSeason;

  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!now) return;
    setHoliday(travellingSeason ? previous => previous ?? getRandomHoliday() : null);
  }, [travellingSeason]);

  useEffect(() => {
    if (!now) return;
    if (isDecemberVisitSeason(now)) {
      if (decemberVisitRef.current === null) {
        const visit = getRandomDecemberTrackerVisit();
        decemberVisitRef.current = visit;
        setDecemberVisit(visit);
      }
    } else if (decemberVisitRef.current !== null) {
      decemberVisitRef.current = null;
      setDecemberVisit(null);
    }
  }, [now]);

  if (!now) {
    return (
      <section className="tracker-banner relative overflow-hidden" aria-label="Santa Tracker">
        <div className="absolute inset-0 star-field opacity-60" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <TrackerBannerHeading />
        </div>
      </section>
    );
  }

  const data = getDashboardData(now);
  const isLive = data.mode === "LIVE";
  const isComplete = data.mode === "COMPLETE";
  const northPoleVisit = decemberVisitSeason && decemberVisit?.kind === "NORTH_POLE";
  const decemberResearching = decemberVisitSeason && decemberVisit?.kind === "ROUTE_RESEARCH";
  const onHoliday = !decemberVisitSeason && data.mode === "OFF_SEASON" && holidaySeason && holiday !== null;
  const researching = decemberVisitSeason ? decemberResearching : data.mode === "ROUTE_RESEARCH";
  const inJuly = data.mode === "OFF_SEASON" && isChristmasInJuly(now);

  if (northPoleVisit && decemberVisit?.kind === "NORTH_POLE") {
    data.statusHeadline = "Back at the North Pole";
    data.statusSubtext = decemberVisit.message;
    data.currentStopName = "North Pole";
    data.currentStopFlag = "🎅";
    data.currentStopRegion = "Arctic";
  }
  if (researching && holiday) {
    data.statusHeadline = `Prepping the route in ${holiday.name}`;
    data.statusSubtext = getRouteResearchCopy(holiday);
    data.currentStopName = holiday.name;
    data.currentStopFlag = "🧭";
    data.currentStopRegion = holiday.country;
    const x = ((holiday.lng + 180) / 360) * 100;
    const y = ((90 - holiday.lat) / 180) * 100;
    data.mapPosition = { lat: holiday.lat, lng: holiday.lng, x, y };
  }

  const statusLabel = isLive
    ? data.state === "UK_SPECIAL_WINDOW"
      ? data.approachingUK ? "🇬🇧 Approaching the UK!" : "🇬🇧 Delivering in the UK Now!"
      : `Delivering in ${data.currentStopRegion}`
    : isComplete
    ? "Journey Complete"
    : northPoleVisit
    ? "At the North Pole with Head Elf"
    : researching
    ? holiday ? `Prepping the route in ${holiday.name}` : "Prepping the route"
    : data.mode === "PREPARING"
    ? "Final Preparations Underway"
    : onHoliday && inJuly && holiday
    ? `🎄 Christmas in July — ${holiday.name}`
    : onHoliday && holiday
    ? `🏖️ On Holiday in ${holiday.name}`
    : "At the North Pole";

  const dotColor = isLive
    ? data.state === "UK_SPECIAL_WINDOW"
      ? "bg-santa-red animate-pulse"
      : "bg-green-400 animate-pulse"
    : isComplete
    ? "bg-santa-gold"
    : onHoliday && inJuly
    ? "bg-green-400"
    : onHoliday
    ? "bg-santa-gold"
    : "bg-green-400";

  const statusBadge = (
    <div className="tracker-status inline-flex items-center gap-2 rounded-full px-3 py-1.5">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
      <span className="text-xs font-medium text-gray-200 uppercase tracking-wider">
        {statusLabel}
      </span>
    </div>
  );

  return (
    <section className="tracker-banner relative overflow-hidden" aria-label="Santa Tracker">
      <div className="absolute inset-0 star-field opacity-60" />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <TrackerBannerHeading />
        <div className={`${!isLive && !isComplete ? "tracker-banner-map-layout " : ""}tracker-banner-content flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-8`}>

          <div className="tracker-banner-copy flex-1 text-center lg:text-left lg:max-w-lg">
            <Link to="/santa-tracker" className="tracker-banner-logo-link" aria-label="Open the Santa Tracker">
            <img
              className="tracker-banner-logo"
              src={trackerLogo}
              alt="Santa Tracker — Santa Radio"
              width={980}
              height={560}
              loading="lazy"
              decoding="async"
            />
            </Link>
            {(isLive || isComplete) && <div className="mb-4">{statusBadge}</div>}

            <p className="mt-3 text-gray-300 text-sm sm:text-base leading-relaxed max-w-lg mx-auto lg:mx-0">
              {isLive
                ? `Follow Santa's estimated ${santaStops.length}-stop Christmas Eve journey, from Kiritimati to Honolulu, Hawaii, including Antarctic research stations. The estimated journey finishes at 11:20 UTC on Christmas Day.`
                : isComplete
                ? `Santa's estimated ${santaStops.length}-stop journey is complete! The final stop in Honolulu finished at 11:20 UTC on Christmas Day. Explore the route and festive facts.`
                : northPoleVisit
                ? data.statusSubtext
                : researching
                ? holiday ? `Santa’s on a quick research trip to ${holiday.name}, scouting the Christmas Eve route before returning to the North Pole.` : data.statusSubtext
                : data.mode === "PREPARING"
                ? "Santa's back at the North Pole, checking the sleigh and gifts before his Christmas Eve departure."
                : onHoliday && inJuly && holiday
                ? `It's Christmas in July! Santa's celebrating mid-year festivities while ${holiday.activity.charAt(0).toLowerCase()}${holiday.activity.slice(1)}. Only ${Math.ceil((new Date(now.getFullYear(), 11, 25).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))} days until the real thing!`
                : onHoliday && holiday
                ? `Santa's on holiday! He's currently ${holiday.activity.charAt(0).toLowerCase()}${holiday.activity.slice(1)}. Route-research trips begin on 10 November.`
                : "Follow Santa's Christmas Eve journey in real time. Live route updates, fun facts, a countdown, and the full itinerary."}
            </p>


          </div>

          <div className="tracker-banner-visual flex-shrink-0 w-full lg:w-auto">
            {isLive || isComplete ? (
              <LiveStats data={data} />
            ) : (
              <div className="tracker-banner-map-group">
                <MiniMap time={now} holiday={onHoliday || researching ? holiday : null} researching={researching} northPoleVisitMessage={northPoleVisit ? data.statusSubtext : undefined} />
                {statusBadge}
              </div>
            )}
          </div>

        </div>
      </div>
    </section>
  );
}

function TrackerBannerHeading() {
  return (
    <HomepageSectionHeading
      eyebrow="THE ENTIRE JOURNEY"
      title="THE SANTA TRACKER"
      subtitle="Follow Santa not just at Christmas, but the whole year!"
      supportingLine=""
      titleId="tracker-banner-title"
      className="tracker-banner-heading"
      eyebrowClassName="tracker-banner-eyebrow"
      titleClassName="tracker-banner-title"
      subtitleClassName="tracker-banner-tagline"
    />
  );
}

function LiveStats({ data }: { data: ReturnType<typeof getDashboardData> }) {
  const stats = [
    { label: "Journey Progress", value: `${data.progressPercent.toFixed(1)}%` },
    { label: "Regions Visited", value: `${data.visitedCount} / ${data.totalStops}` },
    {
      label: "Gifts Delivered",
      value:
        data.estimatedGifts >= 1_000_000_000
          ? `${(data.estimatedGifts / 1_000_000_000).toFixed(1)}B`
          : `${(data.estimatedGifts / 1_000_000).toFixed(0)}M`,
    },
    { label: "Current Location", value: `${data.currentStopFlag} ${data.currentStopName}` },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 w-full lg:w-64">
      {stats.map((s) => (
        <div
          key={s.label}
          className="tracker-card p-3 text-center"
        >
          <div className="text-santa-cream font-medium text-sm sm:text-base tabular-nums break-words">
            {s.value}
          </div>
          <div className="text-santa-gold/75 text-[10px] uppercase tracking-wider mt-0.5">
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}

function MiniMap({ time, holiday, researching = false, northPoleVisitMessage }: { time: Date; holiday: HolidayDestination | null; researching?: boolean; northPoleVisitMessage?: string }) {
  const mapRef = useRef<HTMLAnchorElement>(null);
  const lastPreviewCity = useRef<string | null>(null);
  const [previewTime, setPreviewTime] = useState<Date | null>(null);
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    const stop = () => {
      clearInterval(timer);
      timer = undefined;
      setPreviewTime(null);
    };
    const start = () => {
      stop();
      if (!visible || document.hidden || motion.matches) return;
      const began = performance.now();
      // Local display clock only: never activate or save the private preview.
      const cities = ['berlin', 'tokyo', 'sydney', 'dubai', 'riodejaneiro', 'newyork'];
      let cycle = -1;
      let routeStart = 0;
      timer = setInterval(() => {
        const elapsed = performance.now() - began;
        // Fifteen-second glimpses, separated by 35 seconds of current status.
        const phase = (elapsed - 8000) % 50000;
        const nextCycle = Math.floor((elapsed - 8000) / 50000);
        if (elapsed >= 8000 && nextCycle !== cycle) {
          cycle = nextCycle;
          const choices = cities.filter(city => city !== lastPreviewCity.current);
          const city = choices[Math.floor(Math.random() * choices.length)];
          lastPreviewCity.current = city;
          routeStart = getJumpTime(`city:${city}`).getTime() - 60_000;
        }
        setPreviewTime(elapsed >= 8000 && phase < 15000
          ? new Date(routeStart + phase * 60) : null);
      }, 50);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      start();
    }, { threshold: 0.5 });
    if (mapRef.current) observer.observe(mapRef.current);
    document.addEventListener('visibilitychange', start);
    motion.addEventListener('change', start);
    return () => {
      clearInterval(timer);
      observer.disconnect();
      document.removeEventListener('visibilitychange', start);
      motion.removeEventListener('change', start);
    };
  }, []);
  const previewPosition = previewTime ? getInterpolatedMapPosition(previewTime) : null;
  const mapTime = previewTime ?? time;
  const solarMinute = Math.floor(mapTime.getTime() / 60_000);
  const solarTime = new Date(solarMinute * 60_000);
  const nightPath = useMemo(() => getNightOverlayPath(solarTime), [solarMinute]);
  const solarPosition = useMemo(() => getSolarPosition(solarTime), [solarMinute]);
  const artwork = previewTime && previewPosition
    ? getSantaMarkerArtwork("LIVE", previewPosition.lng, getJourneySleighDirection(previewTime))
    : holiday ? getSantaMarkerArtwork(researching ? "ROUTE_RESEARCH" : "OFF_SEASON", holiday.lng) : null;
  const santaX = previewPosition ? previewPosition.x * 10 : holiday
    ? ((holiday.lng + 180) / 360) * 1000
    : ((0 + 180) / 360) * 1000;
  const santaY = previewPosition ? previewPosition.y * 5 : holiday
    ? ((90 - holiday.lat) / 180) * 500
    : ((90 - 90) / 180) * 500;

  const previewSecond = previewTime ? Math.floor(previewTime.getTime() / 1000) : null;
  const previewLabel = useMemo(() => {
    if (previewSecond === null) return '';
    const date = new Date(previewSecond * 1000);
    const dashboard = getDashboardData(date);
    const schedule = [...santaStops].sort((a, b) => getStopArrivalDate(a, date.getUTCFullYear()).getTime() - getStopArrivalDate(b, date.getUTCFullYear()).getTime());
    const currentId = getCurrentStopId(date);
    const index = schedule.findIndex(stop => stop.id === currentId);
    const from = itinerary.find(stop => stop.id === schedule[index]?.id)?.country;
    const to = itinerary.find(stop => stop.id === schedule[index + 1]?.id)?.country;
    const countries = from === to ? from : [from, to].filter(Boolean).join(' → ');
    return `${countries ?? dashboard.currentStopRegion} · ${dashboard.currentStopName}`;
  }, [previewSecond]);
  const caption = previewTime ? `Christmas Eve sneak peek · ×60 simulation · ${previewLabel}` : researching && holiday
    ? `Santa's route research location: ${holiday.name}`
    : holiday
    ? `Santa's holiday location`
    : northPoleVisitMessage
    ? "Santa is helping Head Elf at the North Pole"
    : "Santa's at the North Pole";

  return (
    <Link
      ref={mapRef}
      data-sneak-peek={previewTime ? "true" : "false"}
      to="/santa-tracker"
      aria-label={`Open the Santa Tracker: ${caption}${researching && holiday ? `. ${getRouteResearchCopy(holiday)} Research locations are separate from Christmas Eve delivery stops.` : northPoleVisitMessage ? `. ${northPoleVisitMessage}` : ""}`}
      className="tracker-map tracker-banner-map block w-full rounded-lg border overflow-hidden"
    >
      <svg
        viewBox={previewTime ? `${santaX - 100} ${santaY - 50} 200 100` : artwork ? "-84 -42 1168 584" : "0 0 1000 500"}
        className="w-full"
        style={{ aspectRatio: "2 / 1" }}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <rect width="1000" height="500" fill={MAP_PALETTE.ocean} />
        <g stroke={MAP_PALETTE.coastline} strokeWidth={previewTime ? "0.25" : "0.85"} strokeLinejoin="round">
          {worldMapPaths.map((d, i) => (
            <path key={i} d={d} fill={mapLandColor(i)} />
          ))}
        </g>
        <path
          data-night-overlay=""
          data-solar-time={mapTime.toISOString()}
          data-declination={solarPosition.declinationDeg.toFixed(3)}
          data-subsolar-longitude={solarPosition.subsolarLongitudeDeg.toFixed(3)}
          d={nightPath}
          fill="#081e17"
          fillOpacity="0.25"
          pointerEvents="none"
        />
        <g data-route-stops="">
          {santaStops.map((stop) => (
            <circle
              key={stop.id}
              data-stop-id={stop.id}
              cx={((stop.lng + 180) / 360) * 1000}
              cy={((90 - stop.lat) / 180) * 500}
              r={previewTime ? "0.7" : "2.5"}
              fill="none"
              stroke="#bcc9bd"
              strokeWidth={previewTime ? "0.35" : "1.2"}
              opacity="0.8"
            />
          ))}
        </g>
        {!previewTime && <circle cx={santaX} cy={santaY} r="18" fill="#D4AF37" opacity="0.3">
          <animate attributeName="r" values="12;22;12" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite" />
        </circle>}
        <g data-santa-location="" data-santa-lat={previewPosition?.lat ?? holiday?.lat ?? 90} data-santa-lng={previewPosition?.lng ?? holiday?.lng ?? 0} transform={`translate(${santaX} ${santaY})`}>
        {artwork ? (
          <SantaMarker artwork={artwork} scale={previewTime ? 0.65 : 2} />
        ) : <text
          x={0}
          y={0}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="28"
          className="select-none"
        >
          🎅
        </text>}
        </g>
      </svg>
      <div className="tracker-map-caption px-2 py-1.5 text-[10px] text-center" aria-hidden="true">
        {caption}
      </div>
    </Link>
  );
}
