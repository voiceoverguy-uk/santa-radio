"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Clock, Navigation, Gift, Plane, Globe, Target, Zap } from "lucide-react";
import { getDashboardData, formatNumber, isChristmasInJuly, type HolidayDestination } from "@/lib/santaRoute";
import { holidayDestinations } from "@/data/santaHolidays";

interface SantaStatsProps {
  effectiveTime: Date;
  holiday?: HolidayDestination | null;
}

function useCountUp(target: number, duration: number = 800): number {
  const [display, setDisplay] = useState(target);
  const prevRef = useRef(target);
  const frameRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      setDisplay(target);
      prevRef.current = target;
      return;
    }

    const from = prevRef.current;
    const diff = target - from;
    if (Math.abs(diff) < 1) {
      setDisplay(target);
      prevRef.current = target;
      return;
    }

    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + diff * eased));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        prevRef.current = target;
      }
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [target, duration]);

  return display;
}

export default function SantaStats({ effectiveTime, holiday }: SantaStatsProps) {
  const data = getDashboardData(effectiveTime);
  const isLive = data.mode === "LIVE";

  const onHoliday = data.mode === "OFF_SEASON" && !!holiday;
  const inJuly = data.mode === "OFF_SEASON" && isChristmasInJuly(effectiveTime);
  const [maybeNext, setMaybeNext] = useState<HolidayDestination | null>(null);

  useEffect(() => {
    const others = holidayDestinations.filter(d => d.name !== holiday?.name);
    setMaybeNext(others[Math.floor(Math.random() * others.length)]);
  }, [holiday]);

  const offSeasonGifts = [
    "Still receiving lists", "Reading lists", "Checking twice", "Workshop approving",
    "Wrapping presents", "Elves on overtime", "Testing toys", "Quality control",
    "Sorting the nice list", "Counting requests",
  ];
  const julyGifts = [
    "Mid-year list check", "Half-year stocktake", "Testing summer toys",
    "July wish review", "Checking the nice list", "Wrapping practice",
  ];
  const offSeasonDistance = [
    "Sleigh in the garage", "Reindeer resting", "Polishing the sleigh", "Route planning",
    "Feeding reindeer", "Waxing the runners", "Map pinned to the wall", "GPS calibrating",
  ];
  const julyDistance = [
    "Sleigh mid-year MOT", "Reindeer on holiday too", "Route rehearsal",
    "Compass calibrating", "Halfway there!", "Summer service complete",
  ];
  const activeGifts = inJuly ? julyGifts : offSeasonGifts;
  const activeDistance = inJuly ? julyDistance : offSeasonDistance;
  const [funGifts, setFunGifts] = useState(activeGifts[0]);
  const [funDistance, setFunDistance] = useState(activeDistance[0]);

  useEffect(() => {
    setFunGifts(activeGifts[Math.floor(Math.random() * activeGifts.length)]);
    setFunDistance(activeDistance[Math.floor(Math.random() * activeDistance.length)]);
  }, []);

  if (onHoliday && holiday) {
    data.currentStopName = holiday.name;
    data.currentStopFlag = inJuly ? "🎄" : "🏖️";
  }

  const animatedGifts = useCountUp(data.estimatedGifts);
  const animatedDistance = useCountUp(data.estimatedDistanceKm);
  const animatedVisited = useCountUp(data.visitedCount, 400);

  function getHolidayLocalTime(): string {
    if (!holiday) return "—";
    const offsetHours = Math.round(holiday.lng / 15);
    const nowUtc = new Date();
    const localMs = nowUtc.getTime() + offsetHours * 60 * 60 * 1000;
    const localDate = new Date(localMs);
    const h = localDate.getUTCHours();
    const m = localDate.getUTCMinutes();
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, "0")} ${period}`;
  }

  const cards = [
    {
      icon: <MapPin size={18} />,
      label: "Current Location",
      value: `${data.currentStopFlag} ${data.currentStopName}`,
      ukGlow: data.state === "UK_SPECIAL_WINDOW",
    },
    {
      icon: <Clock size={18} />,
      label: "Local Time",
      value: onHoliday ? getHolidayLocalTime() : data.localTimeAtStop,
    },
    {
      icon: <Navigation size={18} />,
      label: "Next Stop",
      value: onHoliday && maybeNext ? `Maybe ${maybeNext.name}?` : (data.nextStopName !== "—" ? `${data.nextStopFlag} ${data.nextStopName}` : "—"),
    },
    {
      icon: <Target size={18} />,
      label: "ETA",
      value: onHoliday ? (inJuly ? "Celebrating! 🎄" : "Relaxing...") : data.etaText,
    },
    {
      icon: <Gift size={18} />,
      label: "Gifts Delivered",
      value: isLive || data.mode === "COMPLETE" ? formatNumber(animatedGifts) : onHoliday ? funGifts : "—",
    },
    {
      icon: <Plane size={18} />,
      label: "Distance Flown",
      value: isLive || data.mode === "COMPLETE" ? `${formatNumber(Math.round(animatedDistance * 0.621371))} miles` : onHoliday ? funDistance : "—",
    },
    {
      icon: <Globe size={18} />,
      label: "Countries Visited",
      value: onHoliday ? (inJuly ? "Celebrating mid-year!" : "Back on 1 November") : `${animatedVisited} / ${data.visitedCount + data.remainingCount}`,
    },
    {
      icon: <Zap size={18} />,
      label: "Speed",
      value: data.speedLabel,
    },
  ];

  if (data.approachingUK) {
    cards.push({
      icon: <span className="text-lg">🇬🇧</span>,
      label: "UK Arrival",
      value:
        data.countdownToUK.totalMs > 0
          ? `${data.countdownToUK.hours > 0 ? `${data.countdownToUK.hours}h ` : ""}${data.countdownToUK.minutes}m ${data.countdownToUK.seconds}s`
          : "Santa is here!",
      ukGlow: true,
    });
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      {cards.map((card, i) => (
        <div
          key={i}
          className={`tracker-card relative p-4 transition-all duration-300 ${
            card.ukGlow
              ? "tracker-card-highlight"
              : ""
          }`}
        >
          <div className="flex items-center gap-2 text-santa-gold mb-2">
            {card.icon}
            <span className="text-[10px] sm:text-xs uppercase tracking-wider font-medium">
              {card.label}
            </span>
          </div>
          <div className="tracker-card-value text-sm sm:text-base truncate tabular-nums">
            {card.value}
          </div>
        </div>
      ))}
    </div>
  );
}
