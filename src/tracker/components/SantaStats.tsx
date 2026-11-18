"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { MapPin, Clock, Navigation, Gift, Plane, Globe, Target, Zap, Home, Coffee, ListChecks, GlassWater, Castle, Mail, IceCreamCone, PenLine, Music2, Camera, Cookie } from "lucide-react";
import { getDashboardData, formatNumber, isHolidaySeason, isChristmasInJuly, type HolidayDestination } from "@/lib/santaRoute";
import { isNewYearCelebration } from "../lib/postChristmas";
import { getSeasonalStats } from "../lib/seasonalStats";
import { holidayDestinations } from "@/data/santaHolidays";

interface SantaStatsProps {
  effectiveTime: Date;
  holiday?: HolidayDestination | null;
  routeResearch?: boolean;
  northPoleVisit?: boolean;
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

export default function SantaStats({ effectiveTime, holiday, routeResearch = false, northPoleVisit = false }: SantaStatsProps) {
  const data = getDashboardData(effectiveTime);
  const isLive = data.mode === "LIVE";

  const onHoliday = !northPoleVisit && !routeResearch && data.mode === "OFF_SEASON" && isHolidaySeason(effectiveTime) && !!holiday;
  const researching = !northPoleVisit && (routeResearch || data.mode === "ROUTE_RESEARCH");
  const onTrip = onHoliday || (researching && !!holiday);
  const inJuly = data.mode === "OFF_SEASON" && isChristmasInJuly(effectiveTime);
  const [maybeNext, setMaybeNext] = useState<HolidayDestination | null>(null);
  useEffect(() => {
    const others = holidayDestinations.filter(d => d.name !== holiday?.name);
    setMaybeNext(others[Math.floor(Math.random() * others.length)]);
  }, [holiday]);

  if (onTrip && holiday) {
    data.currentStopName = holiday.name;
    data.currentStopFlag = researching ? "🧭" : inJuly ? "🎄" : "🏖️";
  }
  if (northPoleVisit) {
    data.currentStopName = "North Pole";
    data.currentStopFlag = "🎅";
    data.currentStopRegion = "Arctic";
  }

  const animatedGifts = useCountUp(data.estimatedGifts);
  const animatedDistance = useCountUp(data.estimatedDistanceKm);
  const animatedVisited = useCountUp(data.visitedCount, 400);

  function getHolidayLocalTime(): string {
    if (!holiday) return "—";
    const offsetHours = Math.round(holiday.lng / 15);
    const localMs = effectiveTime.getTime() + offsetHours * 60 * 60 * 1000;
    const localDate = new Date(localMs);
    const h = localDate.getUTCHours();
    const m = localDate.getUTCMinutes();
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, "0")} ${period}`;
  }

  const cards: { icon: ReactNode; label: string; value: string; ukGlow?: boolean; note?: string }[] = [
    {
      icon: <MapPin size={18} />,
      label: "Current Location",
      value: `${data.currentStopFlag} ${data.currentStopName}`,
      ukGlow: data.state === "UK_SPECIAL_WINDOW",
    },
    {
      icon: <Clock size={18} />,
      label: researching ? "Research Clock (approx.)" : onHoliday ? "Postcard Clock (approx.)" : data.state === "IN_TRANSIT" ? "Last Stop’s Local Time" : "Stop’s Local Time",
      value: onTrip ? getHolidayLocalTime() : data.localTimeAtStop === "—" ? "—" : `${data.localTimeAtStop} · ${data.localClockPlace}`,
    },
    {
      icon: <Navigation size={18} />,
      label: "Next Stop",
      value: northPoleVisit ? "Christmas Eve departure" : researching ? "North Pole between trips" : onHoliday && maybeNext ? `Maybe ${maybeNext.name}?` : (data.nextStopName !== "—" ? `${data.nextStopFlag} ${data.nextStopName}` : "—"),
    },
    {
      icon: <Target size={18} />,
      label: "ETA",
      value: northPoleVisit ? "Workshop preparations" : researching ? "Quick research trip" : onHoliday ? (inJuly ? "Celebrating! 🎄" : "Relaxing...") : data.etaText,
    },
    {
      icon: <Gift size={18} />,
      label: "Estimated Gifts",
      value: isLive || data.mode === "COMPLETE" ? formatNumber(animatedGifts) : "—",
    },
    {
      icon: <Plane size={18} />,
      label: "Estimated Distance",
      value: isLive || data.mode === "COMPLETE" ? `${formatNumber(Math.round(animatedDistance * 0.621371))} miles` : "—",
    },
    {
      icon: <Globe size={18} />,
      label: "Route Stops",
      value: northPoleVisit ? "Preparing at the North Pole" : researching ? "Research, not deliveries" : onHoliday ? (inJuly ? "Celebrating mid-year!" : "Research from 10 November") : `${animatedVisited} / ${data.visitedCount + data.remainingCount}`,
    },
    {
      icon: <Zap size={18} />,
      label: "Estimated Speed",
      value: data.speedLabel,
    },
  ];

  const preparing = data.mode === "ROUTE_RESEARCH" || data.mode === "PREPARING";
  const partying = data.mode === "COMPLETE" && isNewYearCelebration(effectiveTime);
  if (preparing || onHoliday || partying) {
    const icons = {
      towns: <Globe size={18} />,
      chimneys: <Home size={18} />,
      cocoa: <Coffee size={18} />,
      names: <ListChecks size={18} />,
      coladas: <GlassWater size={18} />,
      sandcastles: <Castle size={18} />,
      postcards: <Mail size={18} />,
      icecreams: <IceCreamCone size={18} />,
      autographs: <PenLine size={18} />,
      dance: <Music2 size={18} />,
      selfies: <Camera size={18} />,
      snacks: <Cookie size={18} />,
    };
    const phase = preparing ? "preparation" : partying ? "party" : "holiday";
    cards.splice(4, 4, ...getSeasonalStats(effectiveTime, phase).map(metric => ({
      icon: icons[metric.key],
      label: metric.label,
      value: metric.count.toLocaleString("en-GB"),
      note: metric.note,
    })));
  }

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
    <div className="tracker-stats-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
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
          <div className="tracker-card-value text-sm sm:text-base break-words tabular-nums">
            {card.value}
          </div>
          {card.note && <p className="tracker-meta mt-1 text-xs leading-snug">{card.note}</p>}
        </div>
      ))}
    </div>
  );
}
