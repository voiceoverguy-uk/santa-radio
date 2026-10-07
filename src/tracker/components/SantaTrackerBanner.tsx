"use client";

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getDashboardData, getCountdownToStart, isHolidaySeason, isChristmasInJuly, getRandomHoliday, type HolidayDestination } from "@/lib/santaRoute";
import { worldMapPaths } from "@/data/worldMapPaths";

export default function SantaTrackerBanner() {
  const [now, setNow] = useState<Date | null>(null);
  const [holiday, setHoliday] = useState<HolidayDestination | null>(null);

  useEffect(() => {
    setNow(new Date());
    if (isHolidaySeason(new Date())) {
      setHoliday(getRandomHoliday());
    }
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!now) {
    return (
      <section className="tracker-banner relative overflow-hidden" aria-label="Santa Tracker">
        <div className="absolute inset-0 star-field opacity-60" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight">
              Track Santa&apos;s Journey
              <br />
              <span className="text-santa-gold">Around the World</span>
            </h2>
          </div>
        </div>
      </section>
    );
  }

  const data = getDashboardData(now);
  const countdown = getCountdownToStart(now);
  const isLive = data.mode === "LIVE";
  const isComplete = data.mode === "COMPLETE";
  const onHoliday = data.mode === "OFF_SEASON" && holiday !== null;
  const inJuly = data.mode === "OFF_SEASON" && isChristmasInJuly(now);

  const statusLabel = isLive
    ? data.state === "UK_SPECIAL_WINDOW"
      ? "🇬🇧 Delivering in the UK Now!"
      : `Delivering in ${data.currentStopRegion}`
    : isComplete
    ? "Journey Complete"
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

  return (
    <section className="tracker-banner relative overflow-hidden" aria-label="Santa Tracker">
      <div className="absolute inset-0 star-field opacity-60" />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-8">

          <div className="flex-1 text-center lg:text-left lg:max-w-lg">
            <div className="tracker-status inline-flex items-center gap-2 rounded-full px-3 py-1.5 mb-4">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
              <span className="text-xs font-medium text-gray-200 uppercase tracking-wider">
                {statusLabel}
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight">
              Track Santa&apos;s Journey
              <br />
              <span className="text-santa-gold">Around the World</span>
            </h2>

            <p className="mt-3 text-gray-300 text-sm sm:text-base leading-relaxed max-w-lg mx-auto lg:mx-0">
              {isLive
                ? `Santa is live! Follow his Christmas Eve journey in real time. From the Pacific Islands to Hawaii, watch as he delivers gifts to ${(data.estimatedGifts / 1_000_000).toFixed(0)}M+ children.`
                : isComplete
                ? "Santa's journey is complete! Relive the route and explore fun facts from every region he visited."
                : onHoliday && inJuly && holiday
                ? `It's Christmas in July! Santa's celebrating mid-year festivities while ${holiday.activity.charAt(0).toLowerCase()}${holiday.activity.slice(1)}. Only ${Math.ceil((new Date(now.getFullYear(), 11, 25).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))} days until the real thing!`
                : onHoliday && holiday
                ? `Santa's taking a well-earned break! He's currently ${holiday.activity.charAt(0).toLowerCase()}${holiday.activity.slice(1)}. He'll be back at the North Pole on 1 November to start preparing for the big night.`
                : "Follow Santa's Christmas Eve journey in real time. Live route updates, fun facts, a countdown, and the full itinerary."}
            </p>

            <div className="mt-5">
              <Link
                to="/santa-tracker"
                className="tracker-action inline-flex items-center gap-2 px-6 py-3 text-sm transition-colors"
              >
                {isLive ? "Track Santa Now" : "Open the Tracker"}
                <span aria-hidden="true">&rarr;</span>
              </Link>
            </div>
          </div>

          <div className="flex-shrink-0 w-full lg:w-auto">
            {isLive || isComplete ? (
              <LiveStats data={data} />
            ) : (
              <div className="flex flex-col items-center lg:items-end gap-4">
                <CountdownDisplay countdown={countdown} />
                <MiniMap holiday={onHoliday ? holiday : null} />
              </div>
            )}
          </div>

        </div>
      </div>
    </section>
  );
}

function CountdownDisplay({ countdown }: { countdown: ReturnType<typeof getCountdownToStart> }) {
  const units = [
    { label: "Days", value: countdown.days },
    { label: "Hours", value: countdown.hours },
    { label: "Mins", value: countdown.minutes },
    { label: "Secs", value: countdown.seconds },
  ];

  return (
    <div className="text-center lg:text-right">
      <p className="text-[10px] uppercase tracking-widest text-santa-gold/80 mb-3">
        Countdown to Christmas Eve
      </p>
      <div className="inline-flex items-center gap-2 sm:gap-3">
        {units.map((u, i, arr) => (
          <div key={u.label} className="flex items-center gap-2 sm:gap-3">
            <div className="text-center">
                <div className="tracker-card rounded-lg px-3 sm:px-4 py-2 sm:py-3 min-w-[52px] sm:min-w-[64px]">
                <div className="tracker-countdown-value text-xl sm:text-2xl tabular-nums">
                  {String(u.value).padStart(2, "0")}
                </div>
              </div>
              <div className="tracker-countdown-label text-[9px] sm:text-[10px] uppercase tracking-wider mt-1">
                {u.label}
              </div>
            </div>
            {i < arr.length - 1 && (
              <span className="text-santa-gold/70 text-lg font-light mb-4">:</span>
            )}
          </div>
        ))}
      </div>
    </div>
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
          <div className="text-santa-cream font-medium text-sm sm:text-base tabular-nums truncate">
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

function MiniMap({ holiday }: { holiday: HolidayDestination | null }) {
  const santaX = holiday
    ? ((holiday.lng + 180) / 360) * 1000
    : ((0 + 180) / 360) * 1000;
  const santaY = holiday
    ? ((90 - holiday.lat) / 180) * 500
    : ((90 - 90) / 180) * 500;

  const caption = holiday
    ? `Santa's holiday location`
    : "Santa's at the North Pole";

  return (
    <div className="tracker-map w-full lg:w-[280px] rounded-lg border overflow-hidden">
      <svg
        viewBox="0 0 1000 500"
        className="w-full"
        style={{ aspectRatio: "2 / 1" }}
        preserveAspectRatio="xMidYMid meet"
      >
        <rect width="1000" height="500" fill="transparent" />
        <g fill="#1B4332" stroke="#52765a" strokeWidth="0.7" opacity="0.82">
          {worldMapPaths.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
        <circle cx={santaX} cy={santaY} r="18" fill="#D4AF37" opacity="0.3">
          <animate attributeName="r" values="12;22;12" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite" />
        </circle>
        <text
          x={santaX}
          y={santaY}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="28"
          className="select-none"
        >
          🎅
        </text>
      </svg>
      <div className="tracker-map-caption px-2 py-1.5 text-[10px] text-center">
        {caption}
      </div>
    </div>
  );
}
